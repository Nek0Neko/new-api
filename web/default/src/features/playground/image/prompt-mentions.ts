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
// Ported from CookSleep/gpt_image_playground (MIT, https://github.com/CookSleep/gpt_image_playground).
import type { ImageInputFile } from './types'

const MENTION_START = '⁣'
const MENTION_END = '⁤'
const SELECTED_IMAGE_MENTION_RE = /⁣@图(\d+)⁤/g
const SELECTED_MENTION_RE = /⁣(@图(\d+))⁤/g

export interface AtImageQuery {
  start: number
  query: string
}

export function getImageMentionLabel(index: number) {
  return `@图${index + 1}`
}

export function getSelectedImageMentionLabel(index: number) {
  return getSelectedTextMentionLabel(getImageMentionLabel(index))
}

export function getSelectedTextMentionLabel(text: string) {
  return `${MENTION_START}${text}${MENTION_END}`
}

export function stripImageMentionMarkers(prompt: string): string {
  return prompt.replace(/[⁣⁤]/g, '')
}

export function getPromptIndexFromVisibleIndex(
  prompt: string,
  visibleIndex: number
): number {
  let visible = 0
  for (let i = 0; i < prompt.length; i++) {
    if (prompt[i] === MENTION_START || prompt[i] === MENTION_END) continue
    if (visible >= visibleIndex) return i
    visible++
  }
  return prompt.length
}

export function isCursorInSelectedImageMention(
  prompt: string,
  visibleCursor: number
): boolean {
  for (const match of prompt.matchAll(SELECTED_MENTION_RE)) {
    if (match.index == null) continue
    const visibleStart = stripImageMentionMarkers(
      prompt.slice(0, match.index)
    ).length
    const visibleEnd = visibleStart + match[1].length
    if (visibleCursor > visibleStart && visibleCursor <= visibleEnd) return true
  }
  return false
}

export function getAtImageQuery(
  prompt: string,
  cursor: number,
  imageSource: Pick<ImageInputFile[], 'length'>
): AtImageQuery | null {
  if (imageSource.length === 0) return null

  const beforeCursor = prompt.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')
  if (atIndex < 0) return null

  const query = beforeCursor.slice(atIndex + 1)
  if (/\s/.test(query)) return null
  return { start: atIndex, query }
}

export function imageMentionMatches(query: string, index: number) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const oneBasedIndex = String(index + 1)
  const label = `图${oneBasedIndex}`
  return (
    oneBasedIndex.includes(normalized) ||
    label.toLowerCase().includes(normalized)
  )
}

export function insertImageMention(
  prompt: string,
  start: number,
  cursor: number,
  imageIndex: number
) {
  const mention = getSelectedImageMentionLabel(imageIndex)
  const visibleMention = getImageMentionLabel(imageIndex)
  const nextPrompt = `${prompt.slice(0, start)}${mention}${prompt.slice(cursor)}`
  return {
    prompt: nextPrompt,
    cursor: start + visibleMention.length,
  }
}

export function insertImageMentionAtVisibleRange(
  prompt: string,
  start: number,
  cursor: number,
  imageIndex: number
) {
  return insertTextMentionAtVisibleRange(
    prompt,
    start,
    cursor,
    getImageMentionLabel(imageIndex)
  )
}

export function insertTextMentionAtVisibleRange(
  prompt: string,
  start: number,
  cursor: number,
  text: string
) {
  const promptStart = getPromptIndexFromVisibleIndex(prompt, start)
  const promptCursor = getPromptIndexFromVisibleIndex(prompt, cursor)
  const mention = getSelectedTextMentionLabel(text)
  return {
    prompt: `${prompt.slice(0, promptStart)}${mention}${prompt.slice(promptCursor)}`,
    cursor: start + text.length,
  }
}

export function remapImageMentionsForOrder(
  prompt: string,
  previousImages: ImageInputFile[],
  nextImages: ImageInputFile[],
  equivalentImageIds: Record<string, string> = {}
): string {
  return prompt.replace(SELECTED_IMAGE_MENTION_RE, (text, n) => {
    const previousImage = previousImages[Number(n) - 1]
    if (!previousImage) return text

    const nextImageId = equivalentImageIds[previousImage.id] ?? previousImage.id
    const nextIndex = nextImages.findIndex((img) => img.id === nextImageId)
    return nextIndex >= 0
      ? getSelectedImageMentionLabel(nextIndex)
      : '@已移除图片'
  })
}

export type PromptMentionPart =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; imageIndex: number; mentionText?: string }
  | { type: 'mention'; text: string; mentionText: string; imageIndex?: never }

export function getPromptMentionParts(
  prompt: string,
  inputImages: ImageInputFile[]
): PromptMentionPart[] {
  const parts: PromptMentionPart[] = []
  let lastIndex = 0

  for (const match of prompt.matchAll(SELECTED_MENTION_RE)) {
    const text = match[1]
    const index = match[2] ? Number(match[2]) - 1 : null
    if (match.index == null) continue
    if (index != null && !inputImages[index]) continue

    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        text: stripImageMentionMarkers(prompt.slice(lastIndex, match.index)),
      })
    }
    parts.push(
      index == null
        ? {
            type: 'mention',
            text,
            mentionText: getSelectedTextMentionLabel(text),
          }
        : { type: 'mention', text, imageIndex: index }
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < prompt.length) {
    parts.push({
      type: 'text',
      text: stripImageMentionMarkers(prompt.slice(lastIndex)),
    })
  }

  return parts.length > 0
    ? parts
    : [{ type: 'text', text: stripImageMentionMarkers(prompt) }]
}

export function replaceImageMentionsForApi(
  prompt: string,
  imageCount?: number,
  formatImage?: (index: number) => string
): string {
  return prompt.replace(SELECTED_IMAGE_MENTION_RE, (text, n) => {
    const index = Number(n) - 1
    if (imageCount != null && (index < 0 || index >= imageCount))
      return stripImageMentionMarkers(text)
    return formatImage ? formatImage(index) : `[image ${n}]`
  })
}
