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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { KeyRoundIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import type { SelectedToken } from './use-selected-token'

interface TokenPickerProps {
  selected: SelectedToken
  className?: string
}

const ENABLED_STATUS = 1

export function TokenPicker({ selected, className }: TokenPickerProps) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['playground-tokens'],
    queryFn: () => getApiKeys({ p: 1, size: 100 }),
  })

  const tokens: ApiKey[] = useMemo(() => {
    const items = data?.data?.items
    if (!Array.isArray(items)) return []
    return items.filter((tok) => tok.status === ENABLED_STATUS)
  }, [data])

  const handleChange = async (value: string | null) => {
    if (value == null) return
    const id = Number(value)
    if (!Number.isFinite(id)) return
    const match = tokens.find((tok) => tok.id === id)
    await selected.select(id, match?.name)
  }

  const value = selected.id != null ? String(selected.id) : ''

  return (
    <div className={'flex flex-wrap items-center gap-2 ' + (className ?? '')}>
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
        <KeyRoundIcon className='size-3.5' />
        {t('API Key')}
      </div>

      {isLoading ? (
        <div className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
          <Loader2Icon className='size-3.5 animate-spin' />
          {t('Loading…')}
        </div>
      ) : tokens.length === 0 ? (
        <Button
          size='sm'
          variant='outline'
          className='gap-1.5'
          render={<Link to='/keys' />}
        >
          <PlusIcon className='size-3.5' />
          {t('Create API key')}
        </Button>
      ) : (
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className='h-8 w-55 text-xs'>
            <SelectValue placeholder={t('Select API key…')}>
              {selected.id != null
                ? (selected.name ?? `Token #${selected.id}`)
                : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            side='bottom'
            align='start'
            alignItemWithTrigger={false}
            className='max-h-[min(360px,var(--available-height))]'
          >
            {tokens.map((tok) => (
              <SelectItem key={tok.id} value={String(tok.id)}>
                <div className='flex flex-col'>
                  <span className='text-sm font-medium'>{tok.name}</span>
                  <span className='text-muted-foreground font-mono text-[11px]'>
                    {tok.key}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selected.isResolving && (
        <Loader2Icon className='text-muted-foreground size-3.5 animate-spin' />
      )}
      {selected.error && (
        <span className='text-destructive text-xs'>{selected.error}</span>
      )}
    </div>
  )
}
