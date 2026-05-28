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
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  RefreshCwIcon,
  RotateCcwIcon,
  RotateCwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useImageTransform } from './use-image-transform'

export interface ImageViewerItem {
  src: string
  alt?: string
  caption?: string
  downloadName?: string
}

export interface ImageViewerProps {
  images: ImageViewerItem[]
  index?: number
  onIndexChange?: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
}

export function ImageViewer({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
  title,
}: ImageViewerProps) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ x: number; y: number } | null>(null)

  const [activeIndex, setActiveIndex] = useState(index ?? 0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const {
    transform,
    reset,
    zoomAtPoint,
    zoomIn,
    zoomOut,
    panBy,
    rotateLeft,
    rotateRight,
    flipHorizontal,
    flipVertical,
  } = useImageTransform()

  const count = images.length
  const hasMultiple = count > 1
  const current = count > 0 ? images[Math.min(activeIndex, count - 1)] : undefined
  const hasImage = current !== undefined

  // Controlled usage: parent drives the active image via `index` and updates it
  // from onIndexChange. When `index` is omitted, the viewer manages it internally.
  useEffect(() => {
    if (index !== undefined) setActiveIndex(index)
  }, [index])

  // Reset transform + load state when opening or switching image.
  useEffect(() => {
    if (!open) return
    reset()
    setIsLoading(true)
    setHasError(false)
  }, [open, activeIndex, current?.src, reset])

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return
      const clamped = (next + count) % count
      setActiveIndex(clamped)
      onIndexChange?.(clamped)
    },
    [count, onIndexChange]
  )
  const goPrev = useCallback(
    () => goTo(activeIndex - 1),
    [goTo, activeIndex]
  )
  const goNext = useCallback(
    () => goTo(activeIndex + 1),
    [goTo, activeIndex]
  )

  // Keyboard: arrows to navigate, +/- to zoom.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasMultiple) goPrev()
      else if (e.key === 'ArrowRight' && hasMultiple) goNext()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-' || e.key === '_') zoomOut()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hasMultiple, goPrev, goNext, zoomIn, zoomOut])

  // Cursor-anchored wheel zoom (non-passive so preventDefault works).
  useEffect(() => {
    const el = stageRef.current
    if (!el || !open) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left - rect.width / 2
      const py = e.clientY - rect.top - rect.height / 2
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      zoomAtPoint(factor, px, py)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, zoomAtPoint, hasImage])

  const canPan = transform.scale > 1

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (!canPan) return
    dragState.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.x
    const dy = e.clientY - dragState.current.y
    dragState.current = { x: e.clientX, y: e.clientY }
    panBy(dx, dy)
  }
  const endDrag = (e: ReactPointerEvent) => {
    if (!dragState.current) return
    dragState.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const handleDownload = () => {
    if (!current) return
    const a = document.createElement('a')
    a.href = current.src
    a.download = current.downloadName ?? 'image'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className='flex h-[92vh] w-[92vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none'
      >
        <DialogTitle className='sr-only'>
          {title ?? t('Image Preview')}
        </DialogTitle>

        {/* Toolbar */}
        <div className='flex items-center justify-between gap-2 border-b px-3 py-2'>
          <div className='text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs'>
            {current.caption}
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={zoomOut}
              aria-label={t('Zoom out')}
              title={t('Zoom out')}
            >
              <ZoomOutIcon />
            </Button>
            <span className='text-muted-foreground w-12 text-center text-xs tabular-nums'>
              {Math.round(transform.scale * 100)}%
            </span>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={zoomIn}
              aria-label={t('Zoom in')}
              title={t('Zoom in')}
            >
              <ZoomInIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={rotateLeft}
              aria-label={t('Rotate left')}
              title={t('Rotate left')}
            >
              <RotateCcwIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={rotateRight}
              aria-label={t('Rotate right')}
              title={t('Rotate right')}
            >
              <RotateCwIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={flipHorizontal}
              aria-label={t('Flip horizontal')}
              title={t('Flip horizontal')}
            >
              <FlipHorizontal2Icon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={flipVertical}
              aria-label={t('Flip vertical')}
              title={t('Flip vertical')}
            >
              <FlipVertical2Icon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={reset}
              aria-label={t('Reset')}
              title={t('Reset')}
            >
              <RefreshCwIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={handleDownload}
              aria-label={t('Download')}
              title={t('Download')}
            >
              <DownloadIcon />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => onOpenChange(false)}
              aria-label={t('Close')}
              title={t('Close')}
            >
              <XIcon />
            </Button>
          </div>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className='bg-muted/30 relative flex flex-1 items-center justify-center overflow-hidden select-none'
        >
          {(isLoading || hasError) && (
            <Skeleton className='absolute inset-[12%] rounded-lg' />
          )}

          <img
            key={current.src}
            src={current.src}
            alt={current.alt ?? ''}
            draggable={false}
            onLoad={() => {
              setIsLoading(false)
              setHasError(false)
            }}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() =>
              transform.scale > 1 ? reset() : zoomAtPoint(2, 0, 0)
            }
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity duration-150',
              isLoading || hasError ? 'opacity-0' : 'opacity-100',
              canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
            )}
            style={{
              transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale}) rotate(${transform.rotation}deg) scaleX(${transform.flipX ? -1 : 1}) scaleY(${transform.flipY ? -1 : 1})`,
            }}
          />

          {hasError && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Failed to load image')}
              </p>
            </div>
          )}

          {hasMultiple && (
            <>
              <Button
                variant='outline'
                size='icon'
                onClick={goPrev}
                aria-label={t('Previous image')}
                className='absolute top-1/2 left-3 -translate-y-1/2 rounded-full'
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant='outline'
                size='icon'
                onClick={goNext}
                aria-label={t('Next image')}
                className='absolute top-1/2 right-3 -translate-y-1/2 rounded-full'
              >
                <ChevronRightIcon />
              </Button>
              <div className='bg-background/80 text-foreground absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs tabular-nums backdrop-blur'>
                {activeIndex + 1} / {count}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
