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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import {
  FILTER_ALL,
  PER_SECOND_TAG,
  QUOTA_TYPES,
  getQuotaTypeLabels,
} from '../constants'
import { VENDOR_OTHERS, parseTags } from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'

type FilterOption = {
  value: string
  label: string
  icon?: ReactNode
}

type FilterSectionProps = {
  title: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export interface PricingSidebarProps {
  quotaTypeFilter: string
  vendorFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  tags: string[]
  models: PricingModel[]
  className?: string
}

function countBy(
  models: PricingModel[],
  predicate: (model: PricingModel) => boolean
): number {
  return models.reduce((count, model) => count + (predicate(model) ? 1 : 0), 0)
}

function MenuItem(props: {
  option: FilterOption
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        props.active
          ? 'bg-foreground text-background font-semibold'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
      title={props.option.label}
    >
      {props.option.icon && (
        <span
          className={cn(
            'shrink-0',
            props.active ? 'text-background' : 'text-muted-foreground'
          )}
        >
          {props.option.icon}
        </span>
      )}
      <span className='truncate'>{props.option.label}</span>
    </button>
  )
}

function FilterSection(props: FilterSectionProps) {
  return (
    <div className='pb-4'>
      <h3 className='text-muted-foreground/70 mb-1.5 px-3 text-xs font-semibold tracking-wider'>
        {props.title}
      </h3>
      <div className='flex flex-col gap-0.5'>
        {props.options.map((option) => (
          <MenuItem
            key={option.value}
            option={option}
            active={props.value === option.value}
            onClick={() => props.onChange(option.value)}
          />
        ))}
      </div>
    </div>
  )
}

export function PricingSidebar(props: PricingSidebarProps) {
  const { t } = useTranslation()
  const quotaTypeLabels = getQuotaTypeLabels(t)

  const sortedVendors = [...props.vendors].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const knownVendorEntries: FilterOption[] = sortedVendors
    .map((vendor) => ({
      value: vendor.name,
      label: vendor.name,
      count: countBy(
        props.models,
        (model) => model.vendor_name === vendor.name
      ),
      icon: vendor.icon ? getLobeIcon(vendor.icon, 16) : undefined,
    }))
    .filter((entry) => entry.count > 0)
    .map(({ value, label, icon }) => ({ value, label, icon }))

  const othersCount = countBy(props.models, (model) => !model.vendor_name)
  const vendorOptions: FilterOption[] = [
    ...knownVendorEntries,
    ...(othersCount > 0
      ? [
          {
            value: VENDOR_OTHERS,
            label: t('Others'),
          },
        ]
      : []),
  ]

  const isPerSecond = (model: PricingModel) =>
    parseTags(model.tags)
      .map((tag) => tag.toUpperCase())
      .includes(PER_SECOND_TAG)

  const quotaOptions: FilterOption[] = [
    { value: QUOTA_TYPES.ALL, label: quotaTypeLabels[QUOTA_TYPES.ALL] },
    { value: QUOTA_TYPES.TOKEN, label: quotaTypeLabels[QUOTA_TYPES.TOKEN] },
    { value: QUOTA_TYPES.REQUEST, label: quotaTypeLabels[QUOTA_TYPES.REQUEST] },
    {
      value: QUOTA_TYPES.PER_SECOND,
      label: quotaTypeLabels[QUOTA_TYPES.PER_SECOND],
    },
  ].filter((opt) => {
    if (opt.value === QUOTA_TYPES.ALL) return true
    if (opt.value === QUOTA_TYPES.PER_SECOND) {
      return props.models.some(
        (model) => model.quota_type === 0 && isPerSecond(model)
      )
    }
    if (opt.value === QUOTA_TYPES.REQUEST) {
      return props.models.some((model) => model.quota_type === 1)
    }
    return props.models.some(
      (model) => model.quota_type === 0 && !isPerSecond(model)
    )
  })

  const tagOptions: FilterOption[] = [
    { value: FILTER_ALL, label: t('All Tags') },
    ...props.tags.map((tag) => ({ value: tag, label: tag })),
  ]

  return (
    <aside className={cn('py-3', props.className)}>
      <FilterSection
        title={t('Pricing Type')}
        value={props.quotaTypeFilter}
        options={quotaOptions}
        onChange={props.onQuotaTypeChange}
      />
      <FilterSection
        title={t('Model Tags')}
        value={props.tagFilter}
        options={tagOptions}
        onChange={props.onTagChange}
      />
      <FilterSection
        title={t('Vendors')}
        value={props.vendorFilter}
        options={vendorOptions}
        onChange={(v) =>
          props.onVendorChange(v === props.vendorFilter ? FILTER_ALL : v)
        }
      />
    </aside>
  )
}
