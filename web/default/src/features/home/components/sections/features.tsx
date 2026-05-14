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
import {
  TerminalSquare,
  Cpu,
  GitBranch,
  Zap,
  DollarSign,
  ShieldCheck,
  Bot,
  Cherry,
  Ghost,
  Boxes,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { getCellDividers } from '@/features/home/lib/cell-dividers'

interface FeaturesProps {
  className?: string
}

interface Integration {
  name: string
  desc: string
  icon: React.ReactNode
}

interface CoreFeature {
  title: string
  desc: string
  icon: React.ReactNode
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const integrations: Integration[] = [
    {
      name: 'Cursor',
      desc: t('AI code editor. Swap the Base URL in Settings → Models.'),
      icon: <Boxes className='size-4' />,
    },
    {
      name: 'Claude Code',
      desc: t(
        "Anthropic's official CLI. Set ANTHROPIC_BASE_URL and you're in."
      ),
      icon: <Cpu className='size-4' />,
    },
    {
      name: 'OpenClaw',
      desc: t(
        'Open-source personal AI assistant that runs locally, takes orders over WhatsApp or Telegram, and accepts any custom endpoint.'
      ),
      icon: <Ghost className='size-4' />,
    },
    {
      name: 'Cherry Studio',
      desc: t(
        'Cross-platform AI client. Point it at any OpenAI-compatible endpoint.'
      ),
      icon: <Cherry className='size-4' />,
    },
    {
      name: 'LobeHub',
      desc: t(
        'Open-source AI assistant. Bring your own providers, plug in any endpoint.'
      ),
      icon: <Sparkles className='size-4' />,
    },
    {
      name: 'OpenWebUI',
      desc: t('Local AI interface that speaks OpenAI API natively.'),
      icon: <Bot className='size-4' />,
    },
  ]

  const coreFeatures: CoreFeature[] = [
    {
      title: t('Unified API'),
      desc: t(
        'One API for every major model. Stop juggling SDKs — switch providers whenever you like.'
      ),
      icon: <TerminalSquare className='size-5' strokeWidth={1.5} />,
    },
    {
      title: t('Smart routing'),
      desc: t(
        'Automatically picks the best node by latency, cost, and availability — fewer failures, less babysitting.'
      ),
      icon: <GitBranch className='size-5' strokeWidth={1.5} />,
    },
    {
      title: t('Ultra-low latency'),
      desc: t(
        'Global edge coverage with sub-100ms response — built for real-time inference and heavy concurrency.'
      ),
      icon: <Zap className='size-5' strokeWidth={1.5} />,
    },
    {
      title: t('Lower cost'),
      desc: t(
        'We pool the volume, you pocket the discount — up to 30% cheaper than calling the official API direct.'
      ),
      icon: <DollarSign className='size-5' strokeWidth={1.5} />,
    },
    {
      title: t('Enterprise-grade security'),
      desc: t(
        'End-to-end encryption, SOC 2 Type II compliant, with VPC private deployment and custom SLA — the full package.'
      ),
      icon: <ShieldCheck className='size-5' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='bg-background border-border/60 home-section relative z-10 overflow-hidden border-b'>
      {/* ─── Drop-in integration ─── */}
      <div className='mx-auto max-w-6xl px-6'>
        <AnimateInView>
          <span className='home-section-rule'>{t('Drop-in integration')}</span>
        </AnimateInView>

        <AnimateInView
          delay={80}
          animation='fade-up'
          className='mt-12 grid gap-12 sm:mt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16'
        >
          {/* Left: headline + code preview */}
          <div className='flex flex-col'>
            <h2 className='home-display home-display-lg text-foreground'>
              {t('Just change your')}{' '}
              <span className='font-mono'>BASE URL</span>
            </h2>
            <p className='text-muted-foreground mt-5 max-w-md text-[15px] leading-[1.65]'>
              {t(
                'Fully compatible with every mainstream AI format. Point your Base URL at us — no code changes, no SDK rewrites, live in seconds.'
              )}
            </p>

            <BaseUrlSwapCard />
          </div>

          {/* Right: integration cards */}
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            {integrations.map((item) => (
              <IntegrationCard key={item.name} item={item} />
            ))}
          </div>
        </AnimateInView>
      </div>

      {/* ─── Core features ─── */}
      <div className='mx-auto mt-24 max-w-6xl px-6 md:mt-32'>
        <AnimateInView>
          <span className='home-section-rule'>{t('Core capabilities')}</span>
        </AnimateInView>

        <div className='mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'>
          {coreFeatures.map((feature, i) => (
            <CoreFeatureCell key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function BaseUrlSwapCard() {
  const { t } = useTranslation()
  return (
    <div className='border-border/60 bg-card/40 mt-9 overflow-hidden rounded-xl border shadow-sm'>
      <div className='border-border/60 flex items-center justify-between border-b px-4 py-2.5'>
        <span className='text-muted-foreground text-[12px] tracking-tight'>
          {t('One line. Every model.')}
        </span>
        <div className='flex items-center gap-1.5'>
          {['violet', 'sky', 'emerald'].map((c) => (
            <span
              key={c}
              className={`size-1.5 rounded-full opacity-50 ${
                c === 'violet'
                  ? 'bg-violet-500'
                  : c === 'sky'
                    ? 'bg-sky-500'
                    : 'bg-emerald-500'
              }`}
            />
          ))}
        </div>
      </div>
      <pre className='text-foreground/80 px-5 py-5 font-mono text-[12.5px] leading-[1.75]'>
        <span className='text-muted-foreground/60'>
          {`// ${t('Before')}`}
          {'\n'}
        </span>
        <span className='text-violet-600 dark:text-violet-300'>base_url</span>
        {' = '}
        <span className='text-muted-foreground/60 line-through decoration-rose-500/60'>
          "https://api.openai.com/v1"
        </span>
        {'\n\n'}
        <span className='text-muted-foreground/60'>
          {`// ${t('After — 100+ models, ready to go')}`}
          {'\n'}
        </span>
        <span className='text-violet-600 dark:text-violet-300'>base_url</span>
        {' = '}
        <span className='text-emerald-700 dark:text-emerald-300'>
          "https://your-gateway/v1"
        </span>
      </pre>
    </div>
  )
}

function IntegrationCard(props: { item: Integration }) {
  const { item } = props
  return (
    <div className='group border-border/60 hover:border-border bg-card/30 hover:bg-card/60 relative flex flex-col gap-2 rounded-lg border p-4 transition-colors'>
      <div className='flex items-center gap-2'>
        <span className='text-foreground/70 bg-muted/60 group-hover:text-foreground group-hover:bg-muted flex size-7 items-center justify-center rounded-md transition-colors'>
          {item.icon}
        </span>
      </div>
      <p className='text-foreground mt-1 text-[12px] font-semibold tracking-[0.14em] uppercase'>
        {item.name}
      </p>
      <p className='text-muted-foreground text-[12.5px] leading-[1.55]'>
        {item.desc}
      </p>
    </div>
  )
}

function CoreFeatureCell(props: { feature: CoreFeature; index: number }) {
  const { feature, index } = props
  const dividerClass = getCellDividers(index, { base: 1, sm: 2, lg: 5 })
  return (
    <AnimateInView
      animation='fade-up'
      delay={index * 80}
      className={`home-cell relative flex flex-col gap-3 ${dividerClass}`}
    >
      <span className='text-foreground/80 inline-flex size-9 items-center justify-center rounded-md'>
        {feature.icon}
      </span>
      <h3 className='text-foreground mt-3 text-[15px] font-semibold tracking-tight'>
        {feature.title}
      </h3>
      <p className='text-muted-foreground text-[13px] leading-[1.6]'>
        {feature.desc}
      </p>
    </AnimateInView>
  )
}
