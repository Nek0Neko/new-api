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
import { fetchTokenKey } from '@/features/keys/api'

const STORAGE_KEY = 'playground_selected_token'

interface StoredSelection {
  id: number
  key: string
  name?: string
}

function safeParse(raw: string | null): StoredSelection | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (
      v &&
      typeof v === 'object' &&
      typeof v.id === 'number' &&
      typeof v.key === 'string'
    ) {
      return { id: v.id, key: v.key, name: v.name }
    }
  } catch {
    // ignore
  }
  return null
}

function persistSelection(selection: StoredSelection | null) {
  if (typeof window === 'undefined') return
  try {
    if (selection) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // ignore quota errors
  }
}

export interface SelectedToken {
  id: number | null
  key: string | null
  name: string | null
  isResolving: boolean
  error: string | null
  /** Persist a selection and resolve its unmasked key from the server. */
  select: (id: number, name?: string) => Promise<void>
  /** Clear the selection. */
  clear: () => void
}

export function useSelectedToken(): SelectedToken {
  const [selection, setSelection] = useState<StoredSelection | null>(() =>
    safeParse(
      typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(STORAGE_KEY)
    )
  )
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Used to discard stale fetches if the user picks a different token mid-flight.
  const requestRef = useRef(0)

  const select = useCallback(async (id: number, name?: string) => {
    const reqId = ++requestRef.current
    setIsResolving(true)
    setError(null)
    try {
      const res = await fetchTokenKey(id)
      if (reqId !== requestRef.current) return
      const key = res?.data?.key
      if (!res?.success || !key) {
        setError(res?.message ?? 'Failed to fetch API key')
        return
      }
      const next: StoredSelection = { id, key, name }
      setSelection(next)
      persistSelection(next)
    } catch (e) {
      if (reqId !== requestRef.current) return
      const message =
        (e as { message?: string })?.message ?? 'Failed to fetch API key'
      setError(message)
    } finally {
      if (reqId === requestRef.current) setIsResolving(false)
    }
  }, [])

  const clear = useCallback(() => {
    requestRef.current += 1
    setSelection(null)
    setError(null)
    persistSelection(null)
  }, [])

  // Sync across browser tabs: if another tab updates the storage key, mirror it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      setSelection(safeParse(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return {
    id: selection?.id ?? null,
    key: selection?.key ?? null,
    name: selection?.name ?? null,
    isResolving,
    error,
    select,
    clear,
  }
}
