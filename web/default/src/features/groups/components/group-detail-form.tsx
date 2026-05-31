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
import { GroupChannelsTable } from './group-channels-table'

type Props = { group: GroupManageItem; onChanged: () => void }

export function GroupDetailForm({ group, onChanged }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<GroupManageItem>(group)

  const set = <K extends keyof GroupManageItem>(
    k: K,
    v: GroupManageItem[K]
  ) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const res = await updateGroup(group.name, form)
    if (res.success) {
      toast.success(t('Saved'))
      onChanged()
    } else {
      toast.error(res.message || t('Failed'))
    }
  }

  const remove = async () => {
    const res = await deleteGroup(group.name)
    if (res.success) {
      toast.success(t('Deleted'))
      onChanged()
    } else {
      toast.error(res.message || t('Failed'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-name">{t('Group name')}</Label>
          <Input id="group-name" value={form.name} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-description">{t('Description')}</Label>
          <Input
            id="group-description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-consumption">{t('Consumption ratio')}</Label>
          <Input
            id="group-consumption"
            type="number"
            step="0.01"
            value={form.consumption_ratio}
            onChange={(e) =>
              set('consumption_ratio', Number(e.target.value))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-topup">{t('Topup ratio')}</Label>
          <Input
            id="group-topup"
            type="number"
            step="0.01"
            value={form.topup_ratio}
            onChange={(e) => set('topup_ratio', Number(e.target.value))}
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
          <Label htmlFor="group-upgrade-threshold">
            {t('Upgrade threshold')}
          </Label>
          <Input
            id="group-upgrade-threshold"
            type="number"
            value={form.upgrade_threshold}
            onChange={(e) =>
              set('upgrade_threshold', Number(e.target.value))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-auto-order">{t('Auto order')}</Label>
          <Input
            id="group-auto-order"
            type="number"
            value={form.auto_order}
            onChange={(e) => set('auto_order', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-2">
          <span>{t('Admin only')}</span>
          <Switch
            checked={form.admin_only}
            onCheckedChange={(v) => set('admin_only', v)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>{t('Auto upgrade')}</span>
          <Switch
            checked={form.auto_upgrade}
            onCheckedChange={(v) => set('auto_upgrade', v)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>{t('In auto rotation')}</span>
          <Switch
            checked={form.in_auto_rotation}
            onCheckedChange={(v) => set('in_auto_rotation', v)}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <Button onClick={save}>{t('Save')}</Button>
        <Button variant="destructive" onClick={remove}>
          {t('Delete group')}
        </Button>
      </div>

      <GroupChannelsTable groupName={group.name} onChanged={onChanged} />
    </div>
  )
}
