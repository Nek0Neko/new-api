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
 * Run `cb` after the browser has painted, so heavy synchronous work (e.g.
 * parsing a large localStorage payload) never blocks the initial render.
 * Returns a canceller to abort a still-pending callback (e.g. on unmount).
 *
 * A *macrotask* is required here — neither a microtask (`Promise.then`) nor a
 * bare `useEffect` body is enough:
 *   - microtasks flush before the browser paints;
 *   - React may flush passive effects synchronously *before* paint for
 *     click-initiated navigation.
 * Both would run the work before first paint and re-introduce the jank.
 *
 * Prefers `requestIdleCallback` (yields to the browser, with a timeout so the
 * data still loads promptly) and falls back to `setTimeout`.
 */
export function scheduleAfterPaint(cb: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(() => cb(), { timeout: 200 })
    return () => window.cancelIdleCallback?.(handle)
  }

  const id = window.setTimeout(cb, 0)
  return () => window.clearTimeout(id)
}
