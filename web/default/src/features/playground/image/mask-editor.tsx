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
import { EraserIcon, BrushIcon, RotateCcwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { fileToImageInputFile, imageInputFileToDataUrl } from './image-encoding'
import type { ImageInputFile } from './types'

interface MaskEditorProps {
  open: boolean
  /** The reference image the mask applies to (primary image). */
  image: ImageInputFile
  /** Existing mask to seed the editor, if any. */
  initialMask?: ImageInputFile | null
  onOpenChange: (open: boolean) => void
  onConfirm: (mask: ImageInputFile | null) => void
}

const BRUSH_SIZES = [20, 40, 80]

export function MaskEditor({
  open,
  image,
  onOpenChange,
  onConfirm,
}: MaskEditorProps) {
  const { t } = useTranslation()
  const displayRef = useRef<HTMLCanvasElement>(null)
  // Off-DOM canvas holding strokes at the image's natural resolution.
  const strokeRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [brushSize, setBrushSize] = useState(40)
  const [hasPaint, setHasPaint] = useState(false)
  const drawing = useRef(false)

  // Composite: source image + translucent red overlay of the stroke layer.
  const redraw = useCallback(() => {
    const display = displayRef.current
    const img = imgRef.current
    const stroke = strokeRef.current
    if (!display || !img || !stroke) return
    const ctx = display.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.drawImage(img, 0, 0)
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.drawImage(stroke, 0, 0)
    ctx.restore()
  }, [])

  // Load the image and size both canvases to its natural resolution.
  useEffect(() => {
    if (!open) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const stroke = document.createElement('canvas')
      stroke.width = img.naturalWidth
      stroke.height = img.naturalHeight
      strokeRef.current = stroke
      const display = displayRef.current
      if (display) {
        display.width = img.naturalWidth
        display.height = img.naturalHeight
      }
      setHasPaint(false)
      redraw()
    }
    img.src = imageInputFileToDataUrl(image)
  }, [open, image, redraw])

  const pointerToNatural = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const display = displayRef.current!
    const rect = display.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * display.width
    const y = ((e.clientY - rect.top) / rect.height) * display.height
    return { x, y }
  }

  const paintAt = useCallback(
    (x: number, y: number) => {
      const stroke = strokeRef.current
      if (!stroke) return
      const ctx = stroke.getContext('2d')
      if (!ctx) return
      ctx.globalCompositeOperation =
        tool === 'brush' ? 'source-over' : 'destination-out'
      ctx.fillStyle = '#ff3b30'
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      if (tool === 'brush') setHasPaint(true)
      redraw()
    },
    [tool, brushSize, redraw]
  )

  const handleReset = useCallback(() => {
    const stroke = strokeRef.current
    if (!stroke) return
    stroke.getContext('2d')?.clearRect(0, 0, stroke.width, stroke.height)
    setHasPaint(false)
    redraw()
  }, [redraw])

  const handleConfirm = useCallback(async () => {
    const stroke = strokeRef.current
    const img = imgRef.current
    if (!stroke || !img || !hasPaint) {
      onConfirm(null)
      onOpenChange(false)
      return
    }
    // Build mask: fully opaque everywhere, transparent where painted.
    const mask = document.createElement('canvas')
    mask.width = img.naturalWidth
    mask.height = img.naturalHeight
    const ctx = mask.getContext('2d')!
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, mask.width, mask.height)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(stroke, 0, 0)
    ctx.globalCompositeOperation = 'source-over'

    const blob: Blob = await new Promise((resolve) =>
      mask.toBlob((b) => resolve(b ?? new Blob()), 'image/png')
    )
    const file = new File([blob], 'mask.png', { type: 'image/png' })
    const maskInput = await fileToImageInputFile(file)
    onConfirm(maskInput)
    onOpenChange(false)
  }, [hasPaint, onConfirm, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Edit mask')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              size='sm'
              variant={tool === 'brush' ? 'default' : 'outline'}
              onClick={() => setTool('brush')}
            >
              <BrushIcon className='size-4' />
              {t('Brush')}
            </Button>
            <Button
              type='button'
              size='sm'
              variant={tool === 'eraser' ? 'default' : 'outline'}
              onClick={() => setTool('eraser')}
            >
              <EraserIcon className='size-4' />
              {t('Eraser')}
            </Button>
          </div>
          <div className='flex items-center gap-2'>
            <Label className='text-muted-foreground text-xs'>
              {t('Brush size')}
            </Label>
            {BRUSH_SIZES.map((s) => (
              <Button
                key={s}
                type='button'
                size='sm'
                variant={brushSize === s ? 'default' : 'outline'}
                onClick={() => setBrushSize(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Button type='button' size='sm' variant='ghost' onClick={handleReset}>
            <RotateCcwIcon className='size-4' />
            {t('Reset')}
          </Button>
        </div>

        <div className='bg-muted/30 flex max-h-[60vh] justify-center overflow-auto rounded-lg p-2'>
          <canvas
            ref={displayRef}
            className='max-h-[55vh] max-w-full cursor-crosshair touch-none'
            onPointerDown={(e) => {
              drawing.current = true
              const { x, y } = pointerToNatural(e)
              paintAt(x, y)
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return
              const { x, y } = pointerToNatural(e)
              paintAt(x, y)
            }}
            onPointerUp={() => {
              drawing.current = false
            }}
            onPointerLeave={() => {
              drawing.current = false
            }}
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('Done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
