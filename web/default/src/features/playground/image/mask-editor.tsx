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
// Canvas architecture, gesture and undo/redo logic ported from
// CookSleep/gpt_image_playground (MIT, https://github.com/CookSleep/gpt_image_playground),
// adapted from its global store to this component's prop contract.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react'
import {
  BrushIcon,
  EraserIcon,
  Redo2Icon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react'
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
import { Slider } from '@/components/ui/slider'
import { fileToImageInputFile, imageInputFileToDataUrl } from './image-encoding'
import type { ImageInputFile } from './types'
import {
  clampViewTransform,
  clientPointToCanvasPoint,
  getComfortableInitialTransform,
  getPinchTransform,
  zoomAtPoint,
  type Point,
  type ViewTransform,
} from './viewport-transform'

interface MaskEditorProps {
  open: boolean
  /** The reference image the mask applies to (primary image). */
  image: ImageInputFile
  /** Existing mask to seed the editor, if any. */
  initialMask?: ImageInputFile | null
  onOpenChange: (open: boolean) => void
  onConfirm: (mask: ImageInputFile | null) => void
}

type Tool = 'brush' | 'eraser'

interface CanvasSize {
  width: number
  height: number
}

interface PinchGesture {
  startTransform: ViewTransform
  startCentroid: Point
  startDistance: number
}

interface PanGesture {
  pointerId: number
  startPoint: Point
  startTransform: ViewTransform
}

const DEFAULT_VIEW_TRANSFORM: ViewTransform = { scale: 1, x: 0, y: 0 }
const MAX_HISTORY = 40
const DEFAULT_BRUSH_SIZE = 40
const MIN_BRUSH_SIZE = 8
const MAX_BRUSH_SIZE = 220

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function fillWhiteMask(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function centroid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function firstTwoPointers(points: Map<number, Point>): [Point, Point] | null {
  const values = Array.from(points.values())
  return values.length >= 2 ? [values[0], values[1]] : null
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  event: ReactPointerEvent<HTMLCanvasElement>
): Point {
  return clientPointToCanvasPoint(
    canvas.getBoundingClientRect(),
    { x: event.clientX, y: event.clientY },
    { width: canvas.width, height: canvas.height }
  )
}

export function MaskEditor({
  open,
  image,
  initialMask,
  onOpenChange,
  onConfirm,
}: MaskEditorProps) {
  const { t } = useTranslation()

  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const baseFrameRef = useRef<HTMLDivElement>(null)

  const activePointerIdRef = useRef<number | null>(null)
  const lastPointRef = useRef<Point | null>(null)
  const pointerPositionsRef = useRef<Map<number, Point>>(new Map())
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const panGestureRef = useRef<PanGesture | null>(null)
  const undoStackRef = useRef<ImageData[]>([])
  const redoStackRef = useRef<ImageData[]>([])
  const previewFrameRef = useRef<number | null>(null)
  const viewTransformRef = useRef<ViewTransform>(DEFAULT_VIEW_TRANSFORM)

  const [size, setSize] = useState<CanvasSize | null>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE)
  const [viewTransform, setViewTransform] = useState<ViewTransform>(
    DEFAULT_VIEW_TRANSFORM
  )
  const [isReady, setIsReady] = useState(false)
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 })
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const [isAltKeyPressed, setIsAltKeyPressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  // Keep brush size accessible from the imperative drawing functions.
  const brushSizeRef = useRef(brushSize)
  const toolRef = useRef(tool)
  useEffect(() => {
    brushSizeRef.current = brushSize
  }, [brushSize])
  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    })
  }, [])

  const renderPreviewNow = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    const previewCanvas = previewCanvasRef.current
    if (!maskCanvas || !previewCanvas) return
    const ctx = previewCanvas.getContext('2d')
    if (!ctx) return

    previewFrameRef.current = null
    ctx.save()
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(59, 130, 246, 0.58)'
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height)
    // Blue shows only where the mask is transparent (= the edit region).
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.restore()
  }, [])

  const renderPreview = useCallback(() => {
    if (previewFrameRef.current != null) return
    previewFrameRef.current = window.requestAnimationFrame(renderPreviewNow)
  }, [renderPreviewNow])

  const updateCursor = useCallback((point: Point | null) => {
    const cursorCanvas = cursorCanvasRef.current
    const stage = stageRef.current
    const frame = baseFrameRef.current
    const maskCanvas = maskCanvasRef.current
    const ctx = cursorCanvas?.getContext('2d')
    if (!cursorCanvas || !ctx || !stage || !frame || !maskCanvas) return

    const dpr = window.devicePixelRatio || 1
    const width = stage.clientWidth
    const height = stage.clientHeight
    if (
      cursorCanvas.width !== Math.round(width * dpr) ||
      cursorCanvas.height !== Math.round(height * dpr)
    ) {
      cursorCanvas.width = Math.round(width * dpr)
      cursorCanvas.height = Math.round(height * dpr)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!point) return

    const transform = viewTransformRef.current
    const scale = transform.scale
    const stageRect = stage.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    const frameLeft = frameRect.left - stageRect.left
    const frameTop = frameRect.top - stageRect.top
    const x =
      frameLeft +
      (point.x / maskCanvas.width) * frame.clientWidth * scale +
      transform.x
    const y =
      frameTop +
      (point.y / maskCanvas.height) * frame.clientHeight * scale +
      transform.y
    const radius =
      (brushSizeRef.current / 2 / maskCanvas.width) * frame.clientWidth * scale

    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.arc(x, y, radius + 1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()

    const crosshairSize = 5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.moveTo(x - crosshairSize, y)
    ctx.lineTo(x + crosshairSize, y)
    ctx.moveTo(x, y - crosshairSize)
    ctx.lineTo(x, y + crosshairSize)
    ctx.stroke()
    ctx.restore()
  }, [])

  const commitViewTransform = useCallback((next: ViewTransform) => {
    const frame = baseFrameRef.current
    const clamped = frame
      ? clampViewTransform(next, {
          width: frame.clientWidth,
          height: frame.clientHeight,
        })
      : next
    viewTransformRef.current = clamped
    setViewTransform(clamped)
  }, [])

  const restoreMask = useCallback(
    (imageData: ImageData) => {
      const canvas = maskCanvasRef.current
      const ctx = canvas?.getContext('2d', { willReadFrequently: true })
      if (!canvas || !ctx) return
      ctx.putImageData(imageData, 0, 0)
      renderPreview()
    },
    [renderPreview]
  )

  const pushUndoSnapshot = useCallback(() => {
    const canvas = maskCanvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx) return
    undoStackRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    )
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift()
    redoStackRef.current = []
    syncHistoryState()
  }, [syncHistoryState])

  const drawAt = useCallback(
    (point: Point) => {
      const canvas = maskCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.save()
      // Brush removes alpha (-> edit region); eraser restores white (preserve).
      ctx.globalCompositeOperation =
        toolRef.current === 'brush' ? 'destination-out' : 'source-over'
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(point.x, point.y, brushSizeRef.current / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      renderPreview()
    },
    [renderPreview]
  )

  const drawStroke = useCallback(
    (from: Point, to: Point) => {
      const canvas = maskCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.save()
      ctx.globalCompositeOperation =
        toolRef.current === 'brush' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = brushSizeRef.current
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.restore()
      renderPreview()
    },
    [renderPreview]
  )

  // Load image + seed all four canvases on open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsReady(false)
    undoStackRef.current = []
    redoStackRef.current = []
    syncHistoryState()
    pointerPositionsRef.current.clear()
    pinchGestureRef.current = null
    panGestureRef.current = null
    activePointerIdRef.current = null
    lastPointRef.current = null
    setIsPanning(false)
    setHoverPoint(null)
    viewTransformRef.current = DEFAULT_VIEW_TRANSFORM
    setViewTransform(DEFAULT_VIEW_TRANSFORM)

    async function load() {
      try {
        const img = await loadImageElement(imageInputFileToDataUrl(image))
        if (cancelled) return
        const nextSize = {
          width: img.naturalWidth,
          height: img.naturalHeight,
        }
        const imageCanvas = imageCanvasRef.current
        const previewCanvas = previewCanvasRef.current
        const maskCanvas = maskCanvasRef.current
        if (!imageCanvas || !previewCanvas || !maskCanvas) return

        for (const canvas of [imageCanvas, previewCanvas, maskCanvas]) {
          canvas.width = nextSize.width
          canvas.height = nextSize.height
        }

        const imageCtx = imageCanvas.getContext('2d')
        if (imageCtx) {
          imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height)
          imageCtx.drawImage(img, 0, 0)
        }

        fillWhiteMask(maskCanvas)

        if (initialMask) {
          try {
            const maskImg = await loadImageElement(
              imageInputFileToDataUrl(initialMask)
            )
            if (cancelled) return
            const maskCtx = maskCanvas.getContext('2d', {
              willReadFrequently: true,
            })
            if (maskCtx) {
              maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
              maskCtx.imageSmoothingEnabled = true
              maskCtx.imageSmoothingQuality = 'high'
              maskCtx.drawImage(
                maskImg,
                0,
                0,
                maskCanvas.width,
                maskCanvas.height
              )
            }
          } catch {
            fillWhiteMask(maskCanvas)
          }
        }

        renderPreview()
        setSize(nextSize)
        setIsReady(true)

        requestAnimationFrame(() => {
          const frame = baseFrameRef.current
          const stage = stageRef.current
          const isCompact =
            typeof window !== 'undefined' &&
            window.matchMedia('(max-width: 1023px)').matches
          if (frame && stage) {
            commitViewTransform(
              getComfortableInitialTransform(
                { width: frame.clientWidth, height: frame.clientHeight },
                { width: stage.clientWidth, height: stage.clientHeight },
                isCompact
              )
            )
          }
        })
      } catch {
        if (!cancelled) onOpenChange(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (previewFrameRef.current != null) {
        window.cancelAnimationFrame(previewFrameRef.current)
        previewFrameRef.current = null
      }
    }
  }, [
    open,
    image,
    initialMask,
    commitViewTransform,
    renderPreview,
    syncHistoryState,
    onOpenChange,
  ])

  // Track Alt key for pan affordance.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) setIsAltKeyPressed(true)
      const mod = event.ctrlKey || event.metaKey
      if (mod && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault()
        if (event.shiftKey) handleRedoRef.current()
        else handleUndoRef.current()
      } else if (mod && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault()
        handleRedoRef.current()
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setIsAltKeyPressed(false)
    }
    const handleBlur = () => setIsAltKeyPressed(false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [open])

  // Re-render the cursor preview whenever the relevant state changes.
  useEffect(() => {
    if (isAltKeyPressed) updateCursor(null)
    else updateCursor(hoverPoint)
  }, [brushSize, viewTransform, hoverPoint, isAltKeyPressed, updateCursor])

  const beginPinchGesture = useCallback(() => {
    const pointers = firstTwoPointers(pointerPositionsRef.current)
    const frame = baseFrameRef.current
    if (!pointers || !frame) return
    const rect = frame.getBoundingClientRect()
    const c = centroid(pointers[0], pointers[1])
    pinchGestureRef.current = {
      startTransform: viewTransformRef.current,
      startCentroid: { x: c.x - rect.left, y: c.y - rect.top },
      startDistance: distance(pointers[0], pointers[1]),
    }
  }, [])

  const updatePinchGesture = useCallback(() => {
    const pointers = firstTwoPointers(pointerPositionsRef.current)
    const gesture = pinchGestureRef.current
    const frame = baseFrameRef.current
    if (!pointers || !gesture || !frame) return
    const rect = frame.getBoundingClientRect()
    const c = centroid(pointers[0], pointers[1])
    commitViewTransform(
      getPinchTransform({
        startTransform: gesture.startTransform,
        startCentroid: gesture.startCentroid,
        nextCentroid: { x: c.x - rect.left, y: c.y - rect.top },
        startDistance: gesture.startDistance,
        nextDistance: distance(pointers[0], pointers[1]),
        viewportSize: { width: frame.clientWidth, height: frame.clientHeight },
      })
    )
  }, [commitViewTransform])

  const cancelActiveStroke = useCallback(() => {
    if (activePointerIdRef.current == null) return
    const previous = undoStackRef.current.pop()
    if (previous) restoreMask(previous)
    activePointerIdRef.current = null
    lastPointRef.current = null
    syncHistoryState()
  }, [restoreMask, syncHistoryState])

  const handleUndo = useCallback(() => {
    const canvas = maskCanvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    const previous = undoStackRef.current.pop()
    if (!canvas || !ctx || !previous) return
    redoStackRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    )
    restoreMask(previous)
    syncHistoryState()
  }, [restoreMask, syncHistoryState])

  const handleRedo = useCallback(() => {
    const canvas = maskCanvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    const next = redoStackRef.current.pop()
    if (!canvas || !ctx || !next) return
    undoStackRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height)
    )
    restoreMask(next)
    syncHistoryState()
  }, [restoreMask, syncHistoryState])

  // Stable refs so keyboard handler always sees the latest callbacks.
  const handleUndoRef = useRef(handleUndo)
  const handleRedoRef = useRef(handleRedo)
  useEffect(() => {
    handleUndoRef.current = handleUndo
    handleRedoRef.current = handleRedo
  }, [handleUndo, handleRedo])

  const handleClear = useCallback(() => {
    const canvas = maskCanvasRef.current
    if (!canvas || !isReady) return
    pushUndoSnapshot()
    fillWhiteMask(canvas)
    renderPreview()
  }, [isReady, pushUndoSnapshot, renderPreview])

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isReady || (event.pointerType !== 'touch' && event.button !== 0))
      return
    event.preventDefault()
    const canvas = event.currentTarget

    if (event.altKey) {
      if (!canvas.hasPointerCapture(event.pointerId)) {
        canvas.setPointerCapture(event.pointerId)
      }
      panGestureRef.current = {
        pointerId: event.pointerId,
        startPoint: { x: event.clientX, y: event.clientY },
        startTransform: viewTransformRef.current,
      }
      setIsPanning(true)
      updateCursor(null)
      return
    }

    pointerPositionsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (!canvas.hasPointerCapture(event.pointerId)) {
      canvas.setPointerCapture(event.pointerId)
    }

    if (pointerPositionsRef.current.size >= 2) {
      cancelActiveStroke()
      beginPinchGesture()
      return
    }

    activePointerIdRef.current = event.pointerId
    pushUndoSnapshot()
    const point = getCanvasPoint(canvas, event)
    lastPointRef.current = point
    drawAt(point)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event.currentTarget, event)
    if (event.pointerType !== 'touch') {
      setHoverPoint(point)
      updateCursor(event.altKey || isAltKeyPressed ? null : point)
    }

    const panGesture = panGestureRef.current
    if (panGesture?.pointerId === event.pointerId) {
      event.preventDefault()
      commitViewTransform({
        scale: panGesture.startTransform.scale,
        x:
          panGesture.startTransform.x + event.clientX - panGesture.startPoint.x,
        y:
          panGesture.startTransform.y + event.clientY - panGesture.startPoint.y,
      })
      return
    }

    if (pointerPositionsRef.current.has(event.pointerId)) {
      pointerPositionsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
    }
    if (pinchGestureRef.current && pointerPositionsRef.current.size >= 2) {
      event.preventDefault()
      updatePinchGesture()
      return
    }
    if (
      activePointerIdRef.current !== event.pointerId ||
      !lastPointRef.current ||
      !isReady
    )
      return
    event.preventDefault()
    drawStroke(lastPointRef.current, point)
    lastPointRef.current = point
  }

  const handlePointerLeave = () => {
    setHoverPoint(null)
    updateCursor(null)
  }

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pointerPositionsRef.current.delete(event.pointerId)

    if (pinchGestureRef.current) {
      if (pointerPositionsRef.current.size >= 2) beginPinchGesture()
      else pinchGestureRef.current = null
    }

    if (panGestureRef.current?.pointerId === event.pointerId) {
      panGestureRef.current = null
      setIsPanning(false)
    }

    if (activePointerIdRef.current === event.pointerId) {
      activePointerIdRef.current = null
      lastPointRef.current = null
    }
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.altKey || !isReady) return
    const frame = baseFrameRef.current
    if (!frame) return
    event.preventDefault()
    const rect = frame.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const scaleFactor = Math.exp(-event.deltaY * 0.002)
    commitViewTransform(
      zoomAtPoint(
        viewTransformRef.current,
        point,
        viewTransformRef.current.scale * scaleFactor,
        { width: frame.clientWidth, height: frame.clientHeight }
      )
    )
  }

  const handleConfirm = useCallback(async () => {
    const canvas = maskCanvasRef.current
    if (!canvas || !isReady) {
      onConfirm(null)
      onOpenChange(false)
      return
    }

    // Detect whether any edit (transparent) pixels exist.
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let hasEditRegion = false
    if (ctx) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          hasEditRegion = true
          break
        }
      }
    }

    if (!hasEditRegion) {
      onConfirm(null)
      onOpenChange(false)
      return
    }

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b ?? new Blob()), 'image/png')
    )
    const file = new File([blob], 'mask.png', { type: 'image/png' })
    const maskInput = await fileToImageInputFile(file)
    onConfirm(maskInput)
    onOpenChange(false)
  }, [isReady, onConfirm, onOpenChange])

  const canUndo = historyState.undo > 0 && isReady
  const canRedo = historyState.redo > 0 && isReady

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
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

          <div className='flex min-w-[180px] flex-1 items-center gap-2'>
            <Label className='text-muted-foreground text-xs whitespace-nowrap'>
              {t('Brush size')}
            </Label>
            <Slider
              className='flex-1'
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              value={brushSize}
              onValueChange={(value) =>
                setBrushSize(Array.isArray(value) ? value[0] : value)
              }
            />
            <span className='text-muted-foreground w-8 text-right text-xs tabular-nums'>
              {brushSize}
            </span>
          </div>

          <div className='flex items-center gap-1'>
            <Button
              type='button'
              size='icon'
              variant='outline'
              disabled={!canUndo}
              onClick={handleUndo}
              title={t('Undo')}
            >
              <Undo2Icon className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='outline'
              disabled={!canRedo}
              onClick={handleRedo}
              title={t('Redo')}
            >
              <Redo2Icon className='size-4' />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              disabled={!isReady}
              onClick={handleClear}
              title={t('Clear')}
            >
              <Trash2Icon className='size-4' />
            </Button>
          </div>
        </div>

        <div
          ref={stageRef}
          className='bg-muted/30 relative flex h-[55vh] items-center justify-center overflow-hidden rounded-lg p-2'
        >
          <div
            ref={baseFrameRef}
            className='relative touch-none'
            onWheel={handleWheel}
            style={{
              aspectRatio: size ? `${size.width} / ${size.height}` : '1 / 1',
              maxWidth: '100%',
              maxHeight: '100%',
              width: size
                ? `min(100%, ${(size.width / size.height) * 100}cqh)`
                : '100%',
            }}
          >
            <div
              className='absolute inset-0 will-change-transform'
              style={{
                transform: `matrix(${viewTransform.scale}, 0, 0, ${viewTransform.scale}, ${viewTransform.x}, ${viewTransform.y})`,
                transformOrigin: '0 0',
              }}
            >
              <canvas
                ref={imageCanvasRef}
                className='absolute inset-0 h-full w-full'
              />
              <canvas
                ref={previewCanvasRef}
                className='pointer-events-none absolute inset-0 h-full w-full'
              />
              <canvas
                ref={maskCanvasRef}
                className='absolute inset-0 h-full w-full touch-none opacity-0 select-none'
                style={{
                  cursor: isPanning
                    ? 'grabbing'
                    : isAltKeyPressed
                      ? 'grab'
                      : hoverPoint
                        ? 'none'
                        : 'crosshair',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                onLostPointerCapture={finishStroke}
                onPointerLeave={handlePointerLeave}
              />
            </div>
          </div>
          <canvas
            ref={cursorCanvasRef}
            className='pointer-events-none absolute inset-0 h-full w-full'
          />
        </div>

        <p className='text-muted-foreground text-center text-xs'>
          {t('Alt + scroll to zoom, Alt + drag to pan')}
        </p>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm}>{t('Confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
