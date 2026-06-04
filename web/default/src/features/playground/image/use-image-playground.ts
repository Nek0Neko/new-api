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
import { isAxiosError } from 'axios'
import {
  editImage,
  editImageStream,
  fetchImageTask,
  generateImage,
  generateImageStream,
  submitImageEditTask,
  submitImageGenerationTask,
} from './api'
import {
  replaceImageMentionsForApi,
  stripImageMentionMarkers,
} from './prompt-mentions'
import {
  clearImageItems,
  loadImageConfig,
  loadImageItems,
  saveImageConfig,
  saveImageItems,
} from './storage'
import {
  clearRemoteHistory,
  deleteRemoteHistoryItem,
  fetchRemoteHistory,
  isSyncableItem,
  pushRemoteHistoryItem,
} from './remote-history'
import type {
  ImageConfig,
  ImageEditRequest,
  ImageGenerationItem,
  ImageGenerationRequest,
  ImageInputFile,
} from './types'

// Async-task polling cadence. Image generation usually finishes well under a
// minute, but we allow a generous ceiling for slow models / queueing.
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 200 // ~10 minutes

function generateId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined
    return (
      body?.error?.message ??
      body?.message ??
      error.message ??
      'Image generation failed'
    )
  }
  if (error instanceof Error) return error.message
  return 'Image generation failed'
}

// Map the server task status onto the item's UI status. Anything that isn't a
// terminal state keeps the card in its spinning `loading` state.
function taskStatusToItemStatus(
  status: string
): 'loading' | 'success' | 'error' {
  switch ((status || '').toUpperCase()) {
    case 'SUCCESS':
      return 'success'
    case 'FAILURE':
      return 'error'
    default:
      return 'loading'
  }
}

export function useImagePlayground(apiKey: string | null) {
  const [config, setConfig] = useState<ImageConfig>(() => loadImageConfig())
  const [items, setItems] = useState<ImageGenerationItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [inputImages, setInputImages] = useState<ImageInputFile[]>([])
  const [maskImage, setMaskImage] = useState<ImageInputFile | null>(null)

  const addInputImages = useCallback((files: ImageInputFile[]) => {
    setInputImages((prev) => [...prev, ...files])
  }, [])

  const removeInputImage = useCallback((id: string) => {
    setInputImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const clearInputs = useCallback(() => {
    setInputImages([])
    setMaskImage(null)
  }, [])

  // A mask only makes sense with a primary image; drop it once images are gone.
  useEffect(() => {
    if (inputImages.length === 0 && maskImage) setMaskImage(null)
  }, [inputImages, maskImage])

  // Mirror the latest apiKey in a ref so callbacks always see the current
  // value without recreating closures.
  const apiKeyRef = useRef<string | null>(apiKey)
  apiKeyRef.current = apiKey

  // Mirror items so polling — which spans many renders — always reads the
  // current list without recreating closures.
  const itemsRef = useRef<ImageGenerationItem[]>(items)

  const pollAttemptsRef = useRef<Record<string, number>>({})
  const pollTimersRef = useRef<Record<string, number>>({})
  const stoppedRef = useRef(false)

  const updateConfig = useCallback(
    <K extends keyof ImageConfig>(key: K, value: ImageConfig[K]) => {
      setConfig((prev) => {
        const next = { ...prev, [key]: value }
        saveImageConfig(next)
        return next
      })
    },
    []
  )

  // Fire-and-forget the IndexedDB write. localforage serializes writes per
  // key internally, so concurrent saves cannot interleave.
  const updateItems = useCallback(
    (updater: (prev: ImageGenerationItem[]) => ImageGenerationItem[]) => {
      setItems((prev) => {
        const next = updater(prev)
        itemsRef.current = next
        void saveImageItems(next)
        return next
      })
    },
    []
  )

  // Push a successful, URL-backed item to the server (write-through). Never
  // throws — sync failures must not disrupt local generation. Upsert is
  // idempotent, so an occasional double-push (e.g. React StrictMode) is safe.
  const pushItemRemote = useCallback((item: ImageGenerationItem) => {
    if (!isSyncableItem(item)) return
    void pushRemoteHistoryItem(item).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[playground/image] failed to sync item to server', err)
    })
  }, [])

  const stopPolling = useCallback((id: string) => {
    const timer = pollTimersRef.current[id]
    if (timer) {
      window.clearTimeout(timer)
      delete pollTimersRef.current[id]
    }
    delete pollAttemptsRef.current[id]
  }, [])

  const pollOnce = useCallback(
    async (id: string) => {
      if (stoppedRef.current) return
      const item = itemsRef.current.find((it) => it.id === id)
      if (!item || !item.taskId || item.status !== 'loading') {
        stopPolling(id)
        return
      }
      const key = apiKeyRef.current
      if (!key) {
        // Pause (don't terminate) — re-arm so polling resumes once a key is set.
        pollTimersRef.current[id] = window.setTimeout(
          () => pollOnce(id),
          POLL_INTERVAL_MS
        )
        return
      }
      const attempts = (pollAttemptsRef.current[id] ?? 0) + 1
      pollAttemptsRef.current[id] = attempts
      if (attempts > MAX_POLL_ATTEMPTS) {
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: 'error', errorMessage: 'Polling timeout' }
              : it
          )
        )
        stopPolling(id)
        return
      }

      try {
        const resp = await fetchImageTask(item.taskId, key)
        const status = taskStatusToItemStatus(resp.status)
        if (status === 'success') {
          const images = resp.data?.data ?? []
          updateItems((prev) =>
            prev.map((it) =>
              it.id === id ? { ...it, status: 'success', images } : it
            )
          )
          const base = itemsRef.current.find((it) => it.id === id)
          if (base) {
            pushItemRemote({ ...base, status: 'success', images })
          }
          stopPolling(id)
          return
        }
        if (status === 'error') {
          updateItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    status: 'error',
                    errorMessage: resp.fail_reason || 'Task failed',
                  }
                : it
            )
          )
          stopPolling(id)
          return
        }
        // still in progress — fall through to reschedule
      } catch (error) {
        // Transient error — keep polling until max attempts.
        // eslint-disable-next-line no-console
        console.warn('image task fetch failed', error)
      }

      if (stoppedRef.current) return
      pollTimersRef.current[id] = window.setTimeout(
        () => pollOnce(id),
        POLL_INTERVAL_MS
      )
    },
    [updateItems, stopPolling, pushItemRemote]
  )

  const ensurePolling = useCallback(
    (id: string) => {
      if (pollTimersRef.current[id]) return
      pollTimersRef.current[id] = window.setTimeout(
        () => pollOnce(id),
        POLL_INTERVAL_MS
      )
    },
    [pollOnce]
  )

  // Hydrate items from IndexedDB on mount, then resume polling for any task
  // items still in flight. Guard against late completion overwriting items the
  // user has already added (race with submit()).
  useEffect(() => {
    stoppedRef.current = false
    let cancelled = false
    const hydrate = async () => {
      let loaded: ImageGenerationItem[]
      try {
        // Server is the source of truth; an empty list means "no history".
        loaded = await fetchRemoteHistory()
        // Refresh the offline cache so a later offline load is warm.
        void saveImageItems(loaded)
      } catch {
        // Offline / server error — fall back to the local IndexedDB cache.
        loaded = await loadImageItems()
      }
      if (cancelled) return
      setItems((current) => {
        const next = current.length === 0 ? loaded : [...current, ...loaded]
        itemsRef.current = next
        return next
      })
      loaded.forEach((it) => {
        if (it.taskId && it.status === 'loading') ensurePolling(it.id)
      })
      setIsHydrated(true)
    }
    void hydrate()
    const timers = pollTimersRef.current
    return () => {
      cancelled = true
      stoppedRef.current = true
      Object.keys(timers).forEach((id) => {
        window.clearTimeout(timers[id])
        delete timers[id]
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearHistory = useCallback(() => {
    Object.keys(pollTimersRef.current).forEach((id) => stopPolling(id))
    itemsRef.current = []
    setItems([])
    void clearImageItems()
    void clearRemoteHistory().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[playground/image] failed to clear server history', err)
    })
  }, [stopPolling])

  const removeItem = useCallback(
    (id: string) => {
      stopPolling(id)
      updateItems((prev) => prev.filter((it) => it.id !== id))
      void deleteRemoteHistoryItem(id).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[playground/image] failed to delete server item', err)
      })
    },
    [updateItems, stopPolling]
  )

  const submit = useCallback(
    async (
      prompt: string,
      override?: {
        inputImages: ImageInputFile[]
        maskImage: ImageInputFile | null
        /**
         * When set, retry the existing item with this id *in place* instead of
         * prepending a new one. The item is reset to a loading/streaming state
         * and regenerated using its original config snapshot.
         */
        retryId?: string
      }
    ) => {
      // For a retry, reuse the original item's saved config so the regeneration
      // reproduces its original parameters, not the current config panel. Older
      // items lack the snapshot — fall back to the live config.
      const retryItem = override?.retryId
        ? itemsRef.current.find((it) => it.id === override.retryId)
        : undefined
      const cfg = retryItem?.config ?? config

      const visiblePrompt = stripImageMentionMarkers(prompt).trim()
      const key = apiKeyRef.current
      if (!visiblePrompt || isGenerating || !cfg.model || !key) return

      const images = override ? override.inputImages : inputImages
      const mask = override ? override.maskImage : maskImage
      const apiPrompt = replaceImageMentionsForApi(prompt, images.length)
      const isEdit = images.length > 0
      const id = retryItem ? retryItem.id : generateId()
      const useAsync = !!cfg.asyncTask
      // A task cannot stream — async mode ignores the stream toggle.
      const useStream = !useAsync && !!cfg.stream

      if (retryItem) {
        // Retry in place: stop any stale polling and reset the existing card
        // back to its in-flight state, clearing the previous result/error.
        stopPolling(id)
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: useStream ? 'streaming' : 'loading',
                  images: [],
                  partialImage: undefined,
                  errorMessage: undefined,
                  taskId: undefined,
                }
              : it
          )
        )
      } else {
        const placeholder: ImageGenerationItem = {
          id,
          prompt: visiblePrompt,
          model: cfg.model,
          size: cfg.size,
          quality: cfg.quality,
          mode: isEdit ? 'edit' : 'generation',
          inputImages: isEdit ? images : undefined,
          maskImage: isEdit ? (mask ?? undefined) : undefined,
          createdAt: Date.now(),
          status: useStream ? 'streaming' : 'loading',
          images: [],
          config: cfg,
        }
        updateItems((prev) => [placeholder, ...prev])
      }
      setIsGenerating(true)
      // Clear the tray immediately for a fresh (non-regenerate) edit submit.
      if (!override && isEdit) clearInputs()

      const markSuccess = (resultImages: ImageGenerationItem['images']) => {
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'success',
                  images: resultImages,
                  partialImage: undefined,
                }
              : it
          )
        )
        const base = itemsRef.current.find((it) => it.id === id)
        if (base) {
          pushItemRemote({
            ...base,
            status: 'success',
            images: resultImages,
            partialImage: undefined,
          })
        }
      }

      try {
        if (useAsync) {
          // Submit as a server-side task and start polling. The actual upstream
          // generation runs on the server, so the user may leave/refresh/close.
          let taskId: string
          if (isEdit) {
            const editReq: ImageEditRequest = {
              model: cfg.model,
              prompt: apiPrompt,
              n: cfg.n,
              size: cfg.size,
              quality: cfg.quality,
              moderation: cfg.moderation,
              output_format: cfg.outputFormat,
              response_format: 'url',
              images,
              mask: mask ?? undefined,
            }
            if (
              cfg.outputFormat !== 'png' &&
              cfg.outputCompression != null
            ) {
              editReq.output_compression = cfg.outputCompression
            }
            const resp = await submitImageEditTask(editReq, key)
            taskId = resp.task_id
          } else {
            const payload: ImageGenerationRequest = {
              model: cfg.model,
              prompt: apiPrompt,
              n: cfg.n,
              size: cfg.size,
              quality: cfg.quality,
              moderation: cfg.moderation,
              output_format: cfg.outputFormat,
              response_format: 'url',
            }
            if (
              cfg.outputFormat !== 'png' &&
              cfg.outputCompression != null
            ) {
              payload.output_compression = cfg.outputCompression
            }
            const resp = await submitImageGenerationTask(payload, key)
            taskId = resp.task_id
          }
          updateItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, taskId } : it))
          )
          ensurePolling(id)
          return
        }

        if (isEdit) {
          const editReq: ImageEditRequest = {
            model: cfg.model,
            prompt: apiPrompt,
            // Streaming only ever yields a single image upstream; force n=1 so a
            // stale count (set before enabling stream) can't trigger a 400.
            n: useStream ? 1 : cfg.n,
            size: cfg.size,
            quality: cfg.quality,
            moderation: cfg.moderation,
            output_format: cfg.outputFormat,
            response_format: useStream ? 'b64_json' : 'url',
            images,
            mask: mask ?? undefined,
          }
          if (
            cfg.outputFormat !== 'png' &&
            cfg.outputCompression != null
          ) {
            editReq.output_compression = cfg.outputCompression
          }
          if (useStream && cfg.partialImages > 0) {
            editReq.partial_images = cfg.partialImages
          }
          if (useStream) {
            const finalImage = await editImageStream(editReq, key, {
              onPartial: (b64) =>
                updateItems((prev) =>
                  prev.map((it) =>
                    it.id === id ? { ...it, partialImage: b64 } : it
                  )
                ),
            })
            markSuccess([finalImage])
          } else {
            const response = await editImage(editReq, key)
            markSuccess(response.data ?? [])
          }
        } else {
          const payload: ImageGenerationRequest = {
            model: cfg.model,
            prompt: apiPrompt,
            // Streaming only ever yields a single image upstream; force n=1 so a
            // stale count (set before enabling stream) can't trigger a 400.
            n: useStream ? 1 : cfg.n,
            size: cfg.size,
            quality: cfg.quality,
            moderation: cfg.moderation,
            output_format: cfg.outputFormat,
            response_format: useStream ? 'b64_json' : 'url',
          }
          if (
            cfg.outputFormat !== 'png' &&
            cfg.outputCompression != null
          ) {
            payload.output_compression = cfg.outputCompression
          }
          if (useStream) {
            payload.stream = true
            if (cfg.partialImages > 0) {
              payload.partial_images = cfg.partialImages
            }
          }
          if (useStream) {
            const finalImage = await generateImageStream(payload, key, {
              onPartial: (b64) =>
                updateItems((prev) =>
                  prev.map((it) =>
                    it.id === id ? { ...it, partialImage: b64 } : it
                  )
                ),
            })
            markSuccess([finalImage])
          } else {
            const response = await generateImage(payload, key)
            markSuccess(response.data ?? [])
          }
        }
      } catch (error) {
        const message = extractErrorMessage(error)
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'error',
                  errorMessage: message,
                  partialImage: undefined,
                }
              : it
          )
        )
      } finally {
        // For async tasks the work continues in the background; unlock the UI
        // as soon as the task is submitted. For sync/stream this runs after the
        // full result arrives.
        setIsGenerating(false)
      }
    },
    [
      config,
      isGenerating,
      inputImages,
      maskImage,
      updateItems,
      clearInputs,
      ensurePolling,
      stopPolling,
      pushItemRemote,
    ]
  )

  return {
    config,
    items,
    isHydrated,
    isGenerating,
    inputImages,
    maskImage,
    addInputImages,
    removeInputImage,
    setMaskImage,
    clearInputs,
    updateConfig,
    submit,
    clearHistory,
    removeItem,
  }
}
