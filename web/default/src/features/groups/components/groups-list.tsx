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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createGroup } from '../api'
import type { GroupManageItem } from '../types'

type Props = {
  groups: GroupManageItem[]
  selected: string | null
  onSelect: (name: string) => void
  onChanged: () => void
}

export function GroupsList({ groups, selected, onSelect, onChanged }: Props) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [ratio, setRatio] = useState('1')
  const [description, setDescription] = useState('')

  const reset = () => {
    setName('')
    setRatio('1')
    setDescription('')
    setCreating(false)
  }

  // Server errors are surfaced by the global axios interceptor's toast.
  const submit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const res = await createGroup({
        name: name.trim(),
        consumption_ratio: Number(ratio) || 1,
        description,
        visibility: 'public',
      })
      if (res.success) {
        const created = name.trim()
        reset()
        onSelect(created)
        onChanged()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card size="sm" className="md:sticky md:top-1">
      <CardContent className="flex flex-col gap-0.5">
        {groups.map((g) => {
          const empty = g.channel_count === 0
          const active = selected === g.name
          return (
            <button
              key={g.name}
              type="button"
              onClick={() => onSelect(g.name)}
              className={cn(
                'relative flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                active
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-foreground/80 hover:bg-muted hover:text-foreground'
              )}
            >
              {active && (
                <span className="bg-primary absolute inset-y-1.5 left-0 w-0.5 rounded-full" />
              )}
              <span className="flex min-w-0 items-center gap-1.5">
                {empty && (
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                )}
                <span className="truncate">{g.name}</span>
              </span>
              <Badge
                variant={empty ? 'outline' : 'secondary'}
                className={cn(empty && 'text-amber-500')}
              >
                {g.channel_count}
              </Badge>
            </button>
          )
        })}

        {creating ? (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border p-2.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-group-name">{t('Group name')}</Label>
              <Input
                id="new-group-name"
                placeholder={t('Group name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-group-ratio">{t('Consumption ratio')}</Label>
              <Input
                id="new-group-ratio"
                type="number"
                step="0.01"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-group-desc">{t('Description')}</Label>
              <Input
                id="new-group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" onClick={submit} disabled={submitting}>
                {t('Create')}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                {t('Cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 justify-start"
            onClick={() => setCreating(true)}
          >
            + {t('New group')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
