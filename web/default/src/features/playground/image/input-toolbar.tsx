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
import { useState } from 'react'
import { Settings2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SizePickerModal } from './size-picker-modal'
import type { ImageConfig } from './types'

const QUALITY_OPTIONS: ImageConfig['quality'][] = [
  'auto',
  'low',
  'medium',
  'high',
]
const FORMAT_OPTIONS: ImageConfig['outputFormat'][] = ['png', 'jpeg', 'webp']
const MODERATION_OPTIONS: ImageConfig['moderation'][] = ['auto', 'low']
export const MAX_OUTPUT_IMAGES = 10

interface Props {
  config: ImageConfig
  disabled: boolean
  onChange: <K extends keyof ImageConfig>(key: K, value: ImageConfig[K]) => void
}

export function InputToolbar({ config, disabled, onChange }: Props) {
  const { t } = useTranslation()
  const [sizeModalOpen, setSizeModalOpen] = useState(false)
  const compressionDisabled = config.outputFormat === 'png'

  return (
    <div className='flex flex-wrap items-end gap-3'>
      {/* Size */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>{t('Size')}</Label>
        <Button
          type='button'
          variant='outline'
          className='h-8 w-32.5 justify-start font-mono'
          disabled={disabled}
          onClick={() => setSizeModalOpen(true)}
        >
          {config.size}
        </Button>
      </div>

      {/* Quality */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>{t('Quality')}</Label>
        <Select
          value={config.quality}
          disabled={disabled}
          onValueChange={(v) => {
            if (v) onChange('quality', v as ImageConfig['quality'])
          }}
        >
          <SelectTrigger className='h-8 w-27.5'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUALITY_OPTIONS.map((q) => (
              <SelectItem key={q} value={q}>
                {q}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Format */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>{t('Format')}</Label>
        <Select
          value={config.outputFormat}
          disabled={disabled}
          onValueChange={(v) => {
            if (!v) return
            onChange('outputFormat', v as ImageConfig['outputFormat'])
            if (v === 'png') onChange('outputCompression', null)
          }}
        >
          <SelectTrigger className='h-8 w-24'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Compression */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>
          {t('Compression')}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<div />}>
              <Input
                type='number'
                min={0}
                max={100}
                step={1}
                placeholder='0-100'
                className='h-8 w-24'
                disabled={disabled || compressionDisabled}
                value={config.outputCompression ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    onChange('outputCompression', null)
                    return
                  }
                  const n = Math.max(0, Math.min(100, Math.floor(Number(raw))))
                  if (Number.isFinite(n)) onChange('outputCompression', n)
                }}
              />
            </TooltipTrigger>
            {compressionDisabled && (
              <TooltipContent side='top'>
                <p className='text-xs'>
                  {t('Only JPEG and WebP support compression')}
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Moderation */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>
          {t('Moderation')}
        </Label>
        <Select
          value={config.moderation}
          disabled={disabled}
          onValueChange={(v) => {
            if (v) onChange('moderation', v as ImageConfig['moderation'])
          }}
        >
          <SelectTrigger className='h-8 w-24'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODERATION_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      <div className='flex flex-col gap-1'>
        <Label className='text-muted-foreground text-xs'>{t('Count')}</Label>
        <Input
          type='number'
          min={1}
          max={MAX_OUTPUT_IMAGES}
          step={1}
          className='h-8 w-20'
          disabled={disabled || config.stream}
          value={config.n}
          onChange={(e) => {
            const n = Math.max(
              1,
              Math.min(
                MAX_OUTPUT_IMAGES,
                Math.floor(Number(e.target.value) || 1)
              )
            )
            onChange('n', n)
          }}
        />
      </div>

      {/* More settings */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-8 w-8 self-end'
              disabled={disabled}
              aria-label={t('More settings')}
            >
              <Settings2Icon className='size-4' />
            </Button>
          }
        />
        <PopoverContent className='w-56 space-y-3'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='img-stream' className='text-sm'>
              {t('Stream')}
            </Label>
            <Switch
              id='img-stream'
              checked={config.stream}
              disabled={disabled}
              onCheckedChange={(v) => onChange('stream', v)}
            />
          </div>
          {config.stream && (
            <div className='flex flex-col gap-1'>
              <Label className='text-muted-foreground text-xs'>
                {t('Partial Images')}
              </Label>
              <Select
                value={String(config.partialImages)}
                disabled={disabled}
                onValueChange={(v) => {
                  if (v) onChange('partialImages', Number(v))
                }}
              >
                <SelectTrigger className='h-8'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <SizePickerModal
        open={sizeModalOpen}
        currentSize={config.size}
        onOpenChange={setSizeModalOpen}
        onSelect={(size) => onChange('size', size)}
      />
    </div>
  )
}
