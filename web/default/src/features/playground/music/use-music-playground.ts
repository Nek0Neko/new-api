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
import { fetchMusicTask, submitMusic } from './api'
import {
  loadMusicConfig,
  loadMusicItems,
  saveMusicConfig,
  saveMusicItems,
} from './storage'
import type {
  MusicConfig,
  MusicSubmitRequest,
  MusicTaskItem,
} from './types'

const POLL_INTERVAL_MS = 5000
const MAX_POLL_ATTEMPTS = 240 // ~20 minutes
const ACTIVE_STATUSES: MusicTaskItem['status'][] = [
  'submitting',
  'queued',
  'in_progress',
]

function generateId() {
  return `music-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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
      'Music generation failed'
    )
  }
  if (error instanceof Error) return error.message
  return 'Music generation failed'
}

function normalizeStatus(status: string): MusicTaskItem['status'] {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case 'submitted':
    case 'queued':
    case 'pending':
    case 'queueing':
      return 'queued'
    case 'in_progress':
    case 'processing':
    case 'running':
    case 'streaming':
      return 'in_progress'
    case 'success':
    case 'succeeded':
    case 'completed':
    case 'complete':
      return 'succeeded'
    case 'failure':
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'in_progress'
  }
}

interface SubmitArgs {
  description: string
  prompt: string
  /**
   * Optional one-shot overrides for the active config. Used by "Regenerate"
   * on a history item to reproduce its exact mode/title/tags without first
   * mutating the UI's current config (which would race React state updates).
   */
  overrideConfig?: Partial<MusicConfig>
}

export function useMusicPlayground(apiKey: string | null) {
  const [config, setConfig] = useState<MusicConfig>(() => loadMusicConfig())
  const [items, setItems] = useState<MusicTaskItem[]>(() => loadMusicItems())

  const itemsRef = useRef<MusicTaskItem[]>(items)
  itemsRef.current = items

  const apiKeyRef = useRef<string | null>(apiKey)
  apiKeyRef.current = apiKey

  const pollAttemptsRef = useRef<Record<string, number>>({})
  const pollTimersRef = useRef<Record<string, number>>({})
  const stoppedRef = useRef(false)

  const updateConfig = useCallback(
    <K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) => {
      setConfig((prev) => {
        const next = { ...prev, [key]: value }
        saveMusicConfig(next)
        return next
      })
    },
    []
  )

  const persistItems = useCallback(
    (updater: (prev: MusicTaskItem[]) => MusicTaskItem[]) => {
      setItems((prev) => {
        const next = updater(prev)
        itemsRef.current = next
        saveMusicItems(next)
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
        // Pause polling — re-arm so we resume once the user re-selects a key.
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
        const response = await fetchMusicTask(item.taskId, key)
        const status = normalizeStatus(response.status)
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status,
                  clips: response.clips.length > 0 ? response.clips : it.clips,
                  errorMessage:
                    status === 'failed'
                      ? response.failReason ?? 'Task failed'
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
        // eslint-disable-next-line no-console
        console.warn('music task fetch failed', error)
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

  useEffect(() => {
    stoppedRef.current = false
    itemsRef.current.forEach((it) => {
      if (it.taskId && ACTIVE_STATUSES.includes(it.status)) {
        ensurePolling(it.id)
      }
    })
    const timers = pollTimersRef.current
    return () => {
      stoppedRef.current = true
      Object.keys(timers).forEach((id) => stopPolling(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = useCallback(
    async ({ description, prompt, overrideConfig }: SubmitArgs) => {
      const activeConfig: MusicConfig = { ...config, ...overrideConfig }
      const trimmedDesc = description.trim()
      const trimmedPrompt = prompt.trim()
      const key = apiKeyRef.current
      if (!key) return
      if (activeConfig.mode === 'description' && !trimmedDesc) return
      if (activeConfig.mode === 'custom' && !trimmedPrompt) return

      const id = generateId()
      const draft: MusicTaskItem = {
        id,
        mode: activeConfig.mode,
        model: activeConfig.model,
        description: trimmedDesc,
        prompt: trimmedPrompt,
        title: activeConfig.title,
        tags: activeConfig.tags,
        makeInstrumental: activeConfig.makeInstrumental,
        createdAt: Date.now(),
        status: 'submitting',
        clips: [],
      }
      persistItems((prev) => [draft, ...prev])

      const payload: MusicSubmitRequest = {
        model: activeConfig.model || undefined,
        make_instrumental: activeConfig.makeInstrumental,
        mv: activeConfig.mv,
      }
      if (activeConfig.mode === 'description') {
        payload.gpt_description_prompt = trimmedDesc
      } else {
        payload.prompt = trimmedPrompt
        if (activeConfig.title.trim()) payload.title = activeConfig.title.trim()
        if (activeConfig.tags.trim()) payload.tags = activeConfig.tags.trim()
      }

      try {
        const response = await submitMusic('music', payload, key)
        if (!response.taskId) {
          throw new Error('Server did not return a task id')
        }
        persistItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, taskId: response.taskId, status: 'queued' }
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
    isSubmitting,
    updateConfig,
    submit,
    removeItem,
    clearHistory,
  }
}
