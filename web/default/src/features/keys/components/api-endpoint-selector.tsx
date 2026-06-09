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
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApiKeys } from './api-keys-provider'

export function ApiEndpointSelector() {
  const { t } = useTranslation()
  const { apiEndpoints, selectedEndpoint, setSelectedEndpoint } = useApiKeys()

  // Nothing to choose between — keep the toolbar clean.
  if (apiEndpoints.length <= 1) return null

  return (
    <Select
      value={selectedEndpoint.url}
      onValueChange={(url) => { if (url != null) setSelectedEndpoint(url) }}
    >
      <SelectTrigger
        className='h-8 w-48 text-xs'
        aria-label={t('Select API endpoint')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {apiEndpoints.map((ep) => (
          <SelectItem key={ep.url} value={ep.url}>
            {ep.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
