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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  escapeHtml,
  getContentEditableCursor,
  getContentEditablePlainText,
  getMentionTagHtml,
  setContentEditableCursor,
  setContentEditableSelection,
  syncMentionTagSelection,
} from './contenteditable-selection'
import { imageInputFileToDataUrl } from './image-encoding'
import {
  getAtImageQuery,
  getImageMentionLabel,
  getPromptMentionParts,
  imageMentionMatches,
  insertImageMentionAtVisibleRange,
  stripImageMentionMarkers,
  type AtImageQuery,
} from './prompt-mentions'
import type { ImageInputFile } from './types'

interface Props {
  /** Plain text WITH invisible mention markers (source of truth in index.tsx). */
  value: string
  inputImages: ImageInputFile[]
  disabled?: boolean
  /** Drop the border/ring/padding so the editor blends into a parent card. */
  bare?: boolean
  /** Reports marker-bearing plain text. */
  onChange: (next: string) => void
  onSubmit: () => void
}

interface AtImageOption {
  img: ImageInputFile
  i: number
  label: string
}

/** Build the contentEditable HTML (text + pills) for a marker-bearing value. */
function renderHtmlFromValue(value: string, inputImages: ImageInputFile[]) {
  if (!value) return ''
  return getPromptMentionParts(value, inputImages)
    .map((part) => {
      if (part.type === 'mention') {
        const label =
          part.imageIndex != null
            ? getImageMentionLabel(part.imageIndex)
            : part.text
        return getMentionTagHtml(label)
      }
      return escapeHtml(part.text)
    })
    .join('')
}

export default function PromptEditor({
  value,
  inputImages,
  disabled,
  bare,
  onChange,
  onSubmit,
}: Props) {
  const { t } = useTranslation()
  const editorRef = useRef<HTMLDivElement>(null)
  // Tracks the exact text we last emitted from user input so the reflection
  // effect can skip clobbering the caret for our own change — and only that
  // change — without a sticky boolean that could swallow a real external one.
  const lastEmittedRef = useRef<string | null>(null)
  const [query, setQuery] = useState<AtImageQuery | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)

  // Reflect external value into the DOM only when it changed outside typing.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (value === lastEmittedRef.current) {
      // This value originated from our own onChange; the DOM already matches
      // and the caret is correct, so do not rewrite it.
      lastEmittedRef.current = null
      return
    }
    const html = renderHtmlFromValue(value, inputImages)
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }
  }, [value, inputImages])

  const options: AtImageOption[] = query
    ? inputImages
        .map((img, i) => ({ img, i, label: getImageMentionLabel(i) }))
        .filter((o) => imageMentionMatches(query.query, o.i))
    : []

  const refreshQuery = useCallback(
    (el: HTMLElement) => {
      const text = getContentEditablePlainText(el)
      const cursor = getContentEditableCursor(el)
      const q = getAtImageQuery(stripImageMentionMarkers(text), cursor, {
        length: inputImages.length,
      })
      setQuery(q)
      setMenuOpen(!!q)
      setMenuIndex(0)
      return text
    },
    [inputImages.length]
  )

  const handleInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    syncMentionTagSelection(el)
    const text = refreshQuery(el)
    lastEmittedRef.current = text
    onChange(text)
  }, [onChange, refreshQuery])

  const selectOption = useCallback(
    (o: AtImageOption) => {
      const el = editorRef.current
      if (!el) return
      const text = getContentEditablePlainText(el)
      const cursor = getContentEditableCursor(el)
      const q = getAtImageQuery(stripImageMentionMarkers(text), cursor, {
        length: inputImages.length,
      })
      setMenuOpen(false)
      setQuery(null)
      setMenuIndex(0)
      if (!q) return

      const label = getImageMentionLabel(o.i)
      const nextCursor = q.start + label.length

      // Preferred path: replace the typed "@query" via execCommand so the
      // browser keeps a clean undo stack and a sane caret.
      el.focus()
      setContentEditableSelection(el, q.start, cursor)
      if (document.execCommand('insertHTML', false, getMentionTagHtml(label))) {
        setContentEditableCursor(el, nextCursor)
        const emitted = getContentEditablePlainText(el)
        // We already mutated the DOM + caret here, so mark this as our own
        // emission to keep the reflection effect from rewriting it.
        lastEmittedRef.current = emitted
        onChange(emitted)
        return
      }

      // Fallback: rebuild the marker string directly, then re-render + restore.
      // Leave lastEmittedRef null so the reflection effect rewrites the DOM,
      // then restore the caret afterwards.
      const next = insertImageMentionAtVisibleRange(text, q.start, cursor, o.i)
      onChange(next.prompt)
      window.setTimeout(() => {
        const node = editorRef.current
        if (node) {
          node.focus()
          setContentEditableCursor(node, next.cursor)
        }
      }, 0)
    },
    [inputImages.length, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (menuOpen && options.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMenuIndex((idx) => (idx + 1) % options.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMenuIndex((idx) => (idx - 1 + options.length) % options.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          selectOption(options[menuIndex] ?? options[0])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setMenuOpen(false)
          setQuery(null)
          setMenuIndex(0)
          return
        }
      }

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onSubmit()
      }
    },
    [menuOpen, options, menuIndex, selectOption, onSubmit]
  )

  return (
    <div className='relative'>
      {menuOpen && options.length > 0 && (
        <ul className='bg-popover absolute bottom-full z-50 mb-2 max-h-56 w-64 overflow-auto rounded-md border p-1 shadow-md'>
          {options.map((o, idx) => (
            <li key={o.img.id}>
              <button
                type='button'
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(o)
                }}
                onMouseEnter={() => setMenuIndex(idx)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  idx === menuIndex ? 'bg-accent' : ''
                }`}
              >
                <img
                  src={imageInputFileToDataUrl(o.img)}
                  className='size-8 rounded object-cover'
                  alt=''
                />
                <span className='min-w-0 flex-1 truncate'>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role='textbox'
        aria-multiline='true'
        data-placeholder={t(
          'Describe the image you want, type @ to reference an image…'
        )}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className={cn(
          'empty:before:text-muted-foreground min-h-20 w-full resize-none bg-transparent text-sm break-words whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] focus:outline-none',
          bare
            ? 'px-2 py-1.5'
            : 'focus-visible:ring-ring rounded-md border px-3 py-2 focus-visible:ring-1'
        )}
      />
    </div>
  )
}
