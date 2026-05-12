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

export interface PricingFilterBarProps {
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

function Chip(props: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  label: string
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap',
        props.active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
      )}
    >
      {props.icon && <span className='shrink-0'>{props.icon}</span>}
      {props.label}
    </button>
  )
}

function FilterRow(props: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex items-start gap-0'>
      <span className='text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 shrink-0 self-center mr-3 hidden lg:inline-block'>
        {props.label}
      </span>
      <div className='flex gap-1.5 overflow-x-auto hover-scrollbar pb-1 -mb-1'>
        {props.children}
      </div>
    </div>
  )
}

export function PricingFilterBar(props: PricingFilterBarProps) {
  const { t } = useTranslation()
  const quotaTypeLabels = getQuotaTypeLabels(t)

  const isPerSecond = (model: PricingModel) =>
    parseTags(model.tags)
      .map((tag) => tag.toUpperCase())
      .includes(PER_SECOND_TAG)

  const quotaOptions = [
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

  const sortedVendors = [...props.vendors].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const knownVendorOptions = sortedVendors
    .map((vendor) => ({
      value: vendor.name,
      label: vendor.name,
      count: countBy(
        props.models,
        (model) => model.vendor_name === vendor.name
      ),
      icon: vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined,
    }))
    .filter((entry) => entry.count > 0)

  const othersCount = countBy(props.models, (model) => !model.vendor_name)
  const vendorOptions = [
    ...knownVendorOptions,
    ...(othersCount > 0
      ? [{ value: VENDOR_OTHERS, label: t('Others'), count: othersCount, icon: undefined }]
      : []),
  ]

  const tagOptions = props.tags.map((tag) => ({ value: tag, label: tag }))

  const showPricingRow = quotaOptions.length > 1
  const showTagsRow = tagOptions.length > 0
  const showVendorsRow = vendorOptions.length > 0

  if (!showPricingRow && !showTagsRow && !showVendorsRow) return null

  return (
    <div className={cn('flex flex-col gap-2', props.className)}>
      {showPricingRow && (
        <FilterRow label={t('Pricing Type')}>
          {quotaOptions.map((opt) => (
            <Chip
              key={opt.value}
              active={props.quotaTypeFilter === opt.value}
              onClick={() => props.onQuotaTypeChange(opt.value)}
              label={opt.label}
            />
          ))}
        </FilterRow>
      )}

      {showTagsRow && (
        <FilterRow label={t('Model Tags')}>
          <Chip
            active={props.tagFilter === FILTER_ALL}
            onClick={() => props.onTagChange(FILTER_ALL)}
            label={t('All Tags')}
          />
          {tagOptions.map((opt) => (
            <Chip
              key={opt.value}
              active={props.tagFilter === opt.value}
              onClick={() => props.onTagChange(opt.value)}
              label={opt.label}
            />
          ))}
        </FilterRow>
      )}

      {showVendorsRow && (
        <FilterRow label={t('Vendors')}>
          <Chip
            active={props.vendorFilter === FILTER_ALL}
            onClick={() =>
              props.onVendorChange(FILTER_ALL)
            }
            label={t('All')}
          />
          {vendorOptions.map((opt) => (
            <Chip
              key={opt.value}
              active={props.vendorFilter === opt.value}
              onClick={() =>
                props.onVendorChange(
                  opt.value === props.vendorFilter ? FILTER_ALL : opt.value
                )
              }
              icon={opt.icon}
              label={opt.label}
            />
          ))}
        </FilterRow>
      )}
    </div>
  )
}
