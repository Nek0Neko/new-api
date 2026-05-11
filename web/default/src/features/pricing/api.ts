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
import { api } from '@/lib/api'
import type { PricingData } from './types'

// ----------------------------------------------------------------------------
// Pricing APIs
// ----------------------------------------------------------------------------

// Get model pricing data
export async function getPricing(): Promise<PricingData> {
  // Local preview mode: serve the static fixture at
  // web/default/public/mock-pricing.json when localStorage.pricingMock === '1'.
  // Lets the page render against an external dataset
  // (e.g. https://llms.best/api/pricing) without a backend running.
  // Toggle in DevTools: `localStorage.setItem('pricingMock', '1')` and refresh.
  if (
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('pricingMock') === '1'
  ) {
    const res = await fetch('/mock-pricing.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`mock-pricing.json: HTTP ${res.status}`)
    return (await res.json()) as PricingData
  }
  const res = await api.get('/api/pricing')
  return res.data
}
