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
import { useCallback, useState } from 'react'
import {
  Check,
  ChevronDown,
  Filter,
  Grid2X2,
  RefreshCw,
  Table2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { VIEW_MODES, type ViewMode } from '../constants'
import type { PricingModel, PricingVendor } from '../types'
import { PricingSidebar } from './pricing-sidebar'
import { SearchBar } from './search-bar'

type SegmentOption = {
  value: string
  icon?: React.ComponentType<{ className?: string }>
  tooltip?: string
}

export interface PricingToolbarProps {
  viewMode: ViewMode
  onViewModeChange: (value: ViewMode) => void
  quotaTypeFilter: string
  vendorFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  tags: string[]
  models: PricingModel[]
  activeFilterCount: number
  /** Search input value (now lives inside the toolbar row). */
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  /** Channel groups visible to the current user. */
  availableGroups?: string[]
  groupRatio?: Record<string, number>
  previewGroup?: string
  onPreviewGroupChange?: (value: string) => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

function SegmentedControl(props: {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div
      role='group'
      aria-label={props.ariaLabel}
      className='bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5'
    >
      {props.options.map((option) => {
        const Icon = option.icon
        const isActive = option.value === props.value
        const button = (
          <button
            key={option.value}
            type='button'
            onClick={() => props.onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-full w-7 items-center justify-center rounded-md text-xs font-medium transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className='size-3.5' />}
          </button>
        )

        if (!option.tooltip) {
          return button
        }

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger render={button}></TooltipTrigger>
            <TooltipContent side='bottom' className='text-xs'>
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const handleViewModeChange = useCallback(
    (value: string) => props.onViewModeChange(value as ViewMode),
    [props]
  )

  const groupOptions = props.availableGroups ?? []
  const previewGroupLabel = props.previewGroup ?? ''

  return (
    <div className='flex items-center gap-2'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => setMobileFiltersOpen(true)}
        className='shrink-0 gap-1.5 xl:hidden'
      >
        <Filter className='size-4' />
        {t('Filter')}
        {props.activeFilterCount > 0 && (
          <Badge className='ml-0.5 size-5 justify-center p-0 text-[10px]'>
            {props.activeFilterCount}
          </Badge>
        )}
      </Button>

      <SearchBar
        value={props.searchValue}
        onChange={props.onSearchChange}
        onClear={props.onSearchClear}
        placeholder={t('Search models...')}
        className='min-w-0 flex-1'
      />

      {props.onPreviewGroupChange && groupOptions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-9 shrink-0 gap-1.5 px-3 text-xs'
              />
            }
          >
            <span className='truncate font-semibold tracking-wide uppercase'>
              {previewGroupLabel || t('Group')}
            </span>
            <ChevronDown className='size-3.5' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {groupOptions.map((group) => (
              <DropdownMenuItem
                key={group}
                onClick={() => props.onPreviewGroupChange?.(group)}
                className='gap-2'
              >
                <Check
                  className={cn(
                    'size-4 shrink-0',
                    previewGroupLabel === group ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className='flex-1 truncate'>{group}</span>
                {props.groupRatio?.[group] != null && (
                  <span className='text-muted-foreground tabular-nums'>
                    ×{props.groupRatio[group]}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {props.onRefresh && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={props.onRefresh}
                disabled={props.isRefreshing}
                aria-label={t('Refresh')}
                className='size-9 shrink-0'
              />
            }
          >
            <RefreshCw
              className={cn('size-3.5', props.isRefreshing && 'animate-spin')}
            />
          </TooltipTrigger>
          <TooltipContent side='bottom' className='text-xs'>
            {t('Refresh')}
          </TooltipContent>
        </Tooltip>
      )}

      <SegmentedControl
        options={[
          { value: VIEW_MODES.CARD, icon: Grid2X2, tooltip: t('Card view') },
          { value: VIEW_MODES.TABLE, icon: Table2, tooltip: t('Table view') },
        ]}
        value={props.viewMode}
        onChange={handleViewModeChange}
        ariaLabel={t('View mode')}
      />

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side='right'
          className='flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-md'
        >
          <SheetHeader className='border-b px-4 py-3 sm:px-6 sm:py-4'>
            <SheetTitle>{t('Filter')}</SheetTitle>
            <SheetDescription>
              {t('Refine models by pricing type, tags, and provider.')}
            </SheetDescription>
          </SheetHeader>
          <div className='flex-1 overflow-y-auto p-3 sm:p-4'>
            <PricingSidebar
              quotaTypeFilter={props.quotaTypeFilter}
              vendorFilter={props.vendorFilter}
              tagFilter={props.tagFilter}
              onQuotaTypeChange={props.onQuotaTypeChange}
              onVendorChange={props.onVendorChange}
              onTagChange={props.onTagChange}
              vendors={props.vendors}
              tags={props.tags}
              models={props.models}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
