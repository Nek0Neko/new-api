/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type SensitiveWordGroup = {
  name: string
  enabled: boolean
  words: string[]
}

// 必须与后端 setting.LegacySensitiveGroupName 保持一致
export const LEGACY_GROUP_NAME = '默认分组'

function normalizeWords(words: unknown): string[] {
  if (!Array.isArray(words)) return []
  return words.map((w) => String(w).trim()).filter((w) => w !== '')
}

function isGroupLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).name === 'string'
  )
}

/** 解析 option 值:JSON 分组格式,或 legacy 换行格式(转为单个默认分组) */
export function parseSensitiveWordGroups(value: string): SensitiveWordGroup[] {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return []

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every(isGroupLike)) {
        return parsed.map((g) => ({
          name: String(g.name),
          enabled: Boolean(g.enabled),
          words: normalizeWords(g.words),
        }))
      }
    } catch {
      // fall through to legacy
    }
  }

  return [
    {
      name: LEGACY_GROUP_NAME,
      enabled: true,
      words: parseTxtWords(trimmed),
    },
  ]
}

/** 序列化为持久化 JSON(词 trim、去空) */
export function serializeSensitiveWordGroups(
  groups: SensitiveWordGroup[]
): string {
  return JSON.stringify(
    groups.map((g) => ({
      name: g.name,
      enabled: g.enabled,
      words: normalizeWords(g.words),
    }))
  )
}

/** 解析 .txt / textarea 内容:每行一词,trim、去空行,兼容 CRLF */
export function parseTxtWords(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}
