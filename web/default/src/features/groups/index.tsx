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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { getGroupManageList } from './api'
import type { GroupManageItem, GroupManageListData } from './types'
import { GroupsList } from './components/groups-list'
import { GroupDetailForm } from './components/group-detail-form'
import { GroupChannelsTable } from './components/group-channels-table'
import { GlobalGroupSettingsCard } from './components/global-group-settings-card'

export function Groups() {
  const { t } = useTranslation()
  const [data, setData] = useState<GroupManageListData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const reload = async () => {
    const res = await getGroupManageList()
    if (res.success) {
      setData(res.data)
      setSelected((prev) => {
        if (prev && res.data.groups.some((g) => g.name === prev)) {
          return prev
        }
        return res.data.groups.length > 0 ? res.data.groups[0].name : null
      })
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedGroup: GroupManageItem | undefined = data?.groups.find(
    (g) => g.name === selected
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Groups')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {data && <GlobalGroupSettingsCard data={data} onSaved={reload} />}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
          <GroupsList
            groups={data?.groups ?? []}
            selected={selected}
            onSelect={setSelected}
            onChanged={reload}
          />
          {selectedGroup && (
            <div className="flex min-w-0 flex-col gap-4">
              <GroupDetailForm
                key={selectedGroup.name}
                group={selectedGroup}
                onChanged={reload}
              />
              <GroupChannelsTable
                key={`${selectedGroup.name}-channels`}
                groupName={selectedGroup.name}
                onChanged={reload}
              />
            </div>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
