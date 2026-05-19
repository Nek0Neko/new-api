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
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface PromptTextProps {
  text: string
  clampLines?: number
  className?: string
}

/**
 * Renders a prompt with a configurable line-clamp and an inline
 * "Show full prompt / Collapse" toggle that only appears when the text
 * actually overflows the clamped height.
 */
export function PromptText({
  text,
  clampLines = 3,
  className,
}: PromptTextProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (isExpanded) return
    const el = ref.current
    if (!el) return
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [text, isExpanded, clampLines])

  const clampClass =
    clampLines === 1
      ? 'line-clamp-1'
      : clampLines === 2
        ? 'line-clamp-2'
        : 'line-clamp-3'

  return (
    <>
      <p
        ref={ref}
        className={cn(
          'text-foreground text-sm wrap-break-word whitespace-pre-wrap',
          !isExpanded && clampClass,
          className
        )}
        title={text}
      >
        {text}
      </p>
      {(isOverflowing || isExpanded) && (
        <button
          type='button'
          onClick={() => setIsExpanded((v) => !v)}
          className='text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-0.5 text-xs transition-colors'
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className='size-3' />
              {t('Collapse')}
            </>
          ) : (
            <>
              <ChevronDownIcon className='size-3' />
              {t('Show full prompt')}
            </>
          )}
        </button>
      )}
    </>
  )
}
