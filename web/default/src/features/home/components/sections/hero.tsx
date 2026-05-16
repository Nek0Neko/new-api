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
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

/* ─────────────── Hero ambient asset ───────────────
 * Full-width widescreen background loop. Swap these
 * URLs for your own assets — the poster acts as both
 * initial frame and graceful fallback if the video
 * fails to load.
 * ─────────────────────────────────────────────── */
const VIDEO_SRC =
  'https://qcloudimg.tencent-cloud.cn/raw/9112131778c3f5a95b185ad6263f8214.mp4'
const VIDEO_POSTER =
  'https://qcloudimg.tencent-cloud.cn/raw/1a676e2589f19379f639c7fb7753e358.jpg'

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()

  const trustPoints = [
    t('OpenAI-compatible'),
    t('Open source'),
    t('40+ providers'),
  ]

  return (
    <section className='bg-background text-foreground border-border/60 relative isolate overflow-hidden border-b'>
      {/* Full-width ambient video — bottom of the stack */}
      <HeroAmbientVideo src={VIDEO_SRC} poster={VIDEO_POSTER} />

      {/* Tint + readability overlay, lives above the video, below content */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 z-1'
        style={{
          background:
            'linear-gradient(180deg, color-mix(in oklch, var(--background) 35%, transparent) 0%, color-mix(in oklch, var(--background) 55%, transparent) 50%, var(--background) 100%)',
        }}
      />

      {/* Subtle grid backdrop for texture, above tint */}
      <div
        aria-hidden
        className='home-grid-backdrop pointer-events-none absolute inset-0 z-1 opacity-40 mix-blend-overlay'
      />

      {/* Content */}
      <div className='relative z-10 mx-auto max-w-4xl px-6 pt-32 pb-28 md:pt-44 md:pb-36'>
        <div className='flex flex-col items-center text-center'>
          {/* Eyebrow announcement pill */}
          <div
            className='landing-animate-fade-up'
            style={{ animationDelay: '0ms' }}
          >
            <Link
              to='/pricing'
              className='bg-background/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-tight backdrop-blur transition-colors'
            >
              <span className='inline-flex items-center gap-1.5 rounded-full bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-violet-600 uppercase dark:text-violet-300'>
                {t('New')}
              </span>
              {t('Multi-model routing & live analytics')}
              <ChevronRight className='size-3 transition-transform group-hover:translate-x-0.5' />
            </Link>
          </div>

          {/* Headline */}
          <h1
            className='landing-animate-fade-up home-display home-display-xl text-foreground mt-8'
            style={{ animationDelay: '80ms' }}
          >
            <Trans
              i18nKey='The unified gateway for every AI model'
              components={{
                em: <span className='home-display-italic home-display-muted' />,
                br: <br />,
              }}
            />
            <span className='text-foreground/70'>.</span>
          </h1>

          {/* Subhead */}
          <p
            className='landing-animate-fade-up home-lead mx-auto mt-6 max-w-2xl'
            style={{ animationDelay: '160ms' }}
          >
            {t(
              'One BASE_URL for OpenAI, Anthropic, Google, and 40+ providers. Billing, quotas, and live analytics — built in, powered by {{systemName}}.',
              { systemName }
            )}
          </p>

          {/* CTA row */}
          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            {props.isAuthenticated ? (
              <Button
                size='lg'
                className='group h-10 rounded-lg px-5 text-sm font-medium'
                render={<Link to='/dashboard' />}
              >
                {t('Open dashboard')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            ) : (
              <>
                <Button
                  size='lg'
                  className='group h-10 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/sign-up' />}
                >
                  {t('Start for free')}
                  <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  size='lg'
                  variant='ghost'
                  className='text-muted-foreground hover:text-foreground hover:bg-muted/60 h-10 rounded-lg px-4 text-sm font-medium'
                  render={<Link to='/pricing' />}
                >
                  {t('View pricing')}
                  <ChevronRight className='ml-0.5 size-3.5' />
                </Button>
              </>
            )}
          </div>

          {/* Trust microline */}
          {!props.isAuthenticated && (
            <ul
              className='landing-animate-fade-up text-muted-foreground/85 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] font-medium tracking-tight opacity-0'
              style={{ animationDelay: '320ms' }}
              aria-label={t('Key benefits')}
            >
              {trustPoints.map((label) => (
                <li key={label} className='inline-flex items-center gap-1.5'>
                  <Check
                    className='size-3 text-emerald-600 dark:text-emerald-400'
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────── Full-width ambient video ─────────────────── */

interface HeroAmbientVideoProps {
  src: string
  poster: string
}

function HeroAmbientVideo(props: HeroAmbientVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (reduceMotion) {
      video.pause()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            /* autoplay blocked — poster still shows */
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.05 }
    )
    observer.observe(video)

    const onVisibilityChange = () => {
      if (document.hidden) video.pause()
      else video.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [reduceMotion])

  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0 z-0 overflow-hidden'
      style={{
        backgroundImage: `url(${props.poster})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <video
        ref={videoRef}
        className='size-full object-cover'
        muted
        loop
        playsInline
        autoPlay={!reduceMotion}
        preload='metadata'
        poster={props.poster}
        onError={(e) => {
          ;(e.currentTarget as HTMLVideoElement).style.display = 'none'
        }}
      >
        <source src={props.src} type='video/mp4' />
      </video>
    </div>
  )
}

/* ─────────────────── Reduced-motion subscription ─────────────────── */

function reduceMotionSubscribe(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function reduceMotionSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function reduceMotionServerSnapshot(): boolean {
  return false
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    reduceMotionSubscribe,
    reduceMotionSnapshot,
    reduceMotionServerSnapshot
  )
}
