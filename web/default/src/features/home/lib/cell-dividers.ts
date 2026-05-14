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

/**
 * Compute Tailwind divider classes for a grid cell across multiple breakpoints.
 *
 * Renders a single hairline between adjacent cells regardless of how the grid
 * wraps. At each breakpoint we add `border-l` for cells past column 0 and
 * `border-t` for cells past row 0, then explicitly clear `border-t` at larger
 * breakpoints where the cell collapses back into the first row.
 *
 * @example
 *   // 5 items, sm: 2 cols, lg: 5 cols
 *   getCellDividers(2, { base: 1, sm: 2, lg: 5 })
 *   // → 'sm:border-t sm:border-border/60 lg:border-t-0 lg:border-l lg:border-border/60'
 */
export interface CellDividersConfig {
  /** Column count at base breakpoint (mobile). Defaults to 1. */
  base?: number
  /** Column count at sm (>= 640px). */
  sm?: number
  /** Column count at md (>= 768px). */
  md?: number
  /** Column count at lg (>= 1024px). */
  lg?: number
}

type Breakpoint = 'base' | 'sm' | 'md' | 'lg'

const BREAKPOINT_PREFIX: Record<Breakpoint, string> = {
  base: '',
  sm: 'sm:',
  md: 'md:',
  lg: 'lg:',
}

const ORDER: Breakpoint[] = ['base', 'sm', 'md', 'lg']

const BORDER_TOKEN = 'border-border/60'

function classesAt(bp: Breakpoint, cols: number, index: number): string[] {
  const prefix = BREAKPOINT_PREFIX[bp]
  const col = index % cols
  const row = Math.floor(index / cols)
  const out: string[] = []
  if (col > 0) {
    out.push(`${prefix}border-l`, `${prefix}${BORDER_TOKEN}`)
  }
  if (row > 0) {
    out.push(`${prefix}border-t`, `${prefix}${BORDER_TOKEN}`)
  }
  return out
}

function clearAt(bp: Breakpoint): string[] {
  const prefix = BREAKPOINT_PREFIX[bp]
  return [`${prefix}border-l-0`, `${prefix}border-t-0`]
}

/**
 * Generate divider class string for a single cell. Pass the cell's index plus
 * the column count at each defined breakpoint.
 */
export function getCellDividers(
  index: number,
  config: CellDividersConfig
): string {
  const resolved: Partial<Record<Breakpoint, number>> = {
    base: config.base ?? 1,
    sm: config.sm,
    md: config.md,
    lg: config.lg,
  }

  const defined = ORDER.filter(
    (bp) => typeof resolved[bp] === 'number'
  ) as Breakpoint[]

  const classes = new Set<string>()

  defined.forEach((bp, i) => {
    const cols = resolved[bp]!
    // Clear what the previous (smaller) breakpoint set, so its `border-t`
    // (etc.) doesn't leak into this breakpoint's wider layout.
    if (i > 0) {
      clearAt(bp).forEach((c) => classes.add(c))
    }
    classesAt(bp, cols, index).forEach((c) => classes.add(c))
  })

  return Array.from(classes).join(' ')
}
