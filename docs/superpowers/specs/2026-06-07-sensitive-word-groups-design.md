# 敏感词分组词库 + 匹配性能优化 — 设计文档

日期:2026-06-07
状态:已确认

## 背景与目标

当前敏感词功能将所有词存在 `Option` 表单个 key(`SensitiveWords`)的换行分隔文本中,前端是一个 textarea。词量大时难以管理,且无分类概念。

目标:

1. 支持按分组管理敏感词(如 暴恐词库、非法网址、色情类型、政治类型),每组可单独启用/禁用。
2. 支持以 .txt 文件上传导入词库(文件名即组名,每行一词),并支持按组导出。
3. 命中敏感词时,服务端日志中标注命中词所属的组名。
4. 消除请求路径上的词库 hash 开销(当前 `acKey` 每请求对全词库 trim+排序+hash,几千词约 0.5ms 且随词库线性增长)。

非目标:

- 不建新数据库表(词库总量几千以内,option 表 JSON 足够)。
- 不新增后端上传接口(.txt 解析在前端完成)。
- 不改变返回给客户端的错误内容(不泄露词库内容与分类)。
- 不引入对响应/流式内容的检测(维持仅检测 prompt 的现状)。

## 现状摘要(实测基准,Apple M4)

- 匹配算法:AC 自动机(`github.com/anknown/ahocorasick`),`service/str.go`。
- 检测仅发生在 `controller/relay.go` 转发前,对 prompt 合并文本检查一次。
- 匹配耗时 0.1~1.2ms/请求,对用户体验无感;但其中大头是 `acKey()` 每请求重算词库 hash(5000 词 ≈ 0.5ms),属纯浪费。
- AC 机器构建:1000 词 ≈ 0.9ms,10000 词 ≈ 6.9ms,仅词库变更时需要。

## 设计

### 1. 数据模型与存储

继续使用 `Option` 表现有 `SensitiveWords` key,value 改为 JSON 数组:

```json
[
  { "name": "暴恐词库", "enabled": true, "words": ["词1", "词2"] },
  { "name": "政治类型", "enabled": false, "words": ["词3"] }
]
```

`setting/sensitive.go` 新增:

```go
type SensitiveWordGroup struct {
    Name    string   `json:"name"`
    Enabled bool     `json:"enabled"`
    Words   []string `json:"words"`
}
```

序列化/反序列化(遵循 CLAUDE.md Rule 1,走 `common.Marshal` / `common.Unmarshal`):

- `SensitiveWordsFromString(s)`:先尝试 JSON 解析为 `[]SensitiveWordGroup`;失败则按 legacy 换行格式解析为单组 `{Name: "默认分组", Enabled: true, Words: <每行一词>}`。解析完成后触发快照重建(见 §2)。
- `SensitiveWordsToString()`:JSON 序列化全部分组。首次保存后存储自动升级为 JSON 格式。

兼容性:

- 无 DB 迁移;老数据(换行文本)在加载时自动识别。
- 多实例部署:`SyncOptions` 定期重载 option → 触发 `SensitiveWordsFromString` → 各实例各自重建快照,机制不变。
- 词的规范化沿用现状:加载时 trim,匹配时统一转小写(大小写不敏感)。

### 2. 匹配性能 — 配置时构建,请求时零开销

**核心改变:把 AC 机器的构建从"首次匹配时按词库 hash 查缓存"改为"词库更新时构建一次、原子替换"。**

依赖方向是 `service → setting`(AC 库也只在 service 引入),setting 无法直接触发 service 重建,因此采用**版本号 + 懒重建**:

- `setting`:维护 `sensitiveWordsVersion`(`atomic.Int64`),`SensitiveWordsFromString` 每次解析完成后自增(覆盖启动加载、API 更新、定时同步三条路径)。
- `service`:维护不可变快照:

```go
type sensitiveSnapshot struct {
    version   int64
    machine   *goahocorasick.Machine // 所有启用组的词(小写、去重)构建
    wordGroup map[string]string      // 词(小写) → 组名;重复词归属首个包含它的启用组
}
```

- 请求时:load 快照(`atomic.Value`),`snapshot.version == setting.SensitiveWordsVersion()` 则直接使用(一次原子读 + int 比较,纳秒级);不等则加互斥锁重建后原子替换(double-check 避免并发重复构建)。词库变更后的第一个请求支付一次构建(几千词 ≈ 几 ms),与现状相同,但去掉了每请求的全词库 hash。
- 空词库(无启用组或无词):快照为 nil 机器,匹配直接返回未命中。
- 请求路径:`SensitiveWordContains` 直接 load 快照 → `MultiPatternSearch`,不再调用 `AcSearch`/`acKey`。每请求节省 ~0.5ms(5000 词),且开销不再随词库规模增长。
- `service/str.go` 的通用 `AcSearch`(含 `acCache`/`acKey`)保留,供其他调用方使用,不在本次删除。
- `SensitiveWordReplace`(当前无调用方)同步改用快照,保持行为可用。

### 3. 命中返回组名

- 匹配结果从 `(bool, []string)` 扩展为携带组名,形如 `(bool, []SensitiveWordHit{GroupName, Word})`(具体签名实现时定,`CheckSensitiveMessages` 同步适配)。
- `controller/relay.go` 日志格式:

  ```
  user sensitive words detected: [政治类型]xxx, [暴恐词库]yyy
  ```

- 客户端错误保持 `ErrorCodeSensitiveWordsDetected` 通用文案,不包含命中词与组名。

### 4. 前端 UI(重构 `web/default/src/features/system-settings/request-limits/sensitive-words-section.tsx`)

- 原 textarea 替换为**分组卡片列表**:
  - 每组显示:组名、启用 Switch、词数统计;
  - 展开后:textarea(每行一词)直接编辑;
  - 操作:新建空组、重命名、删除组。
- **上传 .txt**:文件名(去扩展名)作为组名,内容每行一词(trim、跳过空行);与现有组重名时询问「合并 / 覆盖 / 取消」。文件在前端用 FileReader 解析。
- **导出**:每组可下载为 `组名.txt`(Blob 下载,换行分隔)。
- 保存:全部分组序列化为 JSON 字符串,走现有 `PUT /api/option/`(key 仍为 `SensitiveWords`),单次提交。
- 加载兼容:读到的 value 非 JSON 时按 legacy 处理为「默认分组」单组。
- .txt 解析、分组 JSON 序列化/反序列化、legacy 识别抽为纯函数模块,便于测试。
- 新增文案全部走 i18n(`t('English key')`),完成后运行 `bun run i18n:sync` 补齐各语言。
- 上层开关(Enable filtering / Inspect user prompts)不变。

### 5. 错误处理

- 后端解析非法 JSON:回退 legacy 换行解析(非法 JSON 文本被当作词列表的可能性极低,因为正常保存路径产出合法 JSON;该回退主要兜底手工改库的情况)。
- 前端上传非 UTF-8 / 空文件:提示错误,不产生空组。
- 组名为空或全空白:保存前校验拦截。
- 同一保存内重复组名:校验拦截(上传重名走合并/覆盖询问)。

### 6. 测试

后端(Go,标准 `go test`):

- `setting`:JSON 解析、legacy 换行解析、空值、非法 JSON 回退、`ToString` 往返。
- `service`:禁用组的词不命中;命中返回正确组名;重复词归属首个启用组;大小写不敏感;`FromString` 后快照确实重建(新词立即生效、删词立即失效);空词库不 panic。

前端(`tsx --test`,项目惯例,从 `web/default/` 运行):

- .txt 解析(trim、空行、CRLF)。
- 分组 JSON 序列化/反序列化、legacy 文本识别。

### 改动文件清单

| 文件 | 改动 |
|---|---|
| `setting/sensitive.go` | `SensitiveWordGroup` 结构、JSON+legacy 解析、快照构建与原子替换 |
| `service/sensitive.go` | 改用快照匹配、返回组名、适配 `CheckSensitiveMessages`/`SensitiveWordReplace` |
| `service/str.go` | 如需抽公共构建逻辑则小幅调整;`AcSearch` 通用路径保留 |
| `controller/relay.go` | 日志输出带组名(约一行) |
| `web/default/src/features/system-settings/request-limits/sensitive-words-section.tsx` | 分组 UI、上传/导出 |
| `web/default/src/i18n/locales/*.json` | 新文案(`i18n:sync`) |

## 已确认的取舍

- 词库量级:几千以内 → 不建表,option 表 JSON。
- 每组独立启用/禁用:需要。
- 命中返回组名:需要(仅服务端日志,不下发客户端)。
- 维护方式:文件上传 + 页面编辑并存。
- 磁盘文件方案(`data/sensitive/*.txt`)被否决:多实例/Docker 下文件同步麻烦,绕过 option 同步机制。
- 专门数据库表方案被否决:当前量级属过度设计。
