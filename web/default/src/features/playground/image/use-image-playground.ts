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
import { useCallback, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { generateImage } from './api'
import {
  loadImageConfig,
  loadImageItems,
  saveImageConfig,
  saveImageItems,
} from './storage'
import type {
  ImageConfig,
  ImageGenerationItem,
  ImageGenerationRequest,
} from './types'

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

export function useImagePlayground(apiKey: string | null) {
  const [config, setConfig] = useState<ImageConfig>(() => loadImageConfig())
  const [items, setItems] = useState<ImageGenerationItem[]>(() =>
    loadImageItems()
  )
  const [isGenerating, setIsGenerating] = useState(false)

  // Mirror the latest apiKey in a ref so callbacks always see the current
  // value without recreating closures.
  const apiKeyRef = useRef<string | null>(apiKey)
  apiKeyRef.current = apiKey

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

  const updateItems = useCallback(
    (updater: (prev: ImageGenerationItem[]) => ImageGenerationItem[]) => {
      setItems((prev) => {
        const next = updater(prev)
        saveImageItems(next)
        return next
      })
    },
    []
  )

  const clearHistory = useCallback(() => {
    updateItems(() => [])
  }, [updateItems])

  const removeItem = useCallback(
    (id: string) => {
      updateItems((prev) => prev.filter((it) => it.id !== id))
    },
    [updateItems]
  )

  const submit = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      const key = apiKeyRef.current
      if (!trimmed || isGenerating || !config.model || !key) return

      const id = generateId()
      const placeholder: ImageGenerationItem = {
        id,
        prompt: trimmed,
        model: config.model,
        size: config.size,
        quality: config.quality,
        createdAt: Date.now(),
        status: 'loading',
        images: [],
      }

      updateItems((prev) => [placeholder, ...prev])
      setIsGenerating(true)

      const payload: ImageGenerationRequest = {
        model: config.model,
        prompt: trimmed,
        n: config.n,
        size: config.size,
        quality: config.quality,
        response_format: 'url',
      }

      try {
        const response = await generateImage(payload, key)
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  status: 'success',
                  images: response.data ?? [],
                }
              : it
          )
        )
      } catch (error) {
        const message = extractErrorMessage(error)
        updateItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: 'error', errorMessage: message }
              : it
          )
        )
      } finally {
        setIsGenerating(false)
      }
    },
    [config, isGenerating, updateItems]
  )

  return {
    config,
    items,
    isGenerating,
    updateConfig,
    submit,
    clearHistory,
    removeItem,
  }
}
