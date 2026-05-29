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
import { useEffect, useMemo, useState } from 'react'
import { InfoIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  calculateImageSize,
  normalizeImageSize,
  parseRatio,
  type SizeTier,
} from './size'

const TIERS: SizeTier[] = ['1K', '2K', '4K']
const RATIOS = ['1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9']

interface Props {
  currentSize: string
  open: boolean
  allowAuto?: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (size: string) => void
}

type Mode = 'auto' | 'ratio' | 'resolution'

function parseSize(size: string) {
  const match = size.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/)
  if (!match) return null
  return { width: match[1], height: match[2] }
}

function findPresetForSize(size: string) {
  const normalized = normalizeImageSize(size)
  for (const tier of TIERS) {
    for (const ratio of RATIOS) {
      if (calculateImageSize(tier, ratio) === normalized) {
        return { tier, ratio }
      }
    }
  }
  return null
}

export function SizePickerModal({
  currentSize,
  open,
  allowAuto = true,
  onOpenChange,
  onSelect,
}: Props) {
  const { t } = useTranslation()

  const currentPreset = findPresetForSize(currentSize)
  const currentParsedSize = parseSize(currentSize)

  const [mode, setMode] = useState<Mode>(() => {
    if (!currentSize || currentSize === 'auto')
      return allowAuto ? 'auto' : 'ratio'
    if (currentPreset) return 'ratio'
    return 'resolution'
  })

  // Ratio mode state
  const [tier, setTier] = useState<SizeTier>(currentPreset?.tier ?? '1K')
  const [ratio, setRatio] = useState(
    currentPreset?.ratio ?? (allowAuto ? '1:1' : '4:3')
  )
  const [customRatio, setCustomRatio] = useState('16:9')

  // Resolution mode state
  const [customW, setCustomW] = useState(currentParsedSize?.width ?? '1024')
  const [customH, setCustomH] = useState(currentParsedSize?.height ?? '1024')

  // Re-seed form state whenever the modal reopens. Base UI's Dialog keeps the
  // component mounted, so useState initializers only run once; mirror them here.
  useEffect(() => {
    if (!open) return
    const preset = findPresetForSize(currentSize)
    const parsed = parseSize(currentSize)
    setMode(
      !currentSize || currentSize === 'auto'
        ? allowAuto
          ? 'auto'
          : 'ratio'
        : preset
          ? 'ratio'
          : 'resolution'
    )
    setTier(preset?.tier ?? '1K')
    setRatio(preset?.ratio ?? (allowAuto ? '1:1' : '4:3'))
    setCustomW(parsed?.width ?? '1024')
    setCustomH(parsed?.height ?? '1024')
    // leave customRatio as-is (keeps its default '16:9')
  }, [open, currentSize, allowAuto])

  const activeRatio = ratio === 'custom' ? customRatio : ratio
  const parsedCustomRatio = parseRatio(customRatio)
  const customRatioValid = ratio !== 'custom' || Boolean(parsedCustomRatio)
  const customRatioClamped = Boolean(
    ratio === 'custom' &&
    parsedCustomRatio &&
    Math.max(parsedCustomRatio.width, parsedCustomRatio.height) /
      Math.min(parsedCustomRatio.width, parsedCustomRatio.height) >
      3
  )

  const previewSize = useMemo(() => {
    if (mode === 'auto') return 'auto'

    if (mode === 'ratio') {
      const size = calculateImageSize(tier, activeRatio)
      return size ? normalizeImageSize(size) : ''
    }

    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return normalizeImageSize(`${w}x${h}`)
      }
      return ''
    }

    return ''
  }, [mode, tier, activeRatio, customW, customH])

  const isClamped = useMemo(() => {
    if (!previewSize || previewSize === 'auto') return false
    if (mode === 'ratio' && ratio === 'custom') return customRatioClamped
    if (mode === 'resolution') {
      const w = parseInt(customW, 10)
      const h = parseInt(customH, 10)
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return `${w}x${h}` !== previewSize
      }
    }
    return false
  }, [mode, ratio, customRatioClamped, customW, customH, previewSize])

  const applySize = () => {
    if (!previewSize) return
    onSelect(previewSize)
    onOpenChange(false)
  }

  const sizeLimitText = t(
    'Output is auto-normalized to a legal size: width/height multiples of 16, max edge 3840px, aspect ≤ 3:1, total pixels 655360–8294400.'
  )

  const segCls = (active: boolean) =>
    cn(
      'flex-1 rounded-md py-1.5 text-sm font-medium transition',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    )

  const tileCls = (active: boolean) =>
    cn(
      'rounded-xl border px-3 py-2.5 text-sm transition flex flex-col items-center justify-center gap-1.5',
      active
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border bg-card hover:bg-accent text-muted-foreground'
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Set image size')}</DialogTitle>
          <p className='text-muted-foreground text-xs'>
            {t('Current')}: {currentSize || 'auto'}
          </p>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Mode segmented control */}
          <div className='bg-muted flex rounded-lg p-1'>
            {allowAuto && (
              <button
                type='button'
                className={segCls(mode === 'auto')}
                onClick={() => setMode('auto')}
              >
                {t('Auto')}
              </button>
            )}
            <button
              type='button'
              className={segCls(mode === 'ratio')}
              onClick={() => setMode('ratio')}
            >
              {t('By ratio')}
            </button>
            <button
              type='button'
              className={segCls(mode === 'resolution')}
              onClick={() => setMode('resolution')}
            >
              {t('Custom size')}
            </button>
          </div>

          {/* Auto panel */}
          {mode === 'auto' && (
            <div className='flex flex-col items-center justify-center gap-2 py-8 text-center'>
              <h4 className='text-foreground text-sm font-medium'>
                {t('Auto size')}
              </h4>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'The resolution is decided by the model; no size parameter is sent.'
                )}
              </p>
            </div>
          )}

          {/* Ratio panel */}
          {mode === 'ratio' && (
            <div className='space-y-5'>
              <section>
                <div className='text-muted-foreground mb-2 text-xs font-medium'>
                  {t('Base resolution')}
                </div>
                <ToggleGroup
                  value={[tier]}
                  onValueChange={(value) => {
                    if (value[0]) setTier(value[0] as SizeTier)
                  }}
                  variant='outline'
                  className='w-full'
                >
                  {TIERS.map((item) => (
                    <ToggleGroupItem key={item} value={item} className='flex-1'>
                      {item}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </section>

              <section>
                <div className='text-muted-foreground mb-2 text-xs font-medium'>
                  {t('Aspect ratio')}
                </div>
                <div className='grid grid-cols-4 gap-2'>
                  {RATIOS.map((item) => {
                    const [w, h] = item.split(':').map(Number)
                    const isHorizontal = w > h
                    const isSquare = w === h
                    return (
                      <button
                        type='button'
                        key={item}
                        className={tileCls(ratio === item)}
                        onClick={() => setRatio(item)}
                      >
                        <div className='flex h-5 w-5 items-center justify-center'>
                          <div
                            className='rounded-[3px] border-[1.5px] border-current opacity-60'
                            style={{
                              width:
                                isHorizontal || isSquare
                                  ? '100%'
                                  : `${(w / h) * 100}%`,
                              height:
                                !isHorizontal || isSquare
                                  ? '100%'
                                  : `${(h / w) * 100}%`,
                            }}
                          />
                        </div>
                        <span className='text-xs'>{item}</span>
                      </button>
                    )
                  })}
                  <button
                    type='button'
                    className={cn(tileCls(ratio === 'custom'), 'col-span-4')}
                    onClick={() => setRatio('custom')}
                  >
                    {t('Custom ratio')}
                  </button>
                </div>
              </section>

              {ratio === 'custom' && (
                <div>
                  <label className='text-muted-foreground mb-2 block text-xs font-medium'>
                    {t('Enter a custom ratio')}
                  </label>
                  <Input
                    value={customRatio}
                    onChange={(e) => setCustomRatio(e.target.value)}
                    placeholder='5:4 / 2.39:1'
                    className={cn(
                      !customRatioValid &&
                        'border-destructive focus-visible:border-destructive'
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* Resolution panel */}
          {mode === 'resolution' && (
            <div className='space-y-5'>
              <div className='flex items-end gap-3'>
                <label className='flex-1'>
                  <span className='text-muted-foreground mb-1.5 block text-xs'>
                    {t('Width')}
                  </span>
                  <Input
                    type='number'
                    min={1}
                    step={16}
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    placeholder='1024'
                  />
                </label>
                <span className='text-muted-foreground pb-2.5'>×</span>
                <label className='flex-1'>
                  <span className='text-muted-foreground mb-1.5 block text-xs'>
                    {t('Height')}
                  </span>
                  <Input
                    type='number'
                    min={1}
                    step={16}
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    placeholder='1024'
                  />
                </label>
              </div>
              <div className='bg-muted text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed'>
                <InfoIcon className='mt-0.5 size-4 flex-shrink-0' />
                <span>{sizeLimitText}</span>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className='bg-muted rounded-lg px-4 py-3'>
            <div className='text-muted-foreground text-xs'>{t('Will use')}</div>
            <div className='mt-1 flex items-center gap-2'>
              <span className='text-foreground font-mono text-lg font-semibold'>
                {previewSize || t('Invalid size')}
              </span>
              {isClamped && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className='inline-flex cursor-help text-amber-500' />
                      }
                    >
                      <InfoIcon className='size-4' />
                    </TooltipTrigger>
                    <TooltipContent className='max-w-xs text-center'>
                      {sizeLimitText}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={applySize} disabled={!previewSize}>
            {t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
