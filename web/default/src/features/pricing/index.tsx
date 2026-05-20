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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Info, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import {
  LoadingSkeleton,
  EmptyState,
  PricingTable,
  PricingToolbar,
  PricingFilterBar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'

const DEFAULT_GROUP = 'default'

function formatRatio(ratio: number): string {
  if (Number.isInteger(ratio)) return ratio.toString()
  return ratio.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    userTier,
    isLoading,
    isFetching,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const {
    searchInput,
    vendorFilter,
    quotaTypeFilter,
    tagFilter,
    tokenUnit,
    viewMode,
    showRechargePrice,
    setSearchInput,
    setVendorFilter,
    setQuotaTypeFilter,
    setTagFilter,
    setViewMode,
    filteredModels,
    hasActiveFilters,
    availableTags,
    clearFilters,
    clearSearch,
  } = useFilters(models || [])

  const availableGroups = useMemo(
    () => Object.keys(usableGroup || {}),
    [usableGroup]
  )

  const [previewGroup, setPreviewGroup] = useState<string>(
    () => userTier || DEFAULT_GROUP
  )

  // Reset preview group when the user's tier or available group set changes.
  useEffect(() => {
    if (!availableGroups.length) return
    if (availableGroups.includes(previewGroup)) return
    const fallback =
      userTier && availableGroups.includes(userTier)
        ? userTier
        : availableGroups[0]
    setPreviewGroup(fallback)
  }, [availableGroups, previewGroup, userTier])

  const previewRatio = groupRatio?.[previewGroup]
  const previewIsUserGroup = Boolean(userTier && previewGroup === userTier)

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  // Only show models whose enable_groups include the currently selected
  // preview group. Special / discounted groups frequently enable a subset of
  // the full catalog, so the list must reflect what the user can actually
  // call under that group — not just the price ratio.
  const visibleModels = useMemo(() => {
    if (!previewGroup) return filteredModels
    return filteredModels.filter(
      (model) =>
        Array.isArray(model.enable_groups) &&
        model.enable_groups.includes(previewGroup)
    )
  }, [filteredModels, previewGroup])

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const renderPricingContent = () => {
    if (visibleModels.length === 0) {
      return (
        <EmptyState
          searchQuery={searchInput}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    if (viewMode === VIEW_MODES.CARD) {
      return (
        <ModelCardGrid
          models={visibleModels}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
          previewGroup={previewGroup}
          groupRatio={groupRatio}
        />
      )
    }

    return (
      <PricingTable
        models={visibleModels}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        onModelClick={handleModelClick}
        previewGroup={previewGroup}
        groupRatio={groupRatio}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1800px] px-3 pt-8 pb-8 sm:px-6 sm:pt-12 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  if (error && (models?.length ?? 0) === 0) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto flex w-full max-w-2xl flex-col items-center px-3 pt-24 pb-8 text-center sm:px-6 sm:pt-32 sm:pb-10'>
          <AlertCircle
            className='text-muted-foreground mb-4 size-10'
            aria-hidden
          />
          <h2 className='text-foreground text-xl font-semibold'>
            {t('Failed to load models')}
          </h2>
          <p className='text-muted-foreground/80 mt-2 max-w-md text-sm'>
            {error instanceof Error
              ? error.message
              : t('Please check your network and try again.')}
          </p>
          <Button
            type='button'
            variant='default'
            size='sm'
            onClick={() => {
              void refetch()
            }}
            disabled={isFetching}
            className='mt-5 gap-1.5'
          >
            <RefreshCw
              className={cn('size-3.5', isFetching && 'animate-spin')}
            />
            {t('Retry')}
          </Button>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1800px] px-3 pt-8 pb-8 sm:px-6 sm:pt-12 sm:pb-10 xl:px-8'>
        <header className='mb-4 sm:mb-5'>
          <h1 className='text-foreground text-2xl font-bold tracking-tight sm:text-3xl'>
            {t('Model Library')}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm sm:text-base'>
            {t('Browse and filter all integrated models')}
          </p>
        </header>

        <div
          role='note'
          className='border-border/60 bg-muted/40 text-muted-foreground mb-6 flex items-start gap-2 rounded-md border px-3 py-2 text-xs sm:mb-8 sm:text-sm'
        >
          <Info
            className='text-foreground/70 mt-0.5 size-4 shrink-0'
            aria-hidden
          />
          <span>
            {t(
              'Prices update in real time as you switch groups. Click any model card for full billing details.'
            )}
          </span>
        </div>

        <main className='min-w-0 space-y-4'>
          <div className='bg-background/80 border-border/60 sticky top-0 z-20 -mx-3 border-b px-3 pt-20 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8'>
            <PricingToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              onSearchClear={clearSearch}
              availableGroups={availableGroups}
              groupRatio={groupRatio}
              previewGroup={previewGroup}
              onPreviewGroupChange={setPreviewGroup}
              onRefresh={() => {
                void refetch()
              }}
              isRefreshing={isFetching}
            />
            <PricingFilterBar
              quotaTypeFilter={quotaTypeFilter}
              vendorFilter={vendorFilter}
              tagFilter={tagFilter}
              onQuotaTypeChange={setQuotaTypeFilter}
              onVendorChange={setVendorFilter}
              onTagChange={setTagFilter}
              vendors={vendors || []}
              tags={availableTags}
              models={models || []}
              className='mt-3'
            />
          </div>

          <p className='text-muted-foreground flex items-center gap-2 text-xs sm:text-sm'>
            <span>
              <span className='text-foreground font-semibold tabular-nums'>
                {visibleModels.length.toLocaleString()}
              </span>{' '}
              {t('results')}
            </span>
            {previewGroup && (
              <>
                <span className='text-border'>·</span>
                <span className='flex items-center gap-1'>
                  <span className='text-foreground font-semibold'>
                    {previewGroup}
                  </span>
                  {previewRatio != null && (
                    <span className='text-foreground font-mono tabular-nums'>
                      ×{formatRatio(previewRatio)}
                    </span>
                  )}
                  {previewIsUserGroup && (
                    <span className='inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300'>
                      {t('My group')}
                    </span>
                  )}
                </span>
              </>
            )}
          </p>

          {renderPricingContent()}
        </main>

        {selectedModel && (
          <ModelDetailsDrawer
            open={Boolean(selectedModel)}
            onOpenChange={(open) => {
              if (!open) setSelectedModelName(null)
            }}
            model={selectedModel}
            groupRatio={groupRatio || {}}
            usableGroup={usableGroup || {}}
            endpointMap={
              (endpointMap as Record<
                string,
                { path?: string; method?: string }
              >) || {}
            }
            autoGroups={autoGroups || []}
            priceRate={priceRate ?? 1}
            usdExchangeRate={usdExchangeRate ?? 1}
            tokenUnit={tokenUnit}
            showRechargePrice={showRechargePrice}
          />
        )}
      </PageTransition>
    </PublicLayout>
  )
}

// Note: sortBy is still tracked in useFilters for backwards-compat URLs but no
// longer surfaces in the UI; the same applies to tokenUnit (forced to 'M' for
// display) and showRechargePrice. Existing search params keep working.
export type { PricingToolbarProps } from './components/pricing-toolbar'
