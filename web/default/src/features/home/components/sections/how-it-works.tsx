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

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
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
    <section className='bg-background relative z-10 border-b'>
      <div className='mx-auto max-w-6xl px-6 py-28 md:py-36'>
        <AnimateInView className='mb-16 max-w-2xl md:mb-20'>
          <p className='mb-4 text-[11px] font-medium tracking-[0.18em] text-violet-600 uppercase dark:text-violet-300'>
            {t('How it works')}
          </p>
          <h2 className='text-foreground text-[clamp(1.875rem,3.8vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em]'>
            {t('Get up and running in')}{' '}
            <span className='text-muted-foreground'>{t('three steps.')}</span>
          </h2>
        </AnimateInView>

        <div className='relative'>
          {/* Connector line — desktop only */}
          <div
            aria-hidden
            className='via-border/80 absolute top-7 left-0 hidden h-px w-full bg-gradient-to-r from-transparent to-transparent md:block'
          />

          <div className='grid gap-12 md:grid-cols-3 md:gap-8'>
            {steps.map((step, i) => (
              <AnimateInView
                key={step.num}
                delay={i * 120}
                animation='fade-up'
                className='relative'
              >
                <div className='bg-background border-border relative z-10 flex size-14 items-center justify-center rounded-xl border shadow-sm'>
                  <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
                    {step.num}
                  </span>
                </div>
                <h3 className='text-foreground mt-7 text-lg font-semibold tracking-[-0.02em]'>
                  {step.title}
                </h3>
                <p className='text-muted-foreground mt-2.5 text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </AnimateInView>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
