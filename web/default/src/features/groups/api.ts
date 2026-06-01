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
import type {
  RechargeGroup,
  ConsumptionGroup,
  RechargeGroupListData,
  ConsumptionGroupListData,
  GroupChannel,
  ApiResponse,
} from './types'

const enc = encodeURIComponent

export async function getRechargeGroups(): Promise<ApiResponse<RechargeGroupListData>> {
  return (await api.get('/api/recharge_group/manage')).data
}
export async function createRechargeGroup(p: Partial<RechargeGroup>): Promise<ApiResponse<RechargeGroup>> {
  return (await api.post('/api/recharge_group/manage', p)).data
}
export async function updateRechargeGroup(name: string, p: Partial<RechargeGroup>): Promise<ApiResponse<RechargeGroup>> {
  return (await api.put(`/api/recharge_group/manage/${enc(name)}`, p)).data
}
export async function deleteRechargeGroup(name: string): Promise<ApiResponse<{ name: string }>> {
  return (await api.delete(`/api/recharge_group/manage/${enc(name)}`)).data
}

export async function getConsumptionGroups(): Promise<ApiResponse<ConsumptionGroupListData>> {
  return (await api.get('/api/consumption_group/manage')).data
}
export async function createConsumptionGroup(p: Partial<ConsumptionGroup>): Promise<ApiResponse<ConsumptionGroup>> {
  return (await api.post('/api/consumption_group/manage', p)).data
}
export async function updateConsumptionGroup(name: string, p: Partial<ConsumptionGroup>): Promise<ApiResponse<ConsumptionGroup>> {
  return (await api.put(`/api/consumption_group/manage/${enc(name)}`, p)).data
}
export async function deleteConsumptionGroup(name: string): Promise<ApiResponse<{ name: string }>> {
  return (await api.delete(`/api/consumption_group/manage/${enc(name)}`)).data
}
export async function getConsumptionGroupChannels(name: string): Promise<ApiResponse<GroupChannel[]>> {
  return (await api.get(`/api/consumption_group/manage/${enc(name)}/channels`)).data
}
export async function mutateConsumptionGroupChannel(
  name: string,
  channelId: number,
  action: 'attach' | 'detach',
): Promise<ApiResponse<{ channel_id: number; group: string }>> {
  return (await api.post(`/api/consumption_group/manage/${enc(name)}/channels`, { channel_id: channelId, action })).data
}
