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
import { CopyIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ItemActionsProps {
  /** Text to put on the clipboard when the copy button is clicked. */
  copyText: string
  /**
   * Called when the user clicks Edit. Typically the parent loads `copyText`
   * back into its prompt textarea.
   */
  onEdit?: () => void
  /**
   * Called when the user clicks Regenerate. Typically the parent re-submits
   * with the same prompt/config without touching the textarea.
   */
  onRegenerate?: () => void
  /** Disables the regenerate button (e.g. while a job is in flight). */
  disableRegenerate?: boolean
  onDelete: () => void
  className?: string
}

/**
 * Compact icon-only action toolbar used by each playground item card.
 * Copy lives entirely in the component; Edit / Regenerate / Delete delegate
 * to the parent so behavior stays media-specific.
 */
export function ItemActions({
  copyText,
  onEdit,
  onRegenerate,
  disableRegenerate,
  onDelete,
  className,
}: ItemActionsProps) {
  const { t } = useTranslation()

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText)
      } else {
        // Fallback for very old browsers / non-secure contexts.
        const ta = document.createElement('textarea')
        ta.value = copyText
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success(t('Copied'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <Button
        size='icon'
        variant='ghost'
        className='text-muted-foreground hover:text-foreground size-7'
        onClick={handleCopy}
        aria-label={t('Copy')}
        title={t('Copy')}
      >
        <CopyIcon className='size-3.5' />
      </Button>
      {onRegenerate && (
        <Button
          size='icon'
          variant='ghost'
          className='text-muted-foreground hover:text-foreground size-7'
          onClick={onRegenerate}
          disabled={disableRegenerate}
          aria-label={t('Regenerate')}
          title={t('Regenerate')}
        >
          <RotateCcwIcon className='size-3.5' />
        </Button>
      )}
      {onEdit && (
        <Button
          size='icon'
          variant='ghost'
          className='text-muted-foreground hover:text-foreground size-7'
          onClick={onEdit}
          aria-label={t('Edit')}
          title={t('Edit')}
        >
          <PencilIcon className='size-3.5' />
        </Button>
      )}
      <Button
        size='icon'
        variant='ghost'
        className='text-muted-foreground hover:text-destructive size-7'
        onClick={onDelete}
        aria-label={t('Delete')}
        title={t('Delete')}
      >
        <Trash2Icon className='size-3.5' />
      </Button>
    </div>
  )
}
