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

  // Single shared selection across both lists: only one item is highlighted
  // at a time, and the right-side detail panel renders by its type.
  type Selection = { type: 'recharge' | 'consumption'; name: string } | null
  const [selection, setSelection] = useState<Selection>(null)

  const [recharge, setRecharge] = useState<RechargeGroup[]>([])
  const reloadRecharge = async () => {
    const res = await getRechargeGroups()
    if (res.success) setRecharge(res.data.groups)
  }

  const [consumption, setConsumption] = useState<ConsumptionGroupListData | null>(null)
  const reloadConsumption = async () => {
    const res = await getConsumptionGroups()
    if (res.success) setConsumption(res.data)
  }

  useEffect(() => {
    void reloadRecharge()
    void reloadConsumption()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the selection valid as data loads/changes; default to the first
  // consumption group, falling back to the first recharge group.
  useEffect(() => {
    setSelection((prev) => {
      if (prev?.type === 'recharge' && recharge.some((g) => g.name === prev.name))
        return prev
      if (
        prev?.type === 'consumption' &&
        consumption?.groups.some((g) => g.name === prev.name)
      )
        return prev
      if (consumption?.groups[0])
        return { type: 'consumption', name: consumption.groups[0].name }
      if (recharge[0]) return { type: 'recharge', name: recharge[0].name }
      return null
    })
  }, [recharge, consumption])

  const selRecharge: RechargeGroup | undefined =
    selection?.type === 'recharge'
      ? recharge.find((g) => g.name === selection.name)
      : undefined
  const selCons: ConsumptionGroupItem | undefined =
    selection?.type === 'consumption'
      ? consumption?.groups.find((g) => g.name === selection.name)
      : undefined

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Groups')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className="flex flex-col gap-4">
          {consumption && (
            <GlobalGroupSettingsCard
              data={consumption}
              rechargeGroups={recharge}
              onSaved={reloadConsumption}
            />
          )}
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[260px_1fr]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-medium text-muted-foreground">
                  {t('Consumption Groups')}
                </h3>
                <GroupsList
                  groups={consumption?.groups ?? []}
                  selected={
                    selection?.type === 'consumption' ? selection.name : null
                  }
                  onSelect={(name) => setSelection({ type: 'consumption', name })}
                  onChanged={reloadConsumption}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-medium text-muted-foreground">
                  {t('Recharge Groups')}
                </h3>
                <RechargeGroupsList
                  groups={recharge}
                  selected={selection?.type === 'recharge' ? selection.name : null}
                  onSelect={(name) => setSelection({ type: 'recharge', name })}
                  onChanged={reloadRecharge}
                />
              </div>
            </div>

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
            {selRecharge && (
              <RechargeGroupDetailForm
                key={selRecharge.name}
                group={selRecharge}
                onChanged={reloadRecharge}
              />
            )}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
