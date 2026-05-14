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
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { getCellDividers } from '@/features/home/lib/cell-dividers'

interface Step {
  num: string
  title: string
  desc: string
}

export function HowItWorks() {
  const { t } = useTranslation()

  const steps: Step[] = [
    {
      num: '01',
      title: t('Drop in your provider keys'),
      desc: t(
        'Add OpenAI, Anthropic, Google, or any of 40+ provider keys in a single channels view.'
      ),
    },
    {
      num: '02',
      title: t('Point your apps at the gateway'),
      desc: t(
        'Swap the BASE_URL in your existing OpenAI client. Streaming, tools, and embeddings keep working.'
      ),
    },
    {
      num: '03',
      title: t('Monitor, throttle, and bill'),
      desc: t(
        'Watch live request flow, set rate limits and quotas per key, export usage to your billing system.'
      ),
    },
  ]

  return (
    <section className='bg-background border-border/60 home-section relative z-10 overflow-hidden border-b'>
      <div className='mx-auto max-w-6xl px-6'>
        <AnimateInView>
          <span className='home-section-rule'>{t('How it works')}</span>
        </AnimateInView>

        <div className='mt-12 grid grid-cols-1 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3'>
          {steps.map((step, i) => (
            <StepCell key={step.num} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StepCell(props: { step: Step; index: number }) {
  const { step, index } = props
  const { t } = useTranslation()

  const dividerClass = getCellDividers(index, { base: 1, sm: 2, lg: 3 })

  return (
    <AnimateInView
      animation='fade-up'
      delay={index * 100}
      className={`group home-cell relative flex flex-col gap-5 ${dividerClass}`}
    >
      <div className='flex items-baseline justify-between'>
        <span className='home-numeric text-foreground/90 text-[clamp(2.5rem,4vw,3.25rem)] leading-none'>
          {step.num}
        </span>
        <span className='text-muted-foreground/60 text-[10.5px] font-medium tracking-[0.22em] uppercase'>
          {t('Step')}
        </span>
      </div>

      <div
        aria-hidden
        className='bg-border/70 group-hover:bg-foreground/50 mt-1 h-px w-10 transition-all duration-300 group-hover:w-16'
      />

      <h3 className='home-display text-foreground text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.025em]'>
        {step.title}
      </h3>
      <p className='text-muted-foreground max-w-sm text-[13.5px] leading-[1.65]'>
        {step.desc}
      </p>
    </AnimateInView>
  )
}
