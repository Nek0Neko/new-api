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
import { AnimateInView } from '@/components/animate-in-view'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='bg-background relative isolate z-10 overflow-hidden'>
      <div className='mx-auto max-w-6xl px-6 py-32 md:py-40'>
        <AnimateInView
          className='relative mx-auto max-w-2xl text-center'
          animation='fade-up'
        >
          <p className='mb-5 text-[11px] font-medium tracking-[0.18em] text-violet-600 uppercase dark:text-violet-300'>
            {t('Plan the present, ship the future')}
          </p>
          <h2 className='text-foreground text-[clamp(2.25rem,5vw,3.5rem)] leading-[1] font-semibold tracking-[-0.04em] [text-wrap:balance]'>
            {t('Ready to ship AI without')}{' '}
            <span className='text-muted-foreground'>{t('the glue code?')}</span>
          </h2>
          <p className='text-muted-foreground mx-auto mt-6 max-w-md text-[15px] leading-relaxed [text-wrap:balance] md:text-base'>
            {t(
              'Self-host in minutes. Bring your existing provider keys. Keep your SDKs.'
            )}
          </p>
          <div className='mt-10 flex flex-wrap items-center justify-center gap-3'>
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
              {t('Compare plans')}
              <ChevronRight className='ml-0.5 size-3.5' />
            </Button>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
