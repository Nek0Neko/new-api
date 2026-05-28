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
import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Centered spinner shown in a playground panel's content area while its
 * persisted history is loaded asynchronously after first paint.
 */
export function PlaygroundLoading() {
  const { t } = useTranslation()
  return (
    <div className='text-muted-foreground flex h-full min-h-75 flex-1 flex-col items-center justify-center gap-2'>
      <Loader2Icon className='size-6 animate-spin' />
      <p className='text-sm'>{t('Loading…')}</p>
    </div>
  )
}
