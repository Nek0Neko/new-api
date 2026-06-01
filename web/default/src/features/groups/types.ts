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
export type RechargeGroup = {
  id: number
  name: string
  description: string
  topup_ratio: number
  auto_upgrade: boolean
  upgrade_threshold: number
  admin_only: boolean
  created_time: number
  updated_time: number
}

export type ConsumptionGroup = {
  id: number
  name: string
  description: string
  consumption_ratio: number
  visibility: 'public' | 'private'
  admin_only: boolean
  in_auto_rotation: boolean
  auto_order: number
  created_time: number
  updated_time: number
}

export type ConsumptionGroupItem = ConsumptionGroup & { channel_count: number }

export type RechargeGroupListData = { groups: RechargeGroup[] }

export type ConsumptionGroupListData = {
  groups: ConsumptionGroupItem[]
  default_channel_group: string
  new_user_default_group: string
  default_use_auto_group: boolean
}

export type GroupChannel = {
  id: number
  name: string
  status: number
  group: string
  type: number
  has_override?: boolean
}

export type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}
