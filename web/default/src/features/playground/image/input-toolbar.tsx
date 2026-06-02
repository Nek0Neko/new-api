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
import { RatioIcon, ServerIcon, Settings2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
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

/** A single labeled row inside the settings popover: label left, control right. */
function SettingRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <Label htmlFor={htmlFor} className='text-muted-foreground text-sm'>
        {label}
      </Label>
      {children}
    </div>
  )
}

export function InputToolbar({ config, disabled, onChange }: Props) {
  const { t } = useTranslation()
  const [sizeModalOpen, setSizeModalOpen] = useState(false)
  const compressionDisabled = config.outputFormat === 'png'

  // Surface a dot on the gear when any setting differs from its default so the
  // collapsed controls don't hide active tweaks. asyncTask is excluded because
  // it has its own always-visible toggle in the toolbar.
  const hasCustomSettings =
    config.quality !== 'auto' ||
    config.outputFormat !== 'png' ||
    config.outputCompression != null ||
    config.moderation !== 'auto' ||
    config.n !== 1 ||
    config.stream

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {/* Size — primary control, opens the picker modal */}
      <Button
        type='button'
        variant='outline'
        className='h-8 gap-1.5 font-mono'
        disabled={disabled}
        onClick={() => setSizeModalOpen(true)}
      >
        <RatioIcon className='size-4 shrink-0' />
        {config.size}
      </Button>

      {/* Background task — a server-side async run, surfaced here instead of
          buried in the settings popover so it's a one-tap toggle. */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant={config.asyncTask ? 'default' : 'outline'}
                className='h-8 gap-1.5'
                disabled={disabled}
                aria-pressed={config.asyncTask}
                onClick={() => {
                  const next = !config.asyncTask
                  onChange('asyncTask', next)
                  // A task cannot stream — turning it on disables streaming.
                  if (next && config.stream) onChange('stream', false)
                }}
              >
                <ServerIcon className='size-4 shrink-0' />
                {t('Background task')}
              </Button>
            }
          />
          <TooltipContent side='top'>
            <p className='max-w-50 text-xs'>
              {t(
                'Run on the server; you can leave this page and come back for the result. Disables streaming.'
              )}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* All other generation parameters live in the settings popover */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type='button'
              variant='outline'
              className='relative h-8 gap-1.5'
              disabled={disabled}
              aria-label={t('More settings')}
            >
              <Settings2Icon className='size-4' />
              {t('Settings')}
              {hasCustomSettings && (
                <span className='bg-primary absolute -top-1 -right-1 size-2 rounded-full' />
              )}
            </Button>
          }
        />
        <PopoverContent className='w-72 space-y-3' align='start'>
          <SettingRow label={t('Quality')}>
            <Select
              value={config.quality}
              disabled={disabled}
              onValueChange={(v) => {
                if (v) onChange('quality', v as ImageConfig['quality'])
              }}
            >
              <SelectTrigger className='h-8 w-32'>
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
          </SettingRow>

          <SettingRow label={t('Format')}>
            <Select
              value={config.outputFormat}
              disabled={disabled}
              onValueChange={(v) => {
                if (!v) return
                onChange('outputFormat', v as ImageConfig['outputFormat'])
                if (v === 'png') onChange('outputCompression', null)
              }}
            >
              <SelectTrigger className='h-8 w-32'>
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
          </SettingRow>

          <SettingRow label={t('Compression')}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<div className='w-32' />}>
                  <Input
                    type='number'
                    min={0}
                    max={100}
                    step={1}
                    placeholder='0-100'
                    className='h-8 w-32'
                    disabled={disabled || compressionDisabled}
                    value={config.outputCompression ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        onChange('outputCompression', null)
                        return
                      }
                      const n = Math.max(
                        0,
                        Math.min(100, Math.floor(Number(raw)))
                      )
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
          </SettingRow>

          <SettingRow label={t('Moderation')}>
            <Select
              value={config.moderation}
              disabled={disabled}
              onValueChange={(v) => {
                if (v) onChange('moderation', v as ImageConfig['moderation'])
              }}
            >
              <SelectTrigger className='h-8 w-32'>
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
          </SettingRow>

          <SettingRow label={t('Count')}>
            <Input
              type='number'
              min={1}
              max={MAX_OUTPUT_IMAGES}
              step={1}
              className='h-8 w-32'
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
          </SettingRow>

          <div className='bg-border h-px' />

          <SettingRow label={t('Stream')} htmlFor='img-stream'>
            <Switch
              id='img-stream'
              checked={config.stream}
              disabled={disabled || config.asyncTask}
              onCheckedChange={(v) => onChange('stream', v)}
            />
          </SettingRow>

          <SettingRow label={t('Partial Images')}>
            <Select
              value={String(config.partialImages)}
              disabled={disabled || !config.stream}
              onValueChange={(v) => {
                if (v) onChange('partialImages', Number(v))
              }}
            >
              <SelectTrigger
                className={cn('h-8 w-32', !config.stream && 'opacity-50')}
              >
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
          </SettingRow>
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
