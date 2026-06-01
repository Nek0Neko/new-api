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
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { deleteRechargeGroup, updateRechargeGroup } from '../api'
import type { RechargeGroup } from '../types'

type Props = { group: RechargeGroup; onChanged: () => void }

export function RechargeGroupDetailForm({ group, onChanged }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<RechargeGroup>(group)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof RechargeGroup>(k: K, v: RechargeGroup[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setNum = (k: keyof RechargeGroup, raw: string) => {
    const n = Number(raw)
    set(k, (Number.isNaN(n) ? 0 : n) as RechargeGroup[typeof k])
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await updateRechargeGroup(group.name, form)
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
      const res = await deleteRechargeGroup(group.name)
      if (res.success) {
        toast.success(t('Deleted'))
        onChanged()
      }
    } finally {
      setDeleting(false)
    }
  }

  const toggles = [
    { key: 'admin_only' as const, label: t('Admin only'), checked: form.admin_only },
    { key: 'auto_upgrade' as const, label: t('Auto upgrade'), checked: form.auto_upgrade },
  ]

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="truncate">{form.name}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recharge-description">{t('Description')}</Label>
            <Input
              id="recharge-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recharge-topup">{t('Topup ratio')}</Label>
            <Input
              id="recharge-topup"
              type="number"
              step="0.01"
              value={form.topup_ratio}
              onChange={(e) => setNum('topup_ratio', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recharge-upgrade-threshold">
              {t('Upgrade threshold')}
            </Label>
            <Input
              id="recharge-upgrade-threshold"
              type="number"
              value={form.upgrade_threshold}
              onChange={(e) => setNum('upgrade_threshold', e.target.value)}
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
