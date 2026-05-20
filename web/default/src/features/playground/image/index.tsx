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
import { useQuery } from '@tanstack/react-query'
import {
  ImageIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
  DownloadIcon,
  AlertCircleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/model-group-selector'
import { getUserModels } from '../api'
import { ItemActions } from '../shared/item-actions'
import { PromptText } from '../shared/prompt-text'
import { TokenPicker } from '../shared/token-picker'
import { useSelectedToken } from '../shared/use-selected-token'
import type { ImageGenerationItem } from './types'
import { useImagePlayground } from './use-image-playground'

const SIZE_OPTIONS = [
  '256x256',
  '512x512',
  '1024x1024',
  '1024x1792',
  '1792x1024',
]

const QUALITY_OPTIONS = ['standard', 'hd']

const N_OPTIONS = [1, 2, 3, 4]

const PARTIAL_IMAGES_OPTIONS = [0, 1, 2, 3]

function resolveImageSrc(
  image: ImageGenerationItem['images'][number]
): string | null {
  if (image.url) return image.url
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`
  return null
}

function ImageGenItemCard({
  item,
  onDelete,
  onEdit,
  onRegenerate,
  onPreview,
  disableRegenerate,
}: {
  item: ImageGenerationItem
  onDelete: (id: string) => void
  onEdit: (item: ImageGenerationItem) => void
  onRegenerate: (item: ImageGenerationItem) => void
  onPreview: (src: string, alt: string) => void
  disableRegenerate: boolean
}) {
  const { t } = useTranslation()
  const date = new Date(item.createdAt)

  return (
    <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <PromptText text={item.prompt} />
          <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <span>{item.model}</span>
            <span>{item.size}</span>
            {item.quality !== 'standard' && <span>{item.quality}</span>}
            <span>{date.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {item.status === 'loading' && (
        <div className='border-border bg-muted/30 flex h-40 items-center justify-center rounded-lg border border-dashed'>
          <Loader2Icon className='text-muted-foreground size-6 animate-spin' />
        </div>
      )}

      {item.status === 'streaming' && (
        <div className='border-border bg-muted/30 relative overflow-hidden rounded-lg border border-dashed'>
          {item.partialImage ? (
            <img
              alt={item.prompt}
              src={`data:image/png;base64,${item.partialImage}`}
              className='block h-full w-full object-cover opacity-90'
              loading='lazy'
            />
          ) : (
            <div className='flex h-40 items-center justify-center'>
              <Loader2Icon className='text-muted-foreground size-6 animate-spin' />
            </div>
          )}
          <div className='bg-background/80 text-foreground absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs backdrop-blur'>
            <Loader2Icon className='size-3 animate-spin' />
            {t('Streaming…')}
          </div>
        </div>
      )}

      {item.status === 'error' && (
        <div className='border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm'>
          <AlertCircleIcon className='size-4 shrink-0' />
          <span className='wrap-break-word'>
            {item.errorMessage ?? t('Image generation failed')}
          </span>
        </div>
      )}

      {item.status === 'success' && item.images.length > 0 && (
        <div className='flex flex-wrap gap-3'>
          {item.images.map((image, idx) => {
            const src = resolveImageSrc(image)
            if (!src) return null
            const alt = image.revised_prompt ?? item.prompt
            return (
              <div
                key={`${item.id}-${idx}`}
                className='group bg-muted relative size-28 overflow-hidden rounded-lg sm:size-32'
              >
                <button
                  type='button'
                  onClick={() => onPreview(src, alt)}
                  className='focus-visible:ring-ring block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
                  aria-label={t('Preview')}
                >
                  <img
                    alt={alt}
                    src={src}
                    className='block h-full w-full object-cover'
                    loading='lazy'
                  />
                </button>
                <a
                  href={src}
                  download={`image-${item.id}-${idx}.png`}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                  className='bg-background/80 text-foreground absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md opacity-0 backdrop-blur transition-opacity group-hover:opacity-100'
                  aria-label={t('Download')}
                >
                  <DownloadIcon className='size-3.5' />
                </a>
              </div>
            )
          })}
        </div>
      )}

      <div className='mt-3 flex items-center justify-end'>
        <ItemActions
          copyText={item.prompt}
          onEdit={() => onEdit(item)}
          onRegenerate={() => onRegenerate(item)}
          disableRegenerate={
            disableRegenerate ||
            item.status === 'loading' ||
            item.status === 'streaming'
          }
          onDelete={() => onDelete(item.id)}
        />
      </div>
    </div>
  )
}

export function ImagePlayground() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const selectedToken = useSelectedToken()
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(
    null
  )

  const handlePreview = useCallback((src: string, alt: string) => {
    setPreview({ src, alt })
  }, [])

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models'],
    queryFn: getUserModels,
  })

  const {
    config,
    items,
    isHydrated,
    isGenerating,
    updateConfig,
    submit,
    clearHistory,
    removeItem,
  } = useImagePlayground(selectedToken.key)

  useEffect(() => {
    if (!modelsData || modelsData.length === 0) return
    const valid = modelsData.some((m) => m.value === config.model)
    if (!valid) updateConfig('model', modelsData[0].value)
  }, [modelsData, config.model, updateConfig])

  const models = modelsData ?? []
  const hasKey = !!selectedToken.key
  const canSubmit =
    hasKey && !!prompt.trim() && !!config.model && !isGenerating && isHydrated

  const handleSubmit = async () => {
    if (!canSubmit) return
    const submittedPrompt = prompt
    setPrompt('')
    await submit(submittedPrompt)
  }

  const handleEdit = useCallback((item: ImageGenerationItem) => {
    setPrompt(item.prompt)
    requestAnimationFrame(() => {
      const el = promptInputRef.current
      if (!el) return
      el.focus()
      const end = el.value.length
      el.setSelectionRange(end, end)
    })
  }, [])

  const handleRegenerate = useCallback(
    (item: ImageGenerationItem) => {
      if (isGenerating || !hasKey || !isHydrated) return
      void submit(item.prompt)
    },
    [isGenerating, hasKey, isHydrated, submit]
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
              {t('Select an API key above to start generating images.')}
            </div>
          )}

          {items.length === 0 && hasKey && (
            <div className='text-muted-foreground flex h-75 flex-col items-center justify-center gap-2 text-center'>
              <ImageIcon className='size-10' />
              <p className='text-sm'>
                {t('Describe the image you want to generate below.')}
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
                disabled={isGenerating}
              >
                <Trash2Icon className='size-4' />
                {t('Clear history')}
              </Button>
            </div>
          )}

          {items.map((item) => (
            <ImageGenItemCard
              key={item.id}
              item={item}
              onDelete={removeItem}
              onEdit={handleEdit}
              onRegenerate={handleRegenerate}
              onPreview={handlePreview}
              disableRegenerate={isGenerating || !hasKey}
            />
          ))}
        </div>
      </div>

      <div className='bg-background/80 border-t backdrop-blur'>
        <div className='mx-auto w-full max-w-4xl space-y-3 px-4 py-3'>
          <Textarea
            ref={promptInputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('Describe what you want to see…')}
            disabled={isGenerating || !hasKey}
            className='min-h-20 resize-none'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />

          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex flex-wrap items-end gap-3'>
              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Size')}
                </Label>
                <Select
                  value={config.size}
                  onValueChange={(v) => {
                    if (v) updateConfig('size', v)
                  }}
                  disabled={isGenerating}
                >
                  <SelectTrigger className='h-8 w-32.5'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Quality')}
                </Label>
                <Select
                  value={config.quality}
                  onValueChange={(v) => {
                    if (v) updateConfig('quality', v)
                  }}
                  disabled={isGenerating}
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

              <div className='flex flex-col gap-1'>
                <Label className='text-muted-foreground text-xs'>
                  {t('Count')}
                </Label>
                <Select
                  value={String(config.n)}
                  onValueChange={(v) => updateConfig('n', Number(v))}
                  disabled={isGenerating || config.stream}
                >
                  <SelectTrigger className='h-8 w-20'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {N_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex flex-col gap-1'>
                <Label
                  className='text-muted-foreground text-xs'
                  htmlFor='image-stream-toggle'
                >
                  {t('Stream')}
                </Label>
                <div className='flex h-8 items-center'>
                  <Switch
                    id='image-stream-toggle'
                    checked={config.stream}
                    onCheckedChange={(v) => updateConfig('stream', v)}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              {config.stream && (
                <div className='flex flex-col gap-1'>
                  <Label className='text-muted-foreground text-xs'>
                    {t('Partial Images')}
                  </Label>
                  <Select
                    value={String(config.partialImages)}
                    onValueChange={(v) =>
                      updateConfig('partialImages', Number(v))
                    }
                    disabled={isGenerating}
                  >
                    <SelectTrigger className='h-8 w-20'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTIAL_IMAGES_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className='flex items-center gap-2'>
              <ModelSelector
                selectedModel={config.model}
                models={models}
                onModelChange={(v) => updateConfig('model', v)}
                disabled={isGenerating || isLoadingModels}
              />

              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isGenerating ? (
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

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      >
        <DialogContent
          className='max-h-[95vh] w-auto max-w-[95vw] grid-cols-1 bg-transparent p-0 ring-0 sm:max-w-none'
          showCloseButton={false}
        >
          {preview && (
            <img
              alt={preview.alt}
              src={preview.src}
              className='block max-h-[95vh] max-w-[95vw] rounded-lg object-contain shadow-2xl'
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
