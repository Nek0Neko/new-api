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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  parseApiEndpoints,
  resolveSelectedUrl,
  type ApiEndpoint,
} from '../lib/api-endpoints'

const STORAGE_KEY = 'selected_api_endpoint'

function readStatusField(field: string): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (typeof status?.[field] === 'string') return status[field]
    }
  } catch {
    /* empty */
  }
  return ''
}

export type UseApiEndpointsResult = {
  endpoints: ApiEndpoint[]
  selected: ApiEndpoint
  setSelected: (url: string) => void
}

export function useApiEndpoints(): UseApiEndpointsResult {
  const { t } = useTranslation()
  const mainLabel = t('Main site')

  const endpoints = useMemo(() => {
    const mainUrl =
      readStatusField('server_address') ||
      (typeof window !== 'undefined' ? window.location.origin : '')
    return parseApiEndpoints(
      readStatusField('user_api_endpoints'),
      mainUrl,
      mainLabel
    )
  }, [mainLabel])

  const [storedUrl, setStoredUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const selectedUrl = resolveSelectedUrl(endpoints, storedUrl)
  const selected =
    endpoints.find((e) => e.url === selectedUrl) ?? endpoints[0]

  const setSelected = useCallback((url: string) => {
    setStoredUrl(url)
    try {
      localStorage.setItem(STORAGE_KEY, url)
    } catch {
      /* empty */
    }
  }, [])

  return { endpoints, selected, setSelected }
}
