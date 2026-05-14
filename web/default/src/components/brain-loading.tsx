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
import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

const NODES: ReadonlyArray<readonly [number, number]> = [
  [38, 14], //  0 top-left
  [56, 8], //   1 top-mid
  [74, 16], //  2 top-right
  [86, 36], //  3 upper-right "ear"
  [20, 32], //  4 upper-left
  [52, 30], //  5 inner-upper
  [70, 38], //  6 inner-upper-right
  [12, 56], //  7 left-mid
  [36, 56], //  8 inner-mid-left
  [60, 56], //  9 inner-mid
  [86, 62], // 10 right-mid
  [50, 76], // 11 inner-lower
  [74, 78], // 12 inner-lower-right
  [26, 84], // 13 bottom-left
  [62, 94], // 14 bottom-mid
  [88, 96], // 15 bottom-right apex
]

const EDGES: ReadonlyArray<readonly [number, number]> = [
  // outer perimeter
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 10],
  [10, 15],
  [15, 14],
  [14, 13],
  [13, 7],
  [7, 4],
  [4, 0],
  // upper triangulation
  [0, 5],
  [1, 5],
  [2, 5],
  [2, 6],
  [3, 6],
  [4, 5],
  [5, 6],
  [6, 10],
  // middle triangulation
  [4, 8],
  [5, 8],
  [5, 9],
  [6, 9],
  [7, 8],
  [8, 9],
  [9, 10],
  // lower triangulation
  [8, 11],
  [8, 13],
  [9, 11],
  [9, 12],
  [10, 12],
  [11, 12],
  [11, 13],
  [11, 14],
  [12, 14],
  [12, 15],
  [13, 14],
]

// distinctive horizontal swoosh through the brain
const SWOOSH_PATH = 'M 6,60 Q 28,42 52,52 T 92,66'

interface BrainLogoProps extends SVGProps<SVGSVGElement> {
  animated?: boolean
}

export function BrainLogo({
  className,
  animated = false,
  ...props
}: BrainLogoProps) {
  return (
    <svg
      viewBox='0 0 100 105'
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      stroke='currentColor'
      className={cn(
        'size-24',
        animated && 'brain-logo--animated',
        className
      )}
      {...props}
    >
      <title>New API</title>

      {/* keyframes & per-element timing — scoped via parent class */}
      <style>{`
        .brain-logo--animated .brain-edge {
          stroke-dasharray: 0.35 0.65;
          animation: brain-edge-flow 2.4s linear infinite;
        }
        .brain-logo--animated .brain-swoosh {
          stroke-dasharray: 0.3 0.7;
          animation: brain-edge-flow 3s linear infinite;
        }
        .brain-logo--animated .brain-node {
          transform-box: fill-box;
          transform-origin: center;
          animation: brain-node-pulse 1.6s ease-in-out infinite;
        }
        @keyframes brain-edge-flow {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes brain-node-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.55; }
          50%      { transform: scale(1.6); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .brain-logo--animated .brain-edge,
          .brain-logo--animated .brain-swoosh,
          .brain-logo--animated .brain-node { animation: none; }
        }
      `}</style>

      {/* base edges — always visible so the silhouette reads even when paused */}
      <g
        strokeWidth='0.9'
        strokeLinecap='round'
        opacity={animated ? 0.28 : 1}
      >
        {EDGES.map(([from, to], i) => {
          const [x1, y1] = NODES[from]
          const [x2, y2] = NODES[to]
          return (
            <line
              key={`base-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })}
        <path d={SWOOSH_PATH} strokeWidth='1.4' />
      </g>

      {/* animated overlay edges (only render when animated, otherwise wasted DOM) */}
      {animated && (
        <g strokeWidth='1.1' strokeLinecap='round'>
          {EDGES.map(([from, to], i) => {
            const [x1, y1] = NODES[from]
            const [x2, y2] = NODES[to]
            return (
              <line
                key={`flow-${i}`}
                className='brain-edge'
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                pathLength='1'
                style={{ animationDelay: `${(i % 12) * -0.18}s` }}
              />
            )
          })}
          <path
            className='brain-swoosh'
            d={SWOOSH_PATH}
            strokeWidth='1.6'
            pathLength='1'
          />
        </g>
      )}

      {/* nodes */}
      <g fill='currentColor' stroke='none'>
        {NODES.map(([x, y], i) => (
          <circle
            key={`node-${i}`}
            className={animated ? 'brain-node' : undefined}
            cx={x}
            cy={y}
            r='2.6'
            style={
              animated
                ? { animationDelay: `${(i % NODES.length) * -0.1}s` }
                : undefined
            }
          />
        ))}
      </g>
    </svg>
  )
}

interface BrainLoadingProps {
  className?: string
  message?: string
  size?: number
}

export function BrainLoading({ className, message, size }: BrainLoadingProps) {
  return (
    <div
      className={cn(
        'flex min-h-[200px] flex-col items-center justify-center gap-4',
        className
      )}
    >
      <BrainLogo
        animated
        className='text-foreground'
        style={size ? { width: size, height: size } : undefined}
      />
      {message != null && (
        <p className='text-muted-foreground text-sm'>{message}</p>
      )}
    </div>
  )
}
