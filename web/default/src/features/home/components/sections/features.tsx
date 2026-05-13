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
import { Check, Activity, Shield, Code2, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  return (
    <section className='bg-background relative z-10 overflow-hidden border-b'>
      {/* Section heading */}
      <div className='mx-auto max-w-6xl px-6 pt-28 pb-16 md:pt-36'>
        <AnimateInView className='max-w-2xl'>
          <p className='mb-4 text-[11px] font-medium tracking-[0.18em] text-violet-600 uppercase dark:text-violet-300'>
            {t('Platform')}
          </p>
          <h2 className='text-foreground text-[clamp(1.875rem,3.8vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em]'>
            {t('A complete control plane for')}
            <br />
            <span className='text-muted-foreground'>
              {t('every model your team ships against.')}
            </span>
          </h2>
        </AnimateInView>
      </div>

      {/* Story block 1 — Unified API */}
      <StoryBlock
        eyebrow={t('Unified API')}
        title={t('One BASE_URL. Every provider.')}
        body={t(
          'Drop the gateway in front of your existing SDKs. Keep using OpenAI client libraries — we adapt requests to Anthropic, Google, Bedrock, Mistral, DeepSeek and 40+ others.'
        )}
        icon={<Code2 className='size-4' />}
        bullets={[
          t('OpenAI, Anthropic, Gemini compatible routes'),
          t('Streaming, tools, vision and embeddings'),
          t('Per-channel model overrides and rewrites'),
        ]}
        mock={<UnifiedApiMock />}
      />

      {/* Story block 2 — Observability */}
      <StoryBlock
        reverse
        eyebrow={t('Observability')}
        title={t('See every request, every cost.')}
        body={t(
          'Live request logs, latency distributions, token spend and per-team consumption — no extra SDK, no third-party telemetry.'
        )}
        icon={<Activity className='size-4' />}
        bullets={[
          t('p50 / p99 latency by upstream'),
          t('Token + cost breakdown per key'),
          t('Webhook + audit log export'),
        ]}
        mock={<ObservabilityMock />}
      />

      {/* Story block 3 — Controls */}
      <StoryBlock
        eyebrow={t('Controls')}
        title={t('Enterprise-grade access controls.')}
        body={t(
          'Multi-tenant teams, scoped API keys, model allow-lists and IP rules. Built for self-hosted deployments where compliance is non-negotiable.'
        )}
        icon={<Shield className='size-4' />}
        bullets={[
          t('Role-based access with custom scopes'),
          t('Key rotation and revocation'),
          t('SQLite, MySQL, PostgreSQL supported'),
        ]}
        mock={<ControlsMock />}
      />

      {/* Spacer */}
      <div className='h-24 md:h-32' />
    </section>
  )
}

interface StoryBlockProps {
  eyebrow: string
  title: string
  body: string
  icon: React.ReactNode
  bullets: string[]
  mock: React.ReactNode
  reverse?: boolean
}

function StoryBlock(props: StoryBlockProps) {
  return (
    <div className='border-border/60 border-t'>
      <div className='mx-auto max-w-6xl px-6 py-20 md:py-28'>
        <AnimateInView
          animation='fade-up'
          className={`grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16 ${
            props.reverse ? 'lg:[&>*:first-child]:order-2' : ''
          }`}
        >
          <div className='max-w-lg'>
            <div className='mb-5 inline-flex items-center gap-2 rounded-full border bg-violet-500/8 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-violet-700 uppercase dark:text-violet-300'>
              <span className='flex size-3.5 items-center justify-center rounded-sm bg-violet-500/15 text-violet-600 dark:text-violet-300'>
                {props.icon}
              </span>
              {props.eyebrow}
            </div>
            <h3 className='text-foreground text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.1] font-semibold tracking-[-0.025em]'>
              {props.title}
            </h3>
            <p className='text-muted-foreground mt-5 text-[15px] leading-relaxed'>
              {props.body}
            </p>
            <ul className='mt-7 space-y-2.5'>
              {props.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className='text-foreground/80 flex items-start gap-2.5 text-sm'
                >
                  <span className='mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'>
                    <Check className='size-2.5' strokeWidth={3} />
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
            <a
              href='#'
              className='text-foreground mt-8 inline-flex items-center gap-1 text-sm font-medium tracking-tight transition-colors hover:text-violet-600 dark:hover:text-violet-300'
            >
              Learn more
              <ArrowRight className='size-3.5' />
            </a>
          </div>
          <div className='relative'>{props.mock}</div>
        </AnimateInView>
      </div>
    </div>
  )
}

/* ─── Mock visuals ─── */

function UnifiedApiMock() {
  return (
    <div className='bg-card border-border relative overflow-hidden rounded-xl border shadow-lg'>
      <div className='border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5'>
        {['openai', 'anthropic', 'google'].map((p, i) => (
          <span
            key={p}
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
              i === 0
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground/60'
            }`}
          >
            {p}
          </span>
        ))}
        <span className='text-muted-foreground/50 ml-auto font-mono text-[10px] tracking-wider uppercase'>
          gateway.ts
        </span>
      </div>
      <pre className='text-foreground/80 px-5 py-5 font-mono text-[12px] leading-relaxed'>
        <span className='text-muted-foreground/60'>
          {'// One client, every model'}
          {'\n'}
        </span>
        <span className='text-violet-600 dark:text-violet-300'>const</span>
        {' client = '}
        <span className='text-emerald-600 dark:text-emerald-400'>new</span>{' '}
        <span className='text-sky-600 dark:text-sky-400'>OpenAI</span>
        {'({'}
        {'\n  '}
        baseURL:{' '}
        <span className='text-amber-700 dark:text-amber-300'>
          "https://your-gateway/v1"
        </span>
        {',\n  '}
        apiKey:{' '}
        <span className='text-amber-700 dark:text-amber-300'>"sk-••••"</span>
        {',\n})'}
        {'\n\n'}
        <span className='text-muted-foreground/60'>
          {'// Switch model — no code change'}
          {'\n'}
        </span>
        <span className='text-violet-600 dark:text-violet-300'>await</span>
        {' client.chat.completions.create({\n  '}
        model:{' '}
        <span className='text-amber-700 dark:text-amber-300'>
          "claude-sonnet-4.6"
        </span>
        ,{'\n  '}
        messages: [<span className='text-muted-foreground/60'>...</span>]
        {'\n})'}
      </pre>
    </div>
  )
}

function ObservabilityMock() {
  const bars = [38, 52, 41, 67, 58, 72, 81, 64, 75, 88, 70, 92, 84]
  return (
    <div className='bg-card border-border relative overflow-hidden rounded-xl border shadow-lg'>
      <div className='border-border flex items-center justify-between border-b px-5 py-3'>
        <div className='flex items-center gap-2'>
          <Activity className='size-3.5 text-violet-600 dark:text-violet-300' />
          <span className='text-foreground text-sm font-medium tracking-tight'>
            Request volume
          </span>
        </div>
        <div className='text-muted-foreground/70 flex items-center gap-2 font-mono text-[10px] tabular-nums'>
          <span className='size-1 rounded-full bg-violet-500' /> 24h
        </div>
      </div>
      <div className='px-5 py-6'>
        <div className='flex items-baseline gap-2'>
          <span className='text-foreground text-3xl font-semibold tracking-tight tabular-nums'>
            10,284
          </span>
          <span className='inline-flex items-center rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400'>
            +12.4%
          </span>
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          Requests routed across all providers
        </p>

        {/* Sparkline */}
        <div className='mt-6 flex h-24 items-end gap-1.5'>
          {bars.map((h, i) => (
            <div
              key={i}
              className='flex-1 rounded-sm bg-gradient-to-t from-violet-500/30 to-violet-500/80'
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        <div className='border-border/60 mt-6 grid grid-cols-3 gap-4 border-t pt-5 font-mono text-[11px] tabular-nums'>
          <Metric label='p50' value='89 ms' />
          <Metric label='p99' value='412 ms' />
          <Metric label='cost' value='$12.40' tone='good' />
        </div>
      </div>
    </div>
  )
}

function Metric(props: { label: string; value: string; tone?: 'good' }) {
  return (
    <div>
      <p className='text-muted-foreground/60 text-[10px] tracking-wider uppercase'>
        {props.label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${
          props.tone === 'good'
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-foreground'
        }`}
      >
        {props.value}
      </p>
    </div>
  )
}

function ControlsMock() {
  const roles = [
    { name: 'Production', perm: 'Full access', count: 4, tone: 'emerald' },
    { name: 'Staging', perm: 'Read + write', count: 2, tone: 'sky' },
    { name: 'Read-only', perm: 'Read only', count: 8, tone: 'violet' },
    { name: 'Disabled', perm: 'Revoked', count: 1, tone: 'muted' },
  ]
  return (
    <div className='bg-card border-border relative overflow-hidden rounded-xl border shadow-lg'>
      <div className='border-border flex items-center justify-between border-b px-5 py-3'>
        <div className='flex items-center gap-2'>
          <Shield className='size-3.5 text-violet-600 dark:text-violet-300' />
          <span className='text-foreground text-sm font-medium tracking-tight'>
            Access policies
          </span>
        </div>
        <span className='text-muted-foreground/60 font-mono text-[10px] tracking-wider uppercase'>
          15 keys
        </span>
      </div>
      <div className='divide-border/60 divide-y'>
        {roles.map((r) => (
          <div
            key={r.name}
            className='hover:bg-muted/30 flex items-center justify-between px-5 py-3.5 transition-colors'
          >
            <div className='flex items-center gap-3'>
              <span
                className={`flex size-7 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${roleClass(
                  r.tone
                )}`}
              >
                {r.name[0]}
              </span>
              <div>
                <p className='text-foreground text-sm font-medium tracking-tight'>
                  {r.name}
                </p>
                <p className='text-muted-foreground text-xs'>{r.perm}</p>
              </div>
            </div>
            <span className='text-muted-foreground/70 font-mono text-xs tabular-nums'>
              {r.count} {r.count === 1 ? 'key' : 'keys'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function roleClass(tone: string): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
    case 'sky':
      return 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
    case 'violet':
      return 'bg-violet-500/12 text-violet-700 dark:text-violet-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
