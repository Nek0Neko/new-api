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
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

interface RoutingRow {
  method: 'POST' | 'GET'
  path: string
  provider: string
  latency: string
  status: '200' | '429' | '500'
  tone: 'emerald' | 'sky' | 'violet' | 'amber' | 'pink'
}

const ROUTING_LOG: RoutingRow[] = [
  {
    method: 'POST',
    path: '/v1/chat/completions',
    provider: 'GPT-5',
    latency: '127 ms',
    status: '200',
    tone: 'emerald',
  },
  {
    method: 'POST',
    path: '/v1/messages',
    provider: 'Claude Sonnet 4.6',
    latency: '91 ms',
    status: '200',
    tone: 'amber',
  },
  {
    method: 'POST',
    path: '/v1beta/models:generateContent',
    provider: 'Gemini 2.5 Pro',
    latency: '76 ms',
    status: '200',
    tone: 'violet',
  },
  {
    method: 'POST',
    path: '/v1/embeddings',
    provider: 'text-embedding-3',
    latency: '42 ms',
    status: '200',
    tone: 'sky',
  },
  {
    method: 'POST',
    path: '/v1/chat/completions',
    provider: 'DeepSeek-V3',
    latency: '188 ms',
    status: '200',
    tone: 'pink',
  },
]

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='bg-background text-foreground relative isolate overflow-hidden border-b'>
      <div className='relative z-10 mx-auto max-w-6xl px-6 pt-28 pb-20 md:pt-36 md:pb-28'>
        {/* Eyebrow */}
        <div
          className='landing-animate-fade-up flex justify-center'
          style={{ animationDelay: '0ms' }}
        >
          <Link
            to='/pricing'
            className='bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-tight transition-colors'
          >
            <span className='inline-flex items-center gap-1.5 rounded-full bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold text-violet-600 uppercase dark:text-violet-300'>
              {t('New')}
            </span>
            {t('Multi-model routing & live analytics')}
            <ChevronRight className='size-3 transition-transform group-hover:translate-x-0.5' />
          </Link>
        </div>

        {/* Headline */}
        <h1
          className='landing-animate-fade-up text-foreground mt-7 text-center text-[clamp(2.5rem,6vw,4.5rem)] leading-[1] font-semibold tracking-[-0.04em] [text-wrap:balance]'
          style={{ animationDelay: '80ms' }}
        >
          {t('The unified gateway for')}
          <br />
          <span className='from-foreground via-foreground/85 to-foreground/45 bg-gradient-to-b bg-clip-text text-transparent'>
            {t('every AI model')}
          </span>
        </h1>

        {/* Subhead */}
        <p
          className='landing-animate-fade-up text-muted-foreground mx-auto mt-6 max-w-xl text-center text-[15px] leading-relaxed [text-wrap:balance] md:text-base'
          style={{ animationDelay: '160ms' }}
        >
          {systemName}{' '}
          {t(
            'gives self-hosted teams one BASE_URL for OpenAI, Anthropic, Google, and 40+ providers — with billing, quotas, and observability built in.'
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
                {t('Talk to us')}
                <ChevronRight className='ml-0.5 size-3.5' />
              </Button>
            </>
          )}
        </div>

        {/* Console preview */}
        <div
          className='landing-animate-fade-up mt-16 opacity-0'
          style={{ animationDelay: '320ms' }}
        >
          <RoutingConsole />
        </div>
      </div>
    </section>
  )
}

function RoutingConsole() {
  const { t } = useTranslation()
  return (
    <div className='relative mx-auto max-w-5xl'>
      {/* Subtle gradient frame */}
      <div
        aria-hidden
        className='absolute -inset-px rounded-2xl opacity-60 dark:opacity-40'
        style={{
          background:
            'linear-gradient(180deg, oklch(0.65 0.20 290 / 25%) 0%, transparent 30%)',
        }}
      />

      <div className='bg-card border-border relative overflow-hidden rounded-2xl border shadow-xl'>
        {/* Top bar */}
        <div className='border-border bg-muted/30 flex items-center justify-between border-b px-5 py-3'>
          <div className='flex items-center gap-2.5'>
            <span className='relative flex size-2'>
              <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/75' />
              <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
            </span>
            <span className='text-foreground font-mono text-[11px] tracking-tight'>
              {t('Routing console')}
            </span>
            <span className='text-muted-foreground/60 font-mono text-[11px]'>
              · production
            </span>
          </div>
          <div className='text-muted-foreground hidden items-center gap-3 font-mono text-[11px] tabular-nums sm:flex'>
            <span>
              <span className='text-foreground'>142</span> req/m
            </span>
            <span className='bg-border size-1 rounded-full' />
            <span>
              <span className='text-foreground'>0.02</span>% errors
            </span>
            <span className='bg-border size-1 rounded-full' />
            <span className='text-foreground'>{t('healthy')}</span>
          </div>
        </div>

        {/* Column headers */}
        <div className='border-border/60 text-muted-foreground/60 grid grid-cols-[60px_1fr_120px_60px_56px] gap-3 border-b px-5 py-2 font-mono text-[10px] tracking-wider uppercase sm:grid-cols-[60px_1.2fr_160px_80px_60px]'>
          <span>{t('Method')}</span>
          <span>{t('Path')}</span>
          <span>{t('Routed to')}</span>
          <span className='text-right'>{t('Latency')}</span>
          <span className='text-right'>{t('Status')}</span>
        </div>

        {/* Rows */}
        <div className='divide-border/50 divide-y font-mono text-xs'>
          {ROUTING_LOG.map((row, i) => (
            <RoutingLogRow key={i} row={row} index={i} />
          ))}
        </div>

        {/* Footer */}
        <div className='border-border bg-muted/30 flex items-center justify-between gap-4 border-t px-5 py-3'>
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] tabular-nums'>
            <span>
              <span className='text-foreground font-medium'>89 ms</span> avg
            </span>
            <span>
              <span className='text-foreground font-medium'>412 ms</span> p99
            </span>
            <span>
              <span className='text-foreground font-medium'>10.2K</span>{' '}
              {t('today')}
            </span>
          </div>
          <span className='text-muted-foreground/60 hidden font-mono text-[11px] tracking-wide sm:inline'>
            {t('auto-routed by load balancer')}
          </span>
        </div>
      </div>

      {/* Floating provider chip */}
      <div className='absolute -top-3 right-4 hidden md:block'>
        <div className='bg-card border-border flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm'>
          <span className='relative flex size-1.5'>
            <span className='absolute inline-flex size-full animate-ping rounded-full bg-violet-400/75' />
            <span className='relative inline-flex size-1.5 rounded-full bg-violet-500' />
          </span>
          <span className='font-mono text-[10px] tracking-wider uppercase'>
            live
          </span>
        </div>
      </div>
    </div>
  )
}

const TONE_DOT: Record<RoutingRow['tone'], string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  pink: 'bg-pink-500',
}

function RoutingLogRow(props: { row: RoutingRow; index: number }) {
  const { row, index } = props
  return (
    <div
      className='hover:bg-muted/40 grid grid-cols-[60px_1fr_120px_60px_56px] items-center gap-3 px-5 py-2.5 transition-colors sm:grid-cols-[60px_1.2fr_160px_80px_60px]'
      style={{
        animation: `landing-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) ${
          0.05 + index * 0.06
        }s both`,
      }}
    >
      <span className='text-[10px] font-semibold tracking-wider text-violet-600 dark:text-violet-300'>
        {row.method}
      </span>
      <span className='text-foreground/85 truncate'>{row.path}</span>
      <span className='text-muted-foreground flex items-center gap-1.5 truncate'>
        <span className={`size-1.5 rounded-full ${TONE_DOT[row.tone]}`} />
        <span className='truncate'>{row.provider}</span>
      </span>
      <span className='text-muted-foreground text-right tabular-nums'>
        {row.latency}
      </span>
      <span className='text-right'>
        <span className='inline-flex items-center rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-300'>
          {row.status}
        </span>
      </span>
    </div>
  )
}
