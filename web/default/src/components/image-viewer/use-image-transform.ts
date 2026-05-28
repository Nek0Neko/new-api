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
import { useCallback, useReducer } from 'react'

export interface ImageTransform {
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
  flipX: boolean
  flipY: boolean
}

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const IDENTITY: ImageTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

type Action =
  | { type: 'reset' }
  | { type: 'zoom'; factor: number; px: number; py: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'rotate'; delta: number }
  | { type: 'flipX' }
  | { type: 'flipY' }

function reducer(state: ImageTransform, action: Action): ImageTransform {
  switch (action.type) {
    case 'reset':
      return IDENTITY
    case 'zoom': {
      const next = clamp(state.scale * action.factor, MIN_SCALE, MAX_SCALE)
      if (next === state.scale) return state
      // Recenter when zoomed back to (or below) fit.
      if (next <= 1) return { ...state, scale: next, offsetX: 0, offsetY: 0 }
      // Cursor-anchored zoom: keep the point under (px, py) fixed.
      // px/py are measured from the stage center.
      const ratio = next / state.scale
      return {
        ...state,
        scale: next,
        offsetX: action.px - (action.px - state.offsetX) * ratio,
        offsetY: action.py - (action.py - state.offsetY) * ratio,
      }
    }
    case 'pan':
      return {
        ...state,
        offsetX: state.offsetX + action.dx,
        offsetY: state.offsetY + action.dy,
      }
    case 'rotate':
      return { ...state, rotation: state.rotation + action.delta }
    case 'flipX':
      return { ...state, flipX: !state.flipX }
    case 'flipY':
      return { ...state, flipY: !state.flipY }
    default:
      return state
  }
}

export function useImageTransform() {
  const [transform, dispatch] = useReducer(reducer, IDENTITY)

  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  const zoomAtPoint = useCallback(
    (factor: number, px: number, py: number) =>
      dispatch({ type: 'zoom', factor, px, py }),
    []
  )
  const zoomIn = useCallback(
    () => dispatch({ type: 'zoom', factor: 1.25, px: 0, py: 0 }),
    []
  )
  const zoomOut = useCallback(
    () => dispatch({ type: 'zoom', factor: 1 / 1.25, px: 0, py: 0 }),
    []
  )
  const panBy = useCallback(
    (dx: number, dy: number) => dispatch({ type: 'pan', dx, dy }),
    []
  )
  const rotateLeft = useCallback(
    () => dispatch({ type: 'rotate', delta: -90 }),
    []
  )
  const rotateRight = useCallback(
    () => dispatch({ type: 'rotate', delta: 90 }),
    []
  )
  const flipHorizontal = useCallback(() => dispatch({ type: 'flipX' }), [])
  const flipVertical = useCallback(() => dispatch({ type: 'flipY' }), [])

  return {
    transform,
    reset,
    zoomAtPoint,
    zoomIn,
    zoomOut,
    panBy,
    rotateLeft,
    rotateRight,
    flipHorizontal,
    flipVertical,
  }
}
