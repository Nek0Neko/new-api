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
  Music2Icon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
  DownloadIcon,
  AlertCircleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/model-group-selector'
import { getUserModels } from '../api'
import { filterModelsByTag } from '../shared/filter-models'
import { ItemActions } from '../shared/item-actions'
import { PlaygroundLoading } from '../shared/loading'
import { PromptText } from '../shared/prompt-text'
import { TokenPicker } from '../shared/token-picker'
import { useSelectedToken } from '../shared/use-selected-token'
import type { MusicMode, MusicTaskItem } from './types'
import { useMusicPlayground } from './use-music-playground'

function MusicItemCard({
  item,
  onDelete,
  onEdit,
  onRegenerate,
  disableRegenerate,
}: {
  item: MusicTaskItem
  onDelete: (id: string) => void
  onEdit: (item: MusicTaskItem) => void
  onRegenerate: (item: MusicTaskItem) => void
  disableRegenerate: boolean
}) {
  const { t } = useTranslation()
  const isActive =
    item.status === 'submitting' ||
    item.status === 'queued' ||
    item.status === 'in_progress'

  const header =
    item.mode === 'description'
      ? item.description
      : item.title || item.prompt.split('\n')[0]
  const fullPromptText =
    item.mode === 'description' ? item.description : item.prompt

  return (
    <div className='border-border bg-card rounded-xl border p-4 shadow-sm'>
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <PromptText text={header} />
          <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <span>
              {item.mode === 'description' ? t('Description') : t('Custom')}
            </span>
            {item.model && <span>{item.model}</span>}
            {item.tags && <span>{item.tags}</span>}
            {item.makeInstrumental && <span>{t('Instrumental')}</span>}
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {isActive && (
        <div className='border-border bg-muted/30 flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed text-sm'>
          <Loader2Icon className='text-muted-foreground size-5 animate-spin' />
          <span className='text-muted-foreground'>
            {item.status === 'submitting'
              ? t('Submitting…')
              : item.status === 'queued'
                ? t('Queued…')
                : t('Composing music…')}
          </span>
        </div>
      )}

      {item.status === 'failed' && (
        <div className='border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm'>
          <AlertCircleIcon className='size-4 shrink-0' />
          <span className='wrap-break-word'>
            {item.errorMessage ?? t('Music generation failed')}
          </span>
        </div>
      )}

      {item.status === 'succeeded' && item.clips.length > 0 && (
        <div className='space-y-3'>
          {item.clips.map((clip) => (
            <div
              key={clip.id}
              className='bg-muted/30 flex flex-col gap-3 rounded-lg p-3 sm:flex-row'
            >
              {clip.imageUrl ? (
                <img
                  src={clip.imageUrl}
                  alt={clip.title ?? 'cover'}
                  className='bg-background size-24 shrink-0 rounded-md object-cover'
                  loading='lazy'
                />
              ) : (
                <div className='bg-background flex size-24 shrink-0 items-center justify-center rounded-md'>
                  <Music2Icon className='text-muted-foreground size-8' />
                </div>
              )}

              <div className='min-w-0 flex-1 space-y-2'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='text-foreground line-clamp-1 text-sm font-medium'>
                    {clip.title ?? t('Untitled')}
                  </p>
                  {clip.audioUrl && (
                    <a
                      href={clip.audioUrl}
                      download={`${clip.title ?? clip.id}.mp3`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-foreground hover:bg-background inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs'
                    >
                      <DownloadIcon className='size-3.5' />
                      {t('Download')}
                    </a>
                  )}
                </div>

                {clip.audioUrl && (
                  <audio
                    controls
                    src={clip.audioUrl}
                    className='w-full'
                    preload='none'
                  />
                )}

                {clip.lyrics && (
                  <details className='text-muted-foreground text-xs'>
                    <summary className='cursor-pointer select-none'>
                      {t('Lyrics')}
                    </summary>
                    <pre className='mt-1 font-sans wrap-break-word whitespace-pre-wrap'>
                      {clip.lyrics}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className='mt-3 flex items-center justify-end'>
        <ItemActions
          copyText={fullPromptText}
          onEdit={() => onEdit(item)}
          onRegenerate={() => onRegenerate(item)}
          disableRegenerate={disableRegenerate || isActive}
          onDelete={() => onDelete(item.id)}
        />
      </div>
    </div>
  )
}

export function MusicPlayground() {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const selectedToken = useSelectedToken()

  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: ['playground-models'],
    queryFn: getUserModels,
  })

  const models = useMemo(
    () => filterModelsByTag(modelsData ?? [], 'music'),
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
  } = useMusicPlayground(selectedToken.key)

  useEffect(() => {
    if (models.length === 0) return
    const sunoLike = models.find((m) => m.value.toLowerCase().includes('suno'))
    const valid = models.some((m) => m.value === config.model)
    if (!valid) updateConfig('model', sunoLike?.value ?? models[0].value)
  }, [models, config.model, updateConfig])
  const hasKey = !!selectedToken.key
  const canSubmit =
    hasKey &&
    !isSubmitting &&
    isHydrated &&
    (config.mode === 'description' ? !!description.trim() : !!prompt.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    const isDescriptionMode = config.mode === 'description'
    const submittedDescription = description
    const submittedPrompt = prompt
    if (isDescriptionMode) setDescription('')
    else setPrompt('')
    await submit({
      description: submittedDescription,
      prompt: submittedPrompt,
    })
  }

  const handleEdit = useCallback(
    (item: MusicTaskItem) => {
      updateConfig('mode', item.mode)
      updateConfig('title', item.title)
      updateConfig('tags', item.tags)
      updateConfig('makeInstrumental', item.makeInstrumental)
      if (item.model) updateConfig('model', item.model)
      if (item.mode === 'description') {
        setDescription(item.description)
        setPrompt('')
      } else {
        setPrompt(item.prompt)
        setDescription('')
      }
      requestAnimationFrame(() => {
        const el =
          item.mode === 'description'
            ? descriptionInputRef.current
            : promptInputRef.current
        if (!el) return
        el.focus()
        const end = el.value.length
        el.setSelectionRange(end, end)
      })
    },
    [updateConfig]
  )

  const handleRegenerate = useCallback(
    (item: MusicTaskItem) => {
      if (isSubmitting || !hasKey) return
      void submit({
        description: item.description,
        prompt: item.prompt,
        overrideConfig: {
          mode: item.mode,
          model: item.model || config.model,
          title: item.title,
          tags: item.tags,
          makeInstrumental: item.makeInstrumental,
        },
      })
    },
    [isSubmitting, hasKey, submit, config.model]
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
              {t('Select an API key above to start creating music.')}
            </div>
          )}

          {!isHydrated ? (
            <PlaygroundLoading />
          ) : (
            <>
              {items.length === 0 && hasKey && (
                <div className='text-muted-foreground flex h-75 flex-col items-center justify-center gap-2 text-center'>
                  <Music2Icon className='size-10' />
                  <p className='text-sm'>
                    {t('Describe the song you want to create below.')}
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
                <MusicItemCard
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
          <Tabs
            value={config.mode}
            onValueChange={(v) => updateConfig('mode', v as MusicMode)}
            className='gap-3'
          >
            <TabsList variant='line' className='gap-3'>
              <TabsTrigger value='description'>
                {t('Description mode')}
              </TabsTrigger>
              <TabsTrigger value='custom'>{t('Custom mode')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {config.mode === 'description' ? (
            <Textarea
              ref={descriptionInputRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                'Describe the song mood, genre, story… (Suno picks the rest)'
              )}
              disabled={isSubmitting || !hasKey}
              className='min-h-20 resize-none'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
            />
          ) : (
            <div className='space-y-2'>
              <Textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t(
                  'Lyrics (use [Verse], [Chorus], [Bridge] markers)'
                )}
                disabled={isSubmitting || !hasKey}
                className='min-h-30 resize-none'
              />
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <Input
                  value={config.title}
                  onChange={(e) => updateConfig('title', e.target.value)}
                  placeholder={t('Title')}
                  disabled={isSubmitting || !hasKey}
                  className='h-8 text-sm'
                />
                <Input
                  value={config.tags}
                  onChange={(e) => updateConfig('tags', e.target.value)}
                  placeholder={t('Tags (e.g. pop, upbeat, summer)')}
                  disabled={isSubmitting || !hasKey}
                  className='h-8 text-sm'
                />
              </div>
            </div>
          )}

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-3'>
              <Label className='flex cursor-pointer items-center gap-2 text-xs'>
                <Checkbox
                  checked={config.makeInstrumental}
                  onCheckedChange={(v) =>
                    updateConfig('makeInstrumental', Boolean(v))
                  }
                  disabled={isSubmitting || !hasKey}
                />
                {t('Instrumental only')}
              </Label>

              <div className='flex items-center gap-2'>
                <Label className='text-muted-foreground text-xs'>
                  {t('MV')}
                </Label>
                <Input
                  value={config.mv}
                  onChange={(e) => updateConfig('mv', e.target.value)}
                  disabled={isSubmitting || !hasKey}
                  className='h-8 w-32.5 text-xs'
                />
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
