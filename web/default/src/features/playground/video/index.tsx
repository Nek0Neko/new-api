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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  VideoIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
  DownloadIcon,
  AlertCircleIcon,
  ImageIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/model-group-selector'
import { getUserModels } from '../api'
import { filterModelsByTag } from '../shared/filter-models'
import { ItemActions } from '../shared/item-actions'
import { PlaygroundLoading } from '../shared/loading'
import { PromptText } from '../shared/prompt-text'
import { TokenPicker } from '../shared/token-picker'
import { useSelectedToken } from '../shared/use-selected-token'
import type { VideoTaskItem } from './types'
import { useVideoPlayground } from './use-video-playground'

const DURATION_OPTIONS = [3, 5, 6, 8, 10]
const FPS_OPTIONS = [16, 24, 30]
const RESOLUTION_OPTIONS = [
  { label: '512×512', width: 512, height: 512 },
  { label: '720×720', width: 720, height: 720 },
  { label: '1280×720', width: 1280, height: 720 },
  { label: '720×1280', width: 720, height: 1280 },
  { label: '1920×1080', width: 1920, height: 1080 },
]

function VideoItemCard({
  item,
  onDelete,
  onEdit,
  onRegenerate,
  disableRegenerate,
}: {
  item: VideoTaskItem
  onDelete: (id: string) => void
  onEdit: (item: VideoTaskItem) => void
  onRegenerate: (item: VideoTaskItem) => void
  disableRegenerate: boolean
}) {
  const { t } = useTranslation()
  const isActive =
    item.status === 'submitting' ||
    item.status === 'queued' ||
    item.status === 'in_progress'

  return (
    <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <PromptText text={item.prompt} />
          <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <span>{item.model}</span>
            <span>
              {item.width}×{item.height}
            </span>
            <span>
              {item.duration}s @ {item.fps}fps
            </span>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </div>
          {item.taskId && (
            <p className='text-muted-foreground mt-1 font-mono text-[11px] break-all'>
              {item.taskId}
            </p>
          )}
        </div>
      </div>

      {isActive && (
        <div className='border-border bg-muted/30 flex h-32 items-center justify-center gap-2 rounded-lg border border-dashed text-sm'>
          <Loader2Icon className='text-muted-foreground size-5 animate-spin' />
          <span className='text-muted-foreground'>
            {item.status === 'submitting'
              ? t('Submitting…')
              : item.status === 'queued'
                ? t('Queued…')
                : t('Generating video…')}
          </span>
        </div>
      )}

      {item.status === 'failed' && (
        <div className='border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm'>
          <AlertCircleIcon className='size-4 shrink-0' />
          <span className='wrap-break-word'>
            {item.errorMessage ?? t('Video generation failed')}
          </span>
        </div>
      )}

      {item.status === 'succeeded' && item.url && (
        <div className='space-y-2'>
          <video
            controls
            src={item.url}
            className='bg-muted w-full rounded-lg'
            preload='metadata'
          />
          <div className='flex justify-end'>
            <a
              href={item.url}
              download={`video-${item.id}.${item.format ?? 'mp4'}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs'
            >
              <DownloadIcon className='size-3.5' />
              {t('Download')}
            </a>
          </div>
        </div>
      )}

      <div className='mt-3 flex items-center justify-end'>
        <ItemActions
          copyText={item.prompt}
          onEdit={() => onEdit(item)}
          onRegenerate={() => onRegenerate(item)}
          disableRegenerate={disableRegenerate || isActive}
          onDelete={() => onDelete(item.id)}
        />
      </div>
    </div>
  )
}

export function VideoPlayground() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const selectedToken = useSelectedToken()

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models'],
    queryFn: getUserModels,
  })

  const models = useMemo(
    () => filterModelsByTag(modelsData ?? [], 'video'),
    [modelsData]
  )

  const {
    config,
    items,
    isHydrated,
    isSubmitting,
    updateConfig,
    submit,
    removeItem,
    clearHistory,
  } = useVideoPlayground(selectedToken.key)

  useEffect(() => {
    if (models.length === 0) return
    const valid = models.some((m) => m.value === config.model)
    if (!valid) updateConfig('model', models[0].value)
  }, [models, config.model, updateConfig])
  const hasKey = !!selectedToken.key
  const resolutionValue = useMemo(
    () => `${config.width}x${config.height}`,
    [config.width, config.height]
  )
  const canSubmit =
    hasKey && !!prompt.trim() && !!config.model && !isSubmitting && isHydrated

  const handleSubmit = async () => {
    if (!canSubmit) return
    const submittedPrompt = prompt
    const submittedImage = imageUrl
    setPrompt('')
    setImageUrl('')
    await submit(submittedPrompt, submittedImage)
  }

  const handleEdit = useCallback((item: VideoTaskItem) => {
    setPrompt(item.prompt)
    setImageUrl(item.image ?? '')
    requestAnimationFrame(() => {
      const el = promptInputRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
  }, [])

  const handleRegenerate = useCallback(
    (item: VideoTaskItem) => {
      if (isSubmitting || !hasKey) return
      void submit(item.prompt, item.image ?? '')
    },
    [isSubmitting, hasKey, submit]
  )

  return (
    <div className='relative flex size-full flex-col overflow-hidden'>
      <div className='flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2'>
        <TokenPicker selected={selectedToken} />
      </div>

      <div className='flex-1 overflow-y-auto px-4 py-4 md:px-8'>
        <div className='mx-auto w-full max-w-4xl space-y-4'>
          {!hasKey && (
            <div className='border-border bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-4 text-sm'>
              {t('Select an API key above to start generating videos.')}
            </div>
          )}

          {!isHydrated ? (
            <PlaygroundLoading />
          ) : (
            <>
              {items.length === 0 && hasKey && (
                <div className='text-muted-foreground flex h-75 flex-col items-center justify-center gap-2 text-center'>
                  <VideoIcon className='size-10' />
                  <p className='text-sm'>
                    {t('Describe the video you want to generate below.')}
                  </p>
                </div>
              )}

              {items.length > 0 && (
                <div className='flex items-center justify-between'>
                  <p className='text-muted-foreground text-xs'>
                    {t('{{count}} generation(s)', { count: items.length })}
                  </p>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={clearHistory}
                    disabled={isSubmitting}
                  >
                    <Trash2Icon className='size-4' />
                    {t('Clear history')}
                  </Button>
                </div>
              )}

              {items.map((item) => (
                <VideoItemCard
                  key={item.id}
                  item={item}
                  onDelete={removeItem}
                  onEdit={handleEdit}
                  onRegenerate={handleRegenerate}
                  disableRegenerate={isSubmitting || !hasKey}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <div className='bg-background/80 border-t backdrop-blur'>
        <div className='mx-auto w-full max-w-4xl space-y-3 px-4 py-3'>
          <Textarea
            ref={promptInputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('Describe the scene, motion, style…')}
            disabled={isSubmitting || !hasKey}
            className='min-h-20 resize-none'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />

          <div className='flex items-center gap-2'>
            <ImageIcon className='text-muted-foreground size-4 shrink-0' />
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder={t(
                'Optional: first-frame image URL (image-to-video)'
              )}
              disabled={isSubmitting || !hasKey}
              className='h-8 text-sm'
            />
          </div>

          <Textarea
            value={config.negativePrompt}
            onChange={(e) => updateConfig('negativePrompt', e.target.value)}
            placeholder={t('Optional: negative prompt')}
            disabled={isSubmitting || !hasKey}
            className='min-h-10 resize-none text-xs'
          />

          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex flex-wrap items-end gap-3'>
              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Resolution')}
                </Label>
                <Select
                  value={resolutionValue}
                  onValueChange={(v) => {
                    const opt = RESOLUTION_OPTIONS.find(
                      (o) => `${o.width}x${o.height}` === v
                    )
                    if (opt) {
                      updateConfig('width', opt.width)
                      updateConfig('height', opt.height)
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='h-8 w-35'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map((o) => (
                      <SelectItem
                        key={o.label}
                        value={`${o.width}x${o.height}`}
                      >
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Duration')}
                </Label>
                <Select
                  value={String(config.duration)}
                  onValueChange={(v) => updateConfig('duration', Number(v))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='h-8 w-22.5'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}s
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('FPS')}
                </Label>
                <Select
                  value={String(config.fps)}
                  onValueChange={(v) => updateConfig('fps', Number(v))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='h-8 w-20'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FPS_OPTIONS.map((f) => (
                      <SelectItem key={f} value={String(f)}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <ModelSelector
                selectedModel={config.model}
                models={models}
                onModelChange={(v) => updateConfig('model', v)}
                disabled={isSubmitting || isLoadingModels}
              />

              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isSubmitting ? (
                  <Loader2Icon className='size-4 animate-spin' />
                ) : (
                  <SparklesIcon className='size-4' />
                )}
                {t('Generate')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
