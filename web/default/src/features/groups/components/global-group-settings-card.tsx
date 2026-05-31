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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { updateSystemOption } from '@/features/system-settings/api'
import type { GroupManageListData } from '../types'

type Props = { data: GroupManageListData; onSaved: () => void }

export function GlobalGroupSettingsCard({ data, onSaved }: Props) {
  const { t } = useTranslation()
  const [defChannel, setDefChannel] = useState(data.default_channel_group)
  const [newUser, setNewUser] = useState(data.new_user_default_group)
  const [useAuto, setUseAuto] = useState(data.default_use_auto_group)
  const [saving, setSaving] = useState(false)

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default-channel-group">
            {t('Default channel group')}
          </Label>
          <Input
            id="default-channel-group"
            value={defChannel}
            onChange={(e) => setDefChannel(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-user-default-group">
            {t('New user default group')}
          </Label>
          <Input
            id="new-user-default-group"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2">
          <Switch checked={useAuto} onCheckedChange={setUseAuto} />
          <span>{t('New tokens default to auto group')}</span>
        </label>
        <Button onClick={save} disabled={saving}>
          {t('Save')}
        </Button>
      </CardContent>
    </Card>
  )
}
