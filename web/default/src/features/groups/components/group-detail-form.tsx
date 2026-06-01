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
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { deleteGroup, updateGroup } from '../api'
import type { GroupManageItem } from '../types'

type Props = { group: GroupManageItem; onChanged: () => void }

export function GroupDetailForm({ group, onChanged }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<GroupManageItem>(group)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof GroupManageItem>(
    k: K,
    v: GroupManageItem[K]
  ) => setForm((f) => ({ ...f, [k]: v }))

  // Guard numeric inputs: a cleared field yields '' -> Number('') === 0, and a
  // stray non-numeric value yields NaN (which would serialize to JSON null and be
  // silently coerced to 0 server-side). Treat both as 0 here so the value the admin
  // sees is exactly what gets saved.
  const setNum = (k: keyof GroupManageItem, raw: string) => {
    const n = Number(raw)
    set(k, (Number.isNaN(n) ? 0 : n) as GroupManageItem[typeof k])
  }

  // Server errors are surfaced by the global axios interceptor's toast, so we only
  // toast on success here to avoid a duplicate error toast.
  const save = async () => {
    setSaving(true)
    try {
      const res = await updateGroup(group.name, form)
      if (res.success) {
        toast.success(t('Saved'))
        onChanged()
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(t('Delete this group? This cannot be undone.'))) return
    setDeleting(true)
    try {
      const res = await deleteGroup(group.name)
      if (res.success) {
        toast.success(t('Deleted'))
        onChanged()
      }
    } finally {
      setDeleting(false)
    }
  }

  const toggles = [
    {
      key: 'admin_only' as const,
      label: t('Admin only'),
      checked: form.admin_only,
    },
    {
      key: 'auto_upgrade' as const,
      label: t('Auto upgrade'),
      checked: form.auto_upgrade,
    },
    {
      key: 'in_auto_rotation' as const,
      label: t('In auto rotation'),
      checked: form.in_auto_rotation,
    },
  ]

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <span className="truncate">{form.name}</span>
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          <Badge variant={form.visibility === 'public' ? 'secondary' : 'outline'}>
            {form.visibility === 'public' ? t('Public') : t('Private')}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-description">{t('Description')}</Label>
            <Input
              id="group-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-visibility">{t('Visibility')}</Label>
            <Select
              value={form.visibility}
              onValueChange={(v) =>
                set('visibility', v as 'public' | 'private')
              }
            >
              <SelectTrigger id="group-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('Public')}</SelectItem>
                <SelectItem value="private">{t('Private')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-consumption">{t('Consumption ratio')}</Label>
            <Input
              id="group-consumption"
              type="number"
              step="0.01"
              value={form.consumption_ratio}
              onChange={(e) => setNum('consumption_ratio', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-topup">{t('Topup ratio')}</Label>
            <Input
              id="group-topup"
              type="number"
              step="0.01"
              value={form.topup_ratio}
              onChange={(e) => setNum('topup_ratio', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-upgrade-threshold">
              {t('Upgrade threshold')}
            </Label>
            <Input
              id="group-upgrade-threshold"
              type="number"
              value={form.upgrade_threshold}
              onChange={(e) => setNum('upgrade_threshold', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-auto-order">{t('Auto order')}</Label>
            <Input
              id="group-auto-order"
              type="number"
              value={form.auto_order}
              onChange={(e) => setNum('auto_order', e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y rounded-lg border">
          {toggles.map((tg) => (
            <label
              key={tg.key}
              className="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3"
            >
              <span className="text-sm">{tg.label}</span>
              <Switch
                checked={tg.checked}
                onCheckedChange={(v) => set(tg.key, v)}
              />
            </label>
          ))}
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button onClick={save} disabled={saving}>
          {t('Save')}
        </Button>
        <Button
          variant="destructive"
          className="ml-auto"
          onClick={remove}
          disabled={deleting}
        >
          {t('Delete group')}
        </Button>
      </CardFooter>
    </Card>
  )
}
