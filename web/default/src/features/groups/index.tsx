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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { getRechargeGroups, getConsumptionGroups } from './api'
import type {
  RechargeGroup,
  ConsumptionGroupItem,
  ConsumptionGroupListData,
} from './types'
import { RechargeGroupsList } from './components/recharge-groups-list'
import { RechargeGroupDetailForm } from './components/recharge-group-detail-form'
import { GroupsList } from './components/groups-list'
import { GroupDetailForm } from './components/group-detail-form'
import { GroupChannelsTable } from './components/group-channels-table'
import { GlobalGroupSettingsCard } from './components/global-group-settings-card'

export function Groups() {
  const { t } = useTranslation()

  const [recharge, setRecharge] = useState<RechargeGroup[]>([])
  const [rechargeSel, setRechargeSel] = useState<string | null>(null)
  const reloadRecharge = async () => {
    const res = await getRechargeGroups()
    if (res.success) {
      setRecharge(res.data.groups)
      setRechargeSel((prev) =>
        prev && res.data.groups.some((g) => g.name === prev)
          ? prev
          : (res.data.groups[0]?.name ?? null)
      )
    }
  }

  const [consumption, setConsumption] = useState<ConsumptionGroupListData | null>(null)
  const [consSel, setConsSel] = useState<string | null>(null)
  const reloadConsumption = async () => {
    const res = await getConsumptionGroups()
    if (res.success) {
      setConsumption(res.data)
      setConsSel((prev) =>
        prev && res.data.groups.some((g) => g.name === prev)
          ? prev
          : (res.data.groups[0]?.name ?? null)
      )
    }
  }

  useEffect(() => {
    void reloadRecharge()
    void reloadConsumption()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selRecharge: RechargeGroup | undefined = recharge.find(
    (g) => g.name === rechargeSel
  )
  const selCons: ConsumptionGroupItem | undefined = consumption?.groups.find(
    (g) => g.name === consSel
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Groups')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs defaultValue="consumption">
          <TabsList>
            <TabsTrigger value="consumption">{t('Consumption Groups')}</TabsTrigger>
            <TabsTrigger value="recharge">{t('Recharge Groups')}</TabsTrigger>
          </TabsList>

          <TabsContent value="consumption" className="flex flex-col gap-4">
            {consumption && (
              <GlobalGroupSettingsCard data={consumption} onSaved={reloadConsumption} />
            )}
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
              <GroupsList
                groups={consumption?.groups ?? []}
                selected={consSel}
                onSelect={setConsSel}
                onChanged={reloadConsumption}
              />
              {selCons && (
                <div className="flex min-w-0 flex-col gap-4">
                  <GroupDetailForm
                    key={selCons.name}
                    group={selCons}
                    onChanged={reloadConsumption}
                  />
                  <GroupChannelsTable
                    key={`${selCons.name}-channels`}
                    groupName={selCons.name}
                    onChanged={reloadConsumption}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recharge">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
              <RechargeGroupsList
                groups={recharge}
                selected={rechargeSel}
                onSelect={setRechargeSel}
                onChanged={reloadRecharge}
              />
              {selRecharge && (
                <RechargeGroupDetailForm
                  key={selRecharge.name}
                  group={selRecharge}
                  onChanged={reloadRecharge}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
