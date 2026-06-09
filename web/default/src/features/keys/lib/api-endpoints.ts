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
export type ApiEndpoint = {
  label: string
  url: string
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * Build the ordered endpoint list shown to the user.
 * The main site URL is always the first entry; admin-configured lines follow.
 * Each line is "label|url" or just "url". Blank / non-http(s) / duplicate
 * (equal to main) lines are skipped.
 */
export function parseApiEndpoints(
  raw: string | undefined | null,
  mainUrl: string,
  mainLabel: string
): ApiEndpoint[] {
  const main = normalizeUrl(mainUrl)
  const result: ApiEndpoint[] = [{ label: mainLabel, url: main }]
  const seen = new Set<string>([main])

  for (const line of (raw ?? '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const sep = trimmed.indexOf('|')
    let label: string
    let url: string
    if (sep === -1) {
      url = normalizeUrl(trimmed)
      label = url
    } else {
      label = trimmed.slice(0, sep).trim()
      url = normalizeUrl(trimmed.slice(sep + 1))
      if (!label) label = url
    }
    if (!isHttpUrl(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    result.push({ label, url })
  }

  return result
}

/**
 * Pick the effective selected url: the stored url if it is still in the list,
 * otherwise the main (first) endpoint.
 */
export function resolveSelectedUrl(
  endpoints: ApiEndpoint[],
  storedUrl: string | null
): string {
  const fallback = endpoints[0]?.url ?? ''
  if (!storedUrl) return fallback
  return endpoints.some((e) => e.url === storedUrl) ? storedUrl : fallback
}
