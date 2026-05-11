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
import { memo } from 'react'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import { parseTags } from '../lib/filters'
import { getBillingMode } from '../lib/model-helpers'
import {
  formatFixedPrice,
  formatGroupPrice,
  formatPrice,
  formatRequestPrice,
} from '../lib/price'
import type { PricingModel, TokenUnit } from '../types'
import { type ModelPerfBadgeData } from './model-perf-badge'

const TAG_DISPLAY_LIMIT = 3

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  previewGroup?: string
  groupRatio?: Record<string, number>
  /** Reserved for the next iteration's TPS/latency badge. */
  perf?: ModelPerfBadgeData
}

function priceForPreview(
  model: PricingModel,
  type: 'input' | 'output',
  tokenUnit: TokenUnit,
  showRechargePrice: boolean,
  priceRate: number,
  usdExchangeRate: number,
  previewGroup: string | undefined,
  groupRatio: Record<string, number> | undefined
): string {
  if (previewGroup && groupRatio && previewGroup in groupRatio) {
    return formatGroupPrice(
      model,
      previewGroup,
      type,
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatio
    )
  }
  return formatPrice(
    model,
    type,
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate
  )
}

function fixedPriceForPreview(
  model: PricingModel,
  showRechargePrice: boolean,
  priceRate: number,
  usdExchangeRate: number,
  previewGroup: string | undefined,
  groupRatio: Record<string, number> | undefined
): string {
  if (previewGroup && groupRatio && previewGroup in groupRatio) {
    return formatFixedPrice(
      model,
      previewGroup,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatio
    )
  }
  return formatRequestPrice(
    model,
    showRechargePrice,
    priceRate,
    usdExchangeRate
  )
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const billingMode = getBillingMode(props.model)
  const isToken = billingMode === 'token'
  const isPerSecond = billingMode === 'per_second'
  const tokenUnitLabel = tokenUnit === 'K' ? 'K' : 'M'
  const tags = parseTags(props.model.tags).slice(0, TAG_DISPLAY_LIMIT)
  const vendorName = props.model.vendor_name?.toUpperCase()
  const vendorIcon = props.model.vendor_icon
    ? getLobeIcon(props.model.vendor_icon, 18)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  const billingLabel = isToken
    ? t('Token-based')
    : isPerSecond
      ? t('Per Second')
      : t('Per Request')
  const billingActive = !isToken

  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'group bg-card hover:border-foreground/30 flex flex-col rounded-xl border p-5 text-left transition-colors'
      )}
    >
      {/* Vendor row + model name + copy */}
      <div className='flex items-start gap-3'>
        <div className='bg-muted/50 flex size-9 shrink-0 items-center justify-center rounded-lg'>
          {vendorIcon ?? (
            <span className='text-muted-foreground text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          {vendorName && (
            <span className='text-muted-foreground/80 text-[10px] font-semibold tracking-[0.12em] uppercase'>
              {vendorName}
            </span>
          )}
          <div className='mt-0.5 flex items-center gap-1.5'>
            <h3 className='text-foreground truncate font-mono text-[15px] leading-tight font-bold'>
              {props.model.model_name}
            </h3>
            <span
              onClick={handleCopy}
              role='button'
              aria-label={t('Copy')}
              className='text-muted-foreground/50 hover:text-foreground shrink-0 cursor-pointer rounded-md p-1 transition-colors'
            >
              <Copy className='size-3' />
            </span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className='mt-3 flex flex-wrap gap-1.5'>
          {tags.map((tag) => (
            <span
              key={tag}
              className='bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase'
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className='border-border/60 my-4 border-t' />

      {/* Pricing footer */}
      <div className='grid grid-cols-3 gap-4'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='text-muted-foreground/70 text-[10px] font-medium tracking-wider uppercase'>
            {t('Billing type')}
          </span>
          <span
            className={cn(
              'inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
              billingActive
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {billingLabel}
          </span>
        </div>

        {isToken ? (
          <>
            <PriceCell
              label={t('Input')}
              price={priceForPreview(
                props.model,
                'input',
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                props.previewGroup,
                props.groupRatio
              )}
              unit={`/${tokenUnitLabel}`}
            />
            <PriceCell
              label={t('Output')}
              price={priceForPreview(
                props.model,
                'output',
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                props.previewGroup,
                props.groupRatio
              )}
              unit={`/${tokenUnitLabel}`}
            />
          </>
        ) : isPerSecond ? (
          <PriceCell
            className='col-span-2'
            label={t('Unit price')}
            price={priceForPreview(
              props.model,
              'input',
              tokenUnit,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.previewGroup,
              props.groupRatio
            )}
            unit={`/ ${t('second')}`}
          />
        ) : (
          <PriceCell
            className='col-span-2'
            label={t('Unit price')}
            price={fixedPriceForPreview(
              props.model,
              showRechargePrice,
              priceRate,
              usdExchangeRate,
              props.previewGroup,
              props.groupRatio
            )}
            unit={`/ ${t('request')}`}
          />
        )}
      </div>
    </button>
  )
})

function PriceCell(props: {
  label: string
  price: string
  unit: string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', props.className)}>
      <span className='text-muted-foreground/70 text-[10px] font-medium tracking-wider uppercase'>
        {props.label}
      </span>
      <div className='flex items-baseline gap-0.5'>
        <span className='text-foreground truncate font-mono text-[15px] font-bold tabular-nums'>
          {props.price}
        </span>
        <span className='text-muted-foreground/70 text-[10px] font-medium'>
          {props.unit}
        </span>
      </div>
    </div>
  )
}
