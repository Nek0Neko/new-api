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
import {
  EXCLUDED_GROUPS,
  PER_SECOND_TAG,
  QUOTA_TYPE_VALUES,
} from '../constants'
import type { BillingMode, PricingModel } from '../types'
import { parseTags } from './filters'

// ----------------------------------------------------------------------------
// Model Helper Utilities
// ----------------------------------------------------------------------------

/**
 * Get available groups for a model
 */
export function getAvailableGroups(
  model: PricingModel,
  usableGroup: Record<string, { desc: string; ratio: number }>
): string[] {
  const modelEnableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []

  return Object.keys(usableGroup)
    .filter((g) => !EXCLUDED_GROUPS.includes(g))
    .filter((g) => modelEnableGroups.includes(g))
}

/**
 * Replace model placeholder in endpoint path
 */
export function replaceModelInPath(path: string, modelName: string): string {
  return path.replace(/\{model\}/g, modelName)
}

/**
 * Check if model is token-based pricing
 */
export function isTokenBasedModel(model: PricingModel): boolean {
  return model.quota_type === QUOTA_TYPE_VALUES.TOKEN
}

/**
 * Resolve a model's display-level billing mode. Per-second models still carry
 * `quota_type = 0`; the `PER-SECOND` tag (case-insensitive) flags them so the
 * UI can render `/秒` instead of `/1M tokens`.
 */
export function getBillingMode(model: PricingModel): BillingMode {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) return 'request'
  const tags = parseTags(model.tags).map((t) => t.toUpperCase())
  if (tags.includes(PER_SECOND_TAG)) return 'per_second'
  return 'token'
}
