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
import type { AxiosRequestConfig } from 'axios'

/**
 * Build an axios config that carries a user's API key (Bearer) and disables
 * the global error toast — Playground tabs surface errors inline next to the
 * failed generation card.
 */
export function bearerConfig(apiKey: string): AxiosRequestConfig {
  return {
    headers: { Authorization: `Bearer ${apiKey}` },
    // axios config — these flags are read by interceptors in src/lib/api.ts
    skipErrorHandler: true,
    skipBusinessError: true,
    // GET requests should not deduplicate with each other if URLs collide
    // across users / tokens (defensive — generation endpoints are POST anyway).
    disableDuplicate: true,
  } as AxiosRequestConfig
}
