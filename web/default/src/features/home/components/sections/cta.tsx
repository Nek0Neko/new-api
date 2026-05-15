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
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

interface SpecCell {
  value: string
  label: string
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  const specs: SpecCell[] = [
    { value: '3 min', label: t('Sign up') },
    { value: '40+', label: t('Providers') },
    { value: '1 key', label: t('All models') },
    { value: '$0', label: t('To start') },
  ]

  return (
    <section className='bg-background border-border/60 home-section-pad relative isolate z-10 border-t'>
      <div className='mx-auto max-w-6xl px-6'>
        <AnimateInView animation='fade-up'>
          <article
            className={cn(
              'relative isolate overflow-hidden rounded-3xl',
              // Light: layered white surface with soft outer shadow + crisp ring
              'bg-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.18)] ring-1 ring-zinc-200/80',
              // Dark: pure dark island
              'dark:bg-zinc-950 dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] dark:ring-zinc-800/80'
            )}
          >
            {/* Decorative emerald glow — top left */}
            <div
              aria-hidden
              className='pointer-events-none absolute -top-40 -left-32 size-112 rounded-full bg-emerald-500/15 blur-[120px] dark:bg-emerald-500/20'
            />
            {/* Decorative violet glow — bottom right */}
            <div
              aria-hidden
              className='pointer-events-none absolute -right-40 -bottom-40 size-112 rounded-full bg-violet-500/10 blur-[120px] dark:bg-violet-500/10'
            />
            {/* Dot grid texture — dark dots on light, light dots on dark */}
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply dark:opacity-[0.07] dark:mix-blend-screen'
              style={{
                backgroundImage:
                  'radial-gradient(circle, currentColor 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                color: 'rgb(24 24 27)',
              }}
            />
            {/* Subtle top highlight for layered surface feel */}
            <div
              aria-hidden
              className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-900/10 to-transparent dark:via-white/10'
            />

            <div className='relative px-7 py-14 sm:px-12 sm:py-20 lg:px-20 lg:py-24'>
              <div className='grid gap-y-14 lg:grid-cols-[1.4fr_1fr] lg:gap-x-16'>
                {/* ─── Left column: status · headline · lead · CTAs ─── */}
                <div className='flex flex-col'>
                  {/* Live status pill */}
                  <div className='inline-flex w-fit items-center gap-2.5 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70'>
                    <span className='relative flex size-1.5'>
                      <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 dark:bg-emerald-400' />
                      <span className='relative inline-flex size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400' />
                    </span>
                    <span className='text-[10.5px] font-semibold tracking-[0.18em] text-zinc-600 uppercase dark:text-zinc-400'>
                      {t('Cleared for launch')}
                    </span>
                  </div>

                  {/* Rhythmic 3-beat headline */}
                  <h2 className='mt-10 max-w-[18ch] text-[clamp(2.5rem,6.2vw,5rem)] leading-[0.96] font-semibold tracking-[-0.045em] text-zinc-900 dark:text-zinc-50'>
                    <Trans
                      i18nKey='One key. Every model. Ready in seconds.'
                      components={{
                        br: <br />,
                        em: (
                          <span className='font-normal text-zinc-400 italic dark:text-zinc-500' />
                        ),
                      }}
                    />
                  </h2>

                  {/* Subhead */}
                  <p className='mt-7 max-w-md text-[15px] leading-[1.65] text-zinc-600 dark:text-zinc-400'>
                    {t(
                      'Sign up, grab one API key, and call 40+ frontier models through a single OpenAI-compatible endpoint.'
                    )}
                  </p>

                  {/* CTA row */}
                  <div className='mt-9 flex flex-wrap items-center gap-3'>
                    <Button
                      size='lg'
                      className='group h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.55)] transition-all duration-200 hover:bg-emerald-500 hover:shadow-[0_14px_36px_-10px_rgba(16,185,129,0.7)] dark:bg-emerald-500 dark:text-zinc-950 dark:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)] dark:hover:bg-emerald-400 dark:hover:shadow-[0_14px_36px_-10px_rgba(16,185,129,0.75)]'
                      render={<Link to='/sign-up' />}
                    >
                      {t('Get started')}
                      <ArrowUpRight className='ml-1 size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5' />
                    </Button>
                    <Button
                      size='lg'
                      variant='ghost'
                      className='h-11 rounded-lg px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50'
                      render={<Link to='/pricing' />}
                    >
                      {t('View pricing')}
                      <ChevronRight className='ml-0.5 size-3.5' />
                    </Button>
                  </div>
                </div>

                {/* ─── Right column: pull-quote / promise card ─── */}
                <aside className='relative flex flex-col justify-between gap-10 lg:pl-8'>
                  <div className='lg:border-l lg:border-zinc-200/90 lg:pl-10 dark:lg:border-zinc-800/80'>
                    <span className='text-[10.5px] font-semibold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-400/90'>
                      {t('The promise')}
                    </span>
                    <blockquote className='mt-5 text-[18px] leading-[1.5] font-medium tracking-tight text-zinc-800 sm:text-[20px] dark:text-zinc-100'>
                      <span className='text-zinc-400 dark:text-zinc-500'>
                        “
                      </span>
                      {t(
                        'Skip the infrastructure. Ship AI features today on a managed gateway built for production traffic.'
                      )}
                      <span className='text-zinc-400 dark:text-zinc-500'>
                        ”
                      </span>
                    </blockquote>
                    <div className='mt-6 flex items-center gap-3'>
                      <span
                        aria-hidden
                        className='h-px w-8 bg-emerald-500/70 dark:bg-emerald-400/60'
                      />
                      <span className='text-[11px] font-medium tracking-[0.18em] text-zinc-500 uppercase'>
                        {t('What you ship today')}
                      </span>
                    </div>
                  </div>
                </aside>
              </div>

              {/* ─── Spec-sheet footer ─── */}
              <div className='mt-16 grid grid-cols-2 gap-y-8 border-t border-zinc-200/90 pt-10 sm:mt-20 md:grid-cols-4 md:gap-y-0 md:pt-12 dark:border-zinc-800/80'>
                {specs.map((s, i) => (
                  <SpecCellView key={s.label} cell={s} index={i} />
                ))}
              </div>
            </div>
          </article>
        </AnimateInView>
      </div>
    </section>
  )
}

function SpecCellView(props: { cell: SpecCell; index: number }) {
  const { cell, index } = props
  return (
    <div
      className={cn(
        'flex flex-col gap-2 px-2 md:px-7',
        index === 0 && 'md:pl-0',
        index === 3 && 'md:pr-0',
        index > 0 &&
          'md:border-l md:border-zinc-200/90 dark:md:border-zinc-800/80',
        // Mobile: hairline between columns within each row
        index === 1 && 'border-l border-zinc-200/90 dark:border-zinc-800/80',
        index === 3 && 'border-l border-zinc-200/90 dark:border-zinc-800/80'
      )}
    >
      <span className='font-mono text-[clamp(1.75rem,3vw,2.5rem)] leading-none font-semibold tracking-tight text-zinc-900 tabular-nums dark:text-zinc-50'>
        {cell.value}
      </span>
      <span className='text-[10.5px] font-medium tracking-[0.18em] text-zinc-500 uppercase'>
        {cell.label}
      </span>
    </div>
  )
}
