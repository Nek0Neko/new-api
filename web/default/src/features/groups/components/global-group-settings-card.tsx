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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { updateSystemOption } from '@/features/system-settings/api'
import type { ConsumptionGroupListData, RechargeGroup } from '../types'

type Props = {
  data: ConsumptionGroupListData
  rechargeGroups: RechargeGroup[]
  onSaved: () => void
}

type GroupOption = { name: string; description?: string }

// Build a deduped option list from the available groups, guaranteeing the
// currently-saved value stays selectable even if it was since removed.
function buildOptions(groups: GroupOption[], current: string): GroupOption[] {
  const seen = new Set<string>()
  const out: GroupOption[] = []
  for (const g of groups) {
    if (!g.name || seen.has(g.name)) continue
    seen.add(g.name)
    out.push(g)
  }
  if (current && !seen.has(current)) out.unshift({ name: current })
  return out
}

export function GlobalGroupSettingsCard({ data, rechargeGroups, onSaved }: Props) {
  const { t } = useTranslation()
  const [defChannel, setDefChannel] = useState(data.default_channel_group)
  const [newUser, setNewUser] = useState(data.new_user_default_group)
  const [useAuto, setUseAuto] = useState(data.default_use_auto_group)
  const [saving, setSaving] = useState(false)

  // Default channel group is a consumption-group axis (tokens pick these at
  // API-key creation time); new-user default group is a recharge-tier axis.
  const channelOptions = useMemo(
    () => buildOptions(data.groups, defChannel),
    [data.groups, defChannel]
  )
  const newUserOptions = useMemo(
    () => buildOptions(rechargeGroups, newUser),
    [rechargeGroups, newUser]
  )

  const save = async () => {
    setSaving(true)
    try {
      await updateSystemOption({ key: 'DefaultChannelGroup', value: defChannel })
      await updateSystemOption({ key: 'NewUserDefaultGroup', value: newUser })
      await updateSystemOption({
        key: 'DefaultUseAutoGroup',
        value: String(useAuto),
      })
      toast.success(t('Saved'))
      onSaved()
    } catch {
      toast.error(t('Failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{t('Default channel group')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="flex w-56 flex-col gap-1.5">
          <Label htmlFor="default-channel-group">
            {t('Default channel group')}
          </Label>
          <Select
            value={defChannel}
            onValueChange={(value) => setDefChannel(value ?? '')}
          >
            <SelectTrigger id="default-channel-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channelOptions.map((o) => (
                <SelectItem key={o.name} value={o.name}>
                  {o.description ? `${o.name} — ${o.description}` : o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-56 flex-col gap-1.5">
          <Label htmlFor="new-user-default-group">
            {t('New user default group')}
          </Label>
          <Select
            value={newUser}
            onValueChange={(value) => setNewUser(value ?? '')}
          >
            <SelectTrigger id="new-user-default-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {newUserOptions.map((o) => (
                <SelectItem key={o.name} value={o.name}>
                  {o.description ? `${o.name} — ${o.description}` : o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex h-9 items-center gap-2">
          <Switch checked={useAuto} onCheckedChange={setUseAuto} />
          <span>{t('New tokens default to auto group')}</span>
        </label>
        <Button className="ml-auto" onClick={save} disabled={saving}>
          {t('Save')}
        </Button>
      </CardContent>
    </Card>
  )
}
