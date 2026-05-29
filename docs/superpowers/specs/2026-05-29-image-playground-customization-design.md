# Image Playground Customization — Design

Date: 2026-05-29
Status: Approved-pending-review
Area: `web/default/src/features/playground/image/`

## Goal

Rebuild the image-generation playground input so users can fully customize
generation parameters, matching the provided mockups and the reference project
[CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground)
(MIT). Specifically:

1. A redesigned toolbar exposing **尺寸 / 质量 / 格式 / 压缩率 / 审核 / 数量**
   (size / quality / output_format / output_compression / moderation / n).
2. A **size picker modal** (auto / by-ratio / custom W×H) that normalizes ratios
   and resolutions to concrete legal pixel sizes.
3. **`@`-mention** of uploaded reference images inside the prompt.
4. A **finished, advanced mask editor** (brush / eraser / size / clear /
   undo-redo / zoom / pan) replacing the current basic one.

The backend already accepts every parameter (`dto/openai_image.go` carries
`moderation`, `output_format`, `output_compression`, `partial_images`, and an
arbitrary `size` string), so **this is a frontend-only change.**

### Out of scope

- Backend / relay changes.
- Agent-mode / web-search / fal-provider branching from the reference (the
  playground has no agent mode and is provider-agnostic via the gateway).
- The reference's `@`-mention of *agent-output* images (history) — only uploaded
  reference images are mentionable here.

### Licensing

Ported files carry the existing new-api AGPL header plus a one-line attribution
comment: `// Ported from CookSleep/gpt_image_playground (MIT).`

## Scope decisions (from brainstorming)

| Topic | Decision |
| --- | --- |
| Size handling | Port reference `size.ts` verbatim, **including** the clamp constraints. |
| Streaming | Keep `stream` + `partial_images`, but move them out of the main toolbar into a small "more" popover. |
| `@`-mention | Implement it, using the faithful **contenteditable + invisible-marker** approach (mention pills). |
| Mask editor | Port the reference's advanced editor (zoom/pan/undo/redo). |
| `@`-input technique | Faithful contenteditable port (pills), isolated as its own module. |

## Architecture

Layered as today: `index.tsx` (view) → `use-image-playground.ts` (state) →
`api.ts` (transport) → backend relay. New work is decomposed into focused,
independently testable units.

### Unit 1 — Parameter model (`image/types.ts`, `image/storage.ts`)

`ImageConfig` extends to:

```ts
interface ImageConfig {
  model: string
  size: string                         // 'auto' | 'WxH'
  quality: 'auto' | 'low' | 'medium' | 'high'   // was 'standard' | 'hd'
  outputFormat: 'png' | 'jpeg' | 'webp'
  outputCompression: number | null     // 0–100; null when N/A
  moderation: 'auto' | 'low'
  n: number
  stream: boolean
  partialImages: number
}
```

- `DEFAULT_IMAGE_CONFIG`: `size 'auto'`, `quality 'auto'`, `outputFormat 'png'`,
  `outputCompression null`, `moderation 'auto'`, `n 1`, `stream false`,
  `partialImages 1`.
- **Migration** in `loadImageConfig()`: any persisted `quality` not in the new
  enum (`standard`/`hd`/unknown) → `'auto'`; missing new fields → defaults.
  Old DALL·E sizes (`256x256`, …) are still valid strings and pass through.
- `ImageGenerationRequest` & `ImageEditRequest` (`types.ts`) gain
  `output_format?`, `output_compression?` (pointer-equivalent: omitted when
  `null`/PNG), `moderation?`. Per **Rule 5**, optional scalars are emitted only
  when set; `output_compression: 0` must still be sent when format ≠ png.

### Unit 2 — Size library (`image/size.ts` + `image/size.test.ts`)

Ported verbatim from the reference. Pure functions, no React:

- `normalizeImageSize(size)`, `parseRatio(ratio)`, `formatImageRatio(w,h)`,
  `calculateImageSize(tier, ratio)`, `SizeTier = '1K'|'2K'|'4K'`.
- Constants: 16-multiple, max edge 3840, pixels 655360–8294400, max aspect 3:1,
  `COMMON_SIZE_PRESETS` (1K/2K/4K × {1:1,3:2,2:3,16:9,9:16,4:3,3:4,21:9}).
- Test file ported as-is, run under the repo's Vitest config.

**Interface:** input ratio/tier or "WxH" string → returns a normalized legal
"WxH" string (or `'auto'` passthrough). Depends on nothing.

### Unit 3 — `SizePickerModal` (`image/size-picker-modal.tsx`)

Reimplements the reference modal on new-api primitives (Image #2):

- Base UI `Dialog`; tabs via `Tabs` (or a segmented control): **自动 / 按比例 /
  自定义宽高**.
- 按比例: 基准分辨率 `ToggleGroup` 1K/2K/4K; 8 ratio tiles (with the small
  rectangle glyph) + a full-width 自定义比例 button revealing a ratio input.
- 自定义宽高: two number `Input`s + the constraint info box.
- Live "将使用 {previewSize}" footer; a clamp-warning `Tooltip` when the chosen
  value was adjusted. 取消 / 确定 buttons.
- Props: `{ currentSize, onSelect(size), open, onOpenChange, allowAuto }`.
  Uses Unit 2 for all math. lucide icons; all copy via `t()`.

### Unit 4 — Toolbar (in the input bar, `image/index.tsx` or extracted `image/input-toolbar.tsx`)

Matches Images #1/#3/#4/#5. Controls, left→right:

1. **尺寸** — `Button` showing current size; opens Unit 3.
2. **质量** — `Select`: auto / low / medium / high.
3. **格式** — `Select`: PNG / JPEG / WebP.
4. **压缩率** — numeric `Input` (placeholder `0-100`); **disabled when
   `outputFormat === 'png'`**, wrapped in a `Tooltip` reading
   `仅 JPEG 和 WebP 支持压缩率`. Switching to PNG keeps the typed value but
   greys it and drops it from the request; committed on blur with clamp 0–100.
5. **审核** — `Select`: auto / low.
6. **数量** — numeric `Input` (or `Select` 1–N), min 1, clamped to a max
   (`MAX_OUTPUT_IMAGES = 10`); disabled while `stream` is on (as today).
7. **attach** (paperclip) — opens file picker; disabled at the 16-image cap.
8. **send** — disabled unless `hasKey && prompt.trim() && model && !generating`;
   shows loader while generating; label toggles 生成 / 编辑 by input-image count.

**Stream + partial-images** move into a small "更多" `Popover` (gear icon)
beside the toolbar: a `Switch` for stream and, when on, a partial-images
`Select` (0–3). Defaults keep current behavior.

### Unit 5 — `@`-mention prompt editor (`image/prompt-mentions.ts` + `image/prompt-editor.tsx`)

Faithful port (the heaviest/riskiest unit — kept isolated).

- `prompt-mentions.ts`: ported `promptImageMentions.ts` (invisible markers
  `⁣…⁤`, `getImageMentionLabel`, `getAtImageQuery`, `imageMentionMatches`,
  `insertImageMentionAtVisibleRange`, `stripImageMentionMarkers`,
  `getPromptMentionParts`, `remapImageMentionsForOrder`,
  `replaceImageMentionsForApi`). Agent-output regex branch dropped; only
  `@图N` mentions remain. Ported with `prompt-mentions.test.ts`.
- `prompt-editor.tsx`: a `contenteditable` `<div>` (replaces the `Textarea`)
  plus the contenteditable selection/cursor helpers from the reference
  (`getContentEditablePlainText`, `syncMentionTagSelection`,
  `get/setContentEditableCursor`, `getMentionTagHtml`). Placeholder:
  `描述你想生成的图片，可输入 @ 来指定参考图…`.
- An `@`-dropdown lists uploaded reference images (thumb + `@图N`), filtered by
  the query after `@`; ↑/↓ navigate, Enter/Tab insert a `mention-tag` pill,
  Esc dismisses. Mention CSS pill styled with Tailwind.
- **Submit resolution:** `replaceImageMentionsForApi(prompt, inputImages.length)`
  turns `@图N` into `[image N]`; **all** uploaded images are still sent (the
  mention is a prompt authoring aid, not a filter). `stripImageMentionMarkers`
  yields the visible prompt for history/echo.
- Props expose `{ value, onChange(plainText), inputImages, disabled, onSubmit }`
  so `index.tsx` stays thin.

### Unit 6 — Advanced mask editor (`image/mask-editor.tsx` rewrite + `image/viewport-transform.ts`)

Ports `MaskEditorModal` + `viewportTransform.ts`, wrapped in Base UI `Dialog`
with lucide icons.

- **Canvas layers** (natural-resolution, inside a CSS `matrix()` transform
  container): image canvas (background) · preview canvas (blue
  `rgba(59,130,246,.58)` edit-region overlay via `destination-out` with the
  mask) · invisible mask canvas (pointer target) · cursor canvas (brush circle).
- **Tools:** brush (`destination-out` → transparent = edit) / eraser
  (`source-over` white = preserve) / brush-size `Slider` (8–220) / clear /
  **undo-redo** (≤40 `ImageData` snapshots per stack) / **zoom** (Alt+wheel,
  pinch) / **pan** (Alt+drag). Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z shortcuts added.
- **Export:** `toBlob('image/png')` → base64; transparent = edit, opaque white =
  preserve. Returns an `ImageInputFile` consumed by `edit-form-data.ts` as today.
- **Alpha/size note:** the reference's `maskPreprocess` (resize ≤1920, pad to
  /16) targets OpenAI inpainting. We keep the existing mask→primary-image
  wiring (`use-image-playground` already orders mask with its image); padding is
  ported only if needed to match the primary image dimensions the API requires.

### Data flow changes (`use-image-playground.ts`, `api.ts`, `edit-form-data.ts`)

- `submit()` reads the new config fields and, before sending, runs the prompt
  through `replaceImageMentionsForApi`.
- `generateImage`/`editImage` payloads add `output_format`, `output_compression`
  (only when format ≠ png), `moderation`.
- `buildEditFormData` appends `output_format`, `output_compression`,
  `moderation` fields when present.

### Internationalization

All new strings added to `web/default/src/i18n/locales/{zh,en}.json` (flat keys
= English source): toolbar labels, format/quality/moderation options, size-modal
copy (设置图像尺寸, 基准分辨率, 图像比例, 自定义比例, 将使用, the clamp
warning), the compression tooltip, mask-editor labels/shortcuts, and the prompt
placeholder. `bun run i18n:sync` from `web/default/`.

## Testing

- **Vitest:** ported `size.test.ts`, `prompt-mentions.test.ts`; extend
  `edit-form-data.test.ts` for the new fields.
- **Manual:** size modal (each tab → preview + clamp warning), format↔compression
  enable/disable + tooltip, `@`-mention insert/navigate/delete + submit
  resolution, mask editor brush/eraser/undo/redo/zoom/pan + edit submit, config
  persistence + migration from an old stored config.

## Risks

- **`@`-mention contenteditable** is the most fragile piece (selection math,
  IME, paste). Isolated in Unit 5 with its own tests; if it proves unstable it
  can degrade to a plain-text `@` menu without touching other units.
- **Custom sizes** like `3200x2400` are only valid on upstreams that accept
  arbitrary sizes; `gpt-image-1` accepts only `1024x1024/1536x1024/1024x1536/
  auto`. The gateway passes the size through and the upstream validates — the
  clamp keeps values "legal" per the reference's model constraints, not per
  every provider. This is acceptable gateway behavior; surfaced to the user via
  upstream error messages, not pre-validated client-side.
- **Mask memory:** ≤40 full-resolution `ImageData` snapshots can be large; cap
  retained and snapshots taken per-stroke (not per-move), as in the reference.

## Build order (high level; detailed plan follows)

1. Unit 2 (size lib + test) — no deps.
2. Unit 1 (param model + migration) — no UI.
3. Unit 3 (size picker modal) — needs Units 1, 2.
4. Unit 4 (toolbar + stream popover) — needs Units 1, 3.
5. Unit 6 (advanced mask editor) — independent; swaps current editor.
6. Unit 5 (`@`-mention editor) — needs Unit 1's input-image state.
7. Data-flow wiring (Units 1/5) + i18n + tests + manual pass.
