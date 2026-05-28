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
import { scheduleAfterPaint } from '../shared/schedule'
import { fetchVideoTask, submitVideo } from './api'
import {
  loadVideoConfig,
  loadVideoItems,
  saveVideoConfig,
  saveVideoItems,
} from './storage'
import type {
  VideoConfig,
  VideoGenerationRequest,
  VideoTaskItem,
} from './types'

const POLL_INTERVAL_MS = 4000
const MAX_POLL_ATTEMPTS = 300 // ~20 minutes
const ACTIVE_STATUSES: VideoTaskItem['status'][] = [
  'submitting',
  'queued',
  'in_progress',
]

function generateId() {
  return `vid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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
      'Video generation failed'
    )
  }
  if (error instanceof Error) return error.message
  return 'Video generation failed'
}

function normalizeStatus(status: string): VideoTaskItem['status'] {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case 'submitted':
    case 'queued':
    case 'pending':
      return 'queued'
    case 'in_progress':
    case 'processing':
    case 'running':
      return 'in_progress'
    case 'succeeded':
    case 'success':
    case 'completed':
      return 'succeeded'
    case 'failure':
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'in_progress'
  }
}

export function useVideoPlayground(apiKey: string | null) {
  const [config, setConfig] = useState<VideoConfig>(() => loadVideoConfig())
  // Start empty and hydrate after first paint (see effect below) so parsing
  // the saved list never runs during render.
  const [items, setItems] = useState<VideoTaskItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  const itemsRef = useRef<VideoTaskItem[]>(items)
  itemsRef.current = items

  // Mirror the latest apiKey so polling — which spans many renders — always
  // reads the current value.
  const apiKeyRef = useRef<string | null>(apiKey)
  apiKeyRef.current = apiKey

  const pollAttemptsRef = useRef<Record<string, number>>({})
  const pollTimersRef = useRef<Record<string, number>>({})
  const stoppedRef = useRef(false)

  const updateConfig = useCallback(
    <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) => {
      setConfig((prev) => {
        const next = { ...prev, [key]: value }
        saveVideoConfig(next)
        return next
      })
    },
    []
  )

  const persistItems = useCallback(
    (updater: (prev: VideoTaskItem[]) => VideoTaskItem[]) => {
      setItems((prev) => {
        const next = updater(prev)
        itemsRef.current = next
        saveVideoItems(next)
        return next
      })
    },
    []
  )

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
      if (!item || !item.taskId) {
        stopPolling(id)
        return
      }
      if (!ACTIVE_STATUSES.includes(item.status)) {
        stopPolling(id)
        return
      }
      const key = apiKeyRef.current
      if (!key) {
        // Pause polling — but don't terminate. Re-arm so we resume after the
        // user reselects a key.
        pollTimersRef.current[id] = window.setTimeout(
          () => pollOnce(id),
          POLL_INTERVAL_MS
        )
        return
      }
      const attempts = (pollAttemptsRef.current[id] ?? 0) + 1
      pollAttemptsRef.current[id] = attempts
      if (attempts > MAX_POLL_ATTEMPTS) {
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'failed',
                  errorMessage: 'Polling timeout',
                }
              : it
          )
        )
        stopPolling(id)
        return
      }

      try {
        const response = await fetchVideoTask(item.taskId, key)
        const status = normalizeStatus(response.status)
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status,
                  url: response.url ?? it.url,
                  format: response.format ?? it.format,
                  errorMessage:
                    status === 'failed'
                      ? (response.error?.message ?? 'Task failed')
                      : it.errorMessage,
                }
              : it
          )
        )
        if (status === 'succeeded' || status === 'failed') {
          stopPolling(id)
          return
        }
      } catch (error) {
        // transient error — keep polling until max attempts; only surface on terminal
        // eslint-disable-next-line no-console
        console.warn('video task fetch failed', error)
      }

      if (stoppedRef.current) return
      pollTimersRef.current[id] = window.setTimeout(
        () => pollOnce(id),
        POLL_INTERVAL_MS
      )
    },
    [persistItems, stopPolling]
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

  // Hydrate persisted history after first paint, then resume polling for any
  // in-flight tasks. Reading/parsing here (post-paint) instead of in the
  // useState initializer keeps the heavy work out of the render path.
  useEffect(() => {
    stoppedRef.current = false
    const cancel = scheduleAfterPaint(() => {
      const loaded = loadVideoItems()
      // Preserve anything the user submitted before hydration completed.
      setItems((current) =>
        current.length === 0 ? loaded : [...current, ...loaded]
      )
      loaded.forEach((it) => {
        if (it.taskId && ACTIVE_STATUSES.includes(it.status)) {
          ensurePolling(it.id)
        }
      })
      setIsHydrated(true)
    })
    const timers = pollTimersRef.current
    return () => {
      cancel()
      stoppedRef.current = true
      Object.keys(timers).forEach((id) => stopPolling(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = useCallback(
    async (prompt: string, image?: string) => {
      const trimmedPrompt = prompt.trim()
      const key = apiKeyRef.current
      if (!trimmedPrompt || !config.model || !key) return

      const id = generateId()
      const draft: VideoTaskItem = {
        id,
        prompt: trimmedPrompt,
        image: image?.trim() || undefined,
        model: config.model,
        duration: config.duration,
        width: config.width,
        height: config.height,
        fps: config.fps,
        createdAt: Date.now(),
        status: 'submitting',
      }

      persistItems((prev) => [draft, ...prev])

      const payload: VideoGenerationRequest = {
        model: config.model,
        prompt: trimmedPrompt,
        duration: config.duration,
        width: config.width,
        height: config.height,
        fps: config.fps,
      }
      if (image?.trim()) payload.image = image.trim()
      if (config.negativePrompt.trim()) {
        payload.metadata = { negative_prompt: config.negativePrompt.trim() }
      }

      try {
        const response = await submitVideo(payload, key)
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  taskId: response.task_id,
                  status: normalizeStatus(response.status),
                }
              : it
          )
        )
        ensurePolling(id)
      } catch (error) {
        const message = extractErrorMessage(error)
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: 'failed', errorMessage: message }
              : it
          )
        )
      }
    },
    [config, persistItems, ensurePolling]
  )

  const removeItem = useCallback(
    (id: string) => {
      stopPolling(id)
      persistItems((prev) => prev.filter((it) => it.id !== id))
    },
    [persistItems, stopPolling]
  )

  const clearHistory = useCallback(() => {
    Object.keys(pollTimersRef.current).forEach((id) => stopPolling(id))
    persistItems(() => [])
  }, [persistItems, stopPolling])

  const isSubmitting = items.some((it) => it.status === 'submitting')

  return {
    config,
    items,
    isHydrated,
    isSubmitting,
    updateConfig,
    submit,
    removeItem,
    clearHistory,
  }
}
