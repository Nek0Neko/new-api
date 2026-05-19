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
import { useQuery } from '@tanstack/react-query'
import {
  ImageIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
  DownloadIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
}: {
  item: ImageGenerationItem
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const date = new Date(item.createdAt)
  const promptRef = useRef<HTMLParagraphElement>(null)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [isPromptOverflowing, setIsPromptOverflowing] = useState(false)

  useEffect(() => {
    if (isPromptExpanded) return
    const el = promptRef.current
    if (!el) return
    setIsPromptOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [item.prompt, isPromptExpanded])

  return (
    <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <p
            ref={promptRef}
            className={cn(
              'text-foreground text-sm wrap-break-word whitespace-pre-wrap',
              !isPromptExpanded && 'line-clamp-3'
            )}
            title={item.prompt}
          >
            {item.prompt}
          </p>
          {(isPromptOverflowing || isPromptExpanded) && (
            <button
              type='button'
              onClick={() => setIsPromptExpanded((v) => !v)}
              className='text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-0.5 text-xs transition-colors'
              aria-expanded={isPromptExpanded}
            >
              {isPromptExpanded ? (
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
          <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <span>{item.model}</span>
            <span>{item.size}</span>
            {item.quality !== 'standard' && <span>{item.quality}</span>}
            <span>{date.toLocaleString()}</span>
          </div>
        </div>
        <Button
          size='icon'
          variant='ghost'
          className='text-muted-foreground hover:text-destructive size-7'
          onClick={() => onDelete(item.id)}
          aria-label={t('Delete')}
        >
          <Trash2Icon className='size-4' />
        </Button>
      </div>

      {item.status === 'loading' && (
        <div className='border-border bg-muted/30 flex h-40 items-center justify-center rounded-lg border border-dashed'>
          <Loader2Icon className='text-muted-foreground size-6 animate-spin' />
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
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {item.images.map((image, idx) => {
            const src = resolveImageSrc(image)
            if (!src) return null
            return (
              <div
                key={`${item.id}-${idx}`}
                className='group bg-muted relative overflow-hidden rounded-lg'
              >
                <img
                  alt={image.revised_prompt ?? item.prompt}
                  src={src}
                  className='block h-full w-full object-cover'
                  loading='lazy'
                />
                <a
                  href={src}
                  download={`image-${item.id}-${idx}.png`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='bg-background/80 text-foreground absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-md opacity-0 backdrop-blur transition-opacity group-hover:opacity-100'
                  aria-label={t('Download')}
                >
                  <DownloadIcon className='size-4' />
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ImagePlayground() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const selectedToken = useSelectedToken()

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models'],
    queryFn: getUserModels,
  })

  const {
    config,
    items,
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
  const canSubmit = hasKey && !!prompt.trim() && !!config.model && !isGenerating

  const handleSubmit = async () => {
    if (!canSubmit) return
    const submittedPrompt = prompt
    setPrompt('')
    await submit(submittedPrompt)
  }

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
            <ImageGenItemCard key={item.id} item={item} onDelete={removeItem} />
          ))}
        </div>
      </div>

      <div className='bg-background/80 border-t backdrop-blur'>
        <div className='mx-auto w-full max-w-4xl space-y-3 px-4 py-3'>
          <Textarea
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
                  disabled={isGenerating}
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
    </div>
  )
}
