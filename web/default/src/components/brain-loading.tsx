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
import { useId, type SVGProps } from 'react'
import { cn } from '@/lib/utils'

const LOGO_PATH = `M 101.70 94.92
  L 85.03 104.55
  A 0.45 0.44 -45.2 0 0 85.03 105.32
  L 115.30 122.79
  A 1.33 1.29 -33.1 0 0 116.17 122.96
  Q 118.90 122.52 118.45 119.28
  Q 117.33 111.31 115.43 94.84
  A 1.73 1.72 10.2 0 0 114.50 93.51
  Q 112.61 92.55 112.28 91.47
  A 0.98 0.98 0.0 0 0 111.22 90.78
  Q 84.88 94.11 64.77 111.03
  Q 58.08 116.66 51.25 123.99
  C 49.45 125.93 46.81 125.65 44.36 124.44
  Q 40.49 122.53 36.86 120.89
  Q 34.48 119.82 33.91 117.86
  Q 27.99 97.76 26.60 92.66
  Q 25.99 90.43 27.36 88.61
  Q 38.64 73.62 50.61 59.04
  A 1.76 1.75 62.3 0 0 51.00 57.78
  C 50.95 57.20 50.66 56.30 50.84 55.63
  Q 52.13 50.94 56.87 51.67
  C 57.93 51.83 58.39 52.50 59.15 52.71
  A 1.69 1.66 42.2 0 0 60.19 52.67
  Q 71.51 48.60 88.53 42.81
  Q 89.19 42.58 90.49 40.93
  C 92.20 38.77 94.21 37.85 96.77 39.11
  C 98.57 39.99 99.01 42.71 101.20 43.55
  Q 116.14 49.33 128.30 54.08
  A 1.59 1.58 36.8 0 0 129.85 53.86
  C 131.32 52.73 133.38 52.58 135.08 53.55
  Q 138.30 55.39 137.36 59.51
  A 1.40 1.40 0.0 0 0 137.65 60.71
  L 153.34 79.68
  A 1.02 1.00 66.3 0 0 154.22 80.03
  Q 158.25 79.55 159.73 83.10
  C 160.75 85.53 158.69 89.49 155.76 89.18
  Q 155.12 89.11 154.77 89.23
  A 1.44 1.44 0.0 0 0 154.11 89.80
  L 143.92 107.08
  A 0.91 0.90 44.7 0 0 143.93 108.02
  C 146.36 111.96 142.43 115.98 138.42 114.96
  A 1.24 1.24 0.0 0 0 137.33 115.21
  L 125.89 124.67
  A 0.87 0.86 -20.3 0 0 125.58 125.33
  L 125.58 127.95
  A 1.88 1.80 -33.8 0 1 125.41 128.72
  C 123.61 132.63 118.95 132.95 116.08 130.12
  A 2.06 1.97 -79.0 0 1 115.59 129.36
  L 114.86 127.24
  A 1.14 1.13 5.3 0 0 114.35 126.63
  L 79.34 106.42
  A 1.44 1.44 0.0 0 1 79.27 103.97
  Q 88.84 97.72 101.61 94.70
  A 0.12 0.12 0.0 0 1 101.70 94.92
  Z
  M 91.21 46.97
  A 1.14 1.14 0.0 0 0 89.79 45.45
  L 61.38 55.36
  A 1.14 1.14 0.0 0 0 61.26 57.46
  L 78.76 65.93
  A 1.14 1.14 0.0 0 0 79.64 65.98
  L 83.24 64.73
  A 1.14 1.14 0.0 0 0 83.92 64.10
  L 91.21 46.97
  Z
  M 127.35 58.01
  A 0.49 0.49 0.0 0 0 127.42 57.08
  L 99.41 46.07
  A 1.37 1.36 38.4 0 0 98.15 46.21
  Q 96.42 47.36 95.00 47.62
  A 1.56 1.55 6.4 0 0 93.85 48.53
  Q 92.61 51.41 87.02 64.76
  Q 86.48 66.05 86.71 66.70
  A 1.59 1.58 -16.9 0 0 88.60 67.70
  Q 124.53 58.71 127.35 58.01
  Z
  M 60.96 60.22
  A 2.44 2.44 0.0 0 0 57.47 62.83
  L 61.38 84.58
  A 2.44 2.44 0.0 0 0 65.57 85.81
  L 78.13 72.32
  A 2.44 2.44 0.0 0 0 77.44 68.48
  L 60.96 60.22
  Z
  M 128.89 60.88
  A 0.33 0.33 0.0 0 0 128.51 60.42
  L 88.34 70.70
  A 0.33 0.33 0.0 0 0 88.26 71.31
  L 112.45 84.54
  A 0.33 0.33 0.0 0 0 112.69 84.57
  L 117.94 83.22
  A 0.33 0.33 0.0 0 0 118.16 83.04
  L 128.89 60.88
  Z
  M 56.81 89.60
  A 0.33 0.33 0.0 0 0 57.10 89.43
  L 58.70 86.66
  A 0.33 0.33 0.0 0 0 58.74 86.43
  L 53.97 60.89
  A 0.33 0.33 0.0 0 0 53.39 60.75
  L 31.47 89.07
  A 0.33 0.33 0.0 0 0 31.73 89.60
  L 56.81 89.60
  Z
  M 135.40 63.08
  A 1.01 1.01 0.0 0 0 134.50 62.72
  L 132.14 63.01
  A 1.01 1.01 0.0 0 0 131.36 63.57
  L 121.03 84.91
  A 1.01 1.01 0.0 0 0 122.06 86.35
  L 149.79 82.91
  A 1.01 1.01 0.0 0 0 150.45 81.26
  L 135.40 63.08
  Z
  M 110.94 87.04
  L 87.16 73.87
  A 1.88 1.83 -31.7 0 0 86.17 73.65
  C 85.14 73.76 84.01 74.68 82.74 74.34
  Q 82.00 74.13 81.36 74.15
  A 1.20 1.18 20.8 0 0 80.52 74.52
  L 67.26 88.41
  A 0.51 0.51 0.0 0 0 67.63 89.27
  Q 87.84 89.27 110.83 87.56
  A 0.28 0.28 0.0 0 0 110.94 87.04
  Z
  M 136.58 105.30
  A 1.15 1.15 0.0 0 0 137.51 105.61
  L 140.23 105.28
  A 1.15 1.15 0.0 0 0 141.09 104.71
  L 150.73 88.00
  A 1.15 1.15 0.0 0 0 149.60 86.29
  L 122.85 89.61
  A 1.15 1.15 0.0 0 0 122.19 91.58
  L 136.58 105.30
  Z
  M 64.13 95.08
  Q 63.76 95.24 63.30 95.38
  A 1.40 1.33 36.7 0 1 62.78 95.44
  L 60.57 95.29
  A 0.93 0.93 0.0 0 0 59.84 95.57
  L 42.24 113.16
  A 0.12 0.12 0.0 0 0 42.39 113.34
  Q 54.55 105.07 66.26 100.00
  Q 77.97 94.93 92.32 91.71
  A 0.12 0.12 0.0 0 0 92.29 91.48
  L 67.42 92.28
  A 0.93 0.93 0.0 0 0 66.72 92.63
  L 65.32 94.34
  A 1.40 1.33 -83.6 0 1 64.92 94.68
  Q 64.50 94.92 64.13 95.08
  Z
  M 57.04 93.21
  A 0.34 0.34 0.0 0 0 56.80 92.64
  L 30.87 92.64
  A 0.34 0.34 0.0 0 0 30.55 93.08
  L 36.63 113.86
  A 0.34 0.34 0.0 0 0 37.21 114.00
  L 57.04 93.21
  Z
  M 134.27 112.94
  A 0.68 0.68 0.0 0 0 134.52 112.42
  L 134.52 108.07
  A 0.68 0.68 0.0 0 0 134.31 107.58
  L 119.85 93.79
  A 0.68 0.68 0.0 0 0 118.71 94.36
  L 122.10 121.66
  A 0.68 0.68 0.0 0 0 123.21 122.10
  L 134.27 112.94
  Z`

// scatter points around the 180×180 logo. Each particle starts here,
// fades in, then converges toward the logo center (CX, CY) as the
// silhouette begins to draw itself.
const PARTICLES: ReadonlyArray<{ x: number; y: number; delay: number }> = [
  { x: 25, y: 35, delay: 0.0 },
  { x: 158, y: 18, delay: 0.05 },
  { x: 212, y: 78, delay: 0.1 },
  { x: 202, y: 158, delay: 0.15 },
  { x: 128, y: 212, delay: 0.2 },
  { x: 48, y: 208, delay: 0.25 },
  { x: 12, y: 132, delay: 0.3 },
  { x: 35, y: 92, delay: 0.35 },
]

const CX = 90
const CY = 90
const REVEAL_DURATION = '2.4s'
// soft blue-purple glow accent — minimal AI agent product feel
const GLOW_COLOR = '#9aa9ff'

interface BrainLogoProps extends SVGProps<SVGSVGElement> {
  animated?: boolean
}

export function BrainLogo({
  className,
  animated = false,
  ...props
}: BrainLogoProps) {
  const uid = useId().replace(/:/g, '')
  const haloId = `logo-halo-${uid}`
  const fillId = `logo-fill-${uid}`
  const sparkId = `logo-spark-${uid}`

  // each particle needs its own keyframes because the target translate
  // depends on its scatter coordinates — we generate them inline.
  const particleCss = PARTICLES.map((p, i) => {
    const dx = CX - p.x
    const dy = CY - p.y
    return `
      .logo-particle-${i} {
        animation: logo-particle-${i} ${REVEAL_DURATION} cubic-bezier(0.4, 0, 0.2, 1) infinite;
        animation-delay: ${p.delay}s;
      }
      @keyframes logo-particle-${i} {
        0%, 8%   { opacity: 0;   transform: translate(0, 0) scale(0.4); }
        20%      { opacity: 0.9; transform: translate(0, 0) scale(1); }
        40%      { opacity: 0.9; transform: translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.85); }
        55%      { opacity: 0;   transform: translate(${dx}px, ${dy}px) scale(0.2); }
        100%     { opacity: 0;   transform: translate(${dx}px, ${dy}px) scale(0.2); }
      }
    `
  }).join('\n')

  return (
    <svg
      viewBox='-40 -40 260 260'
      xmlns='http://www.w3.org/2000/svg'
      className={cn(
        'size-32 overflow-visible',
        animated && 'logo--animated',
        className
      )}
      {...props}
    >
      <title>kaopuer</title>

      <style>{`
        .logo--animated .logo-spark,
        .logo--animated .logo-halo,
        .logo--animated .logo-fill,
        .logo--animated .logo-stroke,
        .logo--animated .logo-scan,
        .logo--animated .logo-particle {
          transform-box: fill-box;
          transform-origin: center;
        }

        /* stage 1 — faint center spark emerges and expands outward */
        .logo--animated .logo-spark {
          animation: logo-spark ${REVEAL_DURATION} cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes logo-spark {
          0%   { opacity: 0;    transform: scale(0.1); }
          5%   { opacity: 0.35; transform: scale(0.4); }
          14%  { opacity: 0.9;  transform: scale(0.85); }
          26%  { opacity: 0.55; transform: scale(1.5); }
          42%  { opacity: 0;    transform: scale(2.4); }
          100% { opacity: 0;    transform: scale(2.4); }
        }

        /* stage 2 — scattered particles converge to center */
        ${particleCss}

        /* stage 3 — system scans the silhouette into existence */
        .logo--animated .logo-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: logo-stroke ${REVEAL_DURATION} cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes logo-stroke {
          0%, 22%   { stroke-dashoffset: 1; opacity: 0; }
          28%       { opacity: 0.9; }
          62%       { stroke-dashoffset: 0; opacity: 1; }
          78%       { opacity: 0.45; }
          90%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }

        /* stage 4 — fill materializes from blurry to crisp */
        .logo--animated .logo-fill {
          animation: logo-fill ${REVEAL_DURATION} cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes logo-fill {
          0%, 48%  { opacity: 0; transform: scale(0.92); filter: blur(5px); }
          62%      { opacity: 0.45; transform: scale(0.98); filter: blur(2px); }
          74%      { opacity: 1; transform: scale(1); filter: blur(0); }
          93%      { opacity: 1; transform: scale(1); filter: blur(0); }
          100%     { opacity: 0; transform: scale(0.96); filter: blur(2px); }
        }

        /* stage 5 — outer scan ring sweeps once around */
        .logo--animated .logo-scan {
          stroke-dasharray: 70 270;
          animation: logo-scan ${REVEAL_DURATION} cubic-bezier(0.45, 0, 0.2, 1) infinite;
        }
        @keyframes logo-scan {
          0%, 26% { opacity: 0;   transform: rotate(-20deg); }
          36%     { opacity: 0.75; }
          75%     { opacity: 0.75; transform: rotate(330deg); }
          90%     { opacity: 0;   transform: rotate(360deg); }
          100%    { opacity: 0;   transform: rotate(360deg); }
        }

        /* stage 6 — soft halo glow pulses at the moment of completion */
        .logo--animated .logo-halo {
          animation: logo-halo ${REVEAL_DURATION} cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes logo-halo {
          0%, 58% { opacity: 0;   transform: scale(0.5); }
          76%     { opacity: 0.8; transform: scale(1); }
          92%     { opacity: 0.35; transform: scale(1.18); }
          100%    { opacity: 0;   transform: scale(1.3); }
        }

        @media (prefers-reduced-motion: reduce) {
          .logo--animated .logo-spark,
          .logo--animated .logo-halo,
          .logo--animated .logo-stroke,
          .logo--animated .logo-scan,
          .logo--animated .logo-particle { animation: none; opacity: 0; }
          .logo--animated .logo-fill {
            animation: none;
            opacity: 1;
            transform: none;
            filter: none;
          }
        }
      `}</style>

      <defs>
        <radialGradient id={haloId} cx='0.5' cy='0.5' r='0.5'>
          <stop offset='0' stopColor={GLOW_COLOR} stopOpacity='0.55' />
          <stop offset='0.45' stopColor={GLOW_COLOR} stopOpacity='0.18' />
          <stop offset='1' stopColor={GLOW_COLOR} stopOpacity='0' />
        </radialGradient>
        <radialGradient id={sparkId} cx='0.5' cy='0.5' r='0.5'>
          <stop offset='0' stopColor='currentColor' stopOpacity='1' />
          <stop offset='0.4' stopColor={GLOW_COLOR} stopOpacity='0.7' />
          <stop offset='1' stopColor={GLOW_COLOR} stopOpacity='0' />
        </radialGradient>
        <radialGradient id={fillId} cx='0.5' cy='0.45' r='0.7'>
          <stop offset='0' stopColor='currentColor' stopOpacity='1' />
          <stop offset='1' stopColor='currentColor' stopOpacity='0.94' />
        </radialGradient>
      </defs>

      {/* static logo when not animated — just the clean silhouette */}
      {!animated && (
        <path d={LOGO_PATH} fill='currentColor' fillRule='evenodd' />
      )}

      {animated && (
        <>
          {/* halo glow behind everything */}
          <circle
            className='logo-halo'
            cx={CX}
            cy={CY}
            r='100'
            fill={`url(#${haloId})`}
          />

          {/* outer scanning ring — one clean rotation */}
          <circle
            className='logo-scan'
            cx={CX}
            cy={CY}
            r='106'
            fill='none'
            stroke='currentColor'
            strokeWidth='1.1'
            strokeLinecap='round'
            pathLength='340'
          />
          {/* second ring with soft accent color, slightly offset for depth */}
          <circle
            className='logo-scan'
            cx={CX}
            cy={CY}
            r='106'
            fill='none'
            stroke={GLOW_COLOR}
            strokeWidth='2.2'
            strokeLinecap='round'
            pathLength='340'
            style={{ filter: 'blur(2px)', opacity: 0.5 }}
          />

          {/* center spark — initial faint light point */}
          <circle
            className='logo-spark'
            cx={CX}
            cy={CY}
            r='18'
            fill={`url(#${sparkId})`}
          />

          {/* converging particles */}
          {PARTICLES.map((p, i) => (
            <circle
              key={i}
              className={`logo-particle logo-particle-${i}`}
              cx={p.x}
              cy={p.y}
              r='1.6'
              fill='currentColor'
            />
          ))}

          {/* logo stroke outline — drawn first like a system scan */}
          <path
            className='logo-stroke'
            d={LOGO_PATH}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.2'
            strokeLinecap='round'
            strokeLinejoin='round'
            pathLength='1'
          />

          {/* logo fill — final crisp reveal */}
          <path
            className='logo-fill'
            d={LOGO_PATH}
            fill={`url(#${fillId})`}
            fillRule='evenodd'
          />
        </>
      )}
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
        'flex min-h-50 flex-col items-center justify-center gap-4',
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
