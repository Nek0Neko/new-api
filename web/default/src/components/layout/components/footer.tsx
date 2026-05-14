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
import { useTranslation } from 'react-i18next'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useStatus } from '@/hooks/use-status'
import { useTheme } from '@/context/theme-provider'

interface FooterProps {
  logo?: string
  name?: string
  copyright?: string
  className?: string
}

const NEW_API_HREF = 'https://github.com/QuantumNous/new-api'

function NewApiInlineLink() {
  const { t } = useTranslation()
  return (
    <a
      href={NEW_API_HREF}
      target='_blank'
      rel='noopener noreferrer'
      className='text-foreground/70 hover:text-foreground underline-offset-2 transition-colors hover:underline'
    >
      {t('Using New API')}
    </a>
  )
}

function ThemeIconToggle() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  const options = [
    { value: 'system' as const, icon: Monitor, label: t('System') },
    { value: 'light' as const, icon: Sun, label: t('Light') },
    { value: 'dark' as const, icon: Moon, label: t('Dark') },
  ]

  return (
    <div className='border-border/40 bg-muted/20 inline-flex items-center gap-0.5 rounded-md border p-0.5'>
      {options.map((option) => {
        const Icon = option.icon
        const isActive = theme === option.value
        return (
          <button
            key={option.value}
            type='button'
            onClick={() => setTheme(option.value)}
            aria-label={option.label}
            title={option.label}
            className={cn(
              'flex size-6 items-center justify-center rounded-sm transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-foreground'
            )}
          >
            <Icon className='size-3.5' />
          </button>
        )
      })}
    </div>
  )
}

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

function FooterColumnList(props: { title: string; links: FooterLink[] }) {
  if (props.links.length === 0) return null

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-foreground/80 text-sm font-medium'>{props.title}</p>
      <ul className='space-y-2.5'>
        {props.links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground/70 hover:text-foreground text-sm transition-colors'
              >
                {link.label}
              </a>
            ) : (
              <Link
                to={link.href}
                className='text-muted-foreground/70 hover:text-foreground text-sm transition-colors'
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const { systemName, logo: systemLogo, footerHtml } = useSystemConfig()
  const { status } = useStatus()

  const displayLogo = systemLogo || props.logo || '/logo.png'
  const displayName = systemName || props.name || 'New API'
  const currentYear = new Date().getFullYear()
  const docsLink = (status?.docs_link as string | undefined) || ''

  const productLinks: FooterLink[] = [
    ...(docsLink
      ? [{ label: t('API Docs'), href: docsLink, external: true }]
      : []),
    { label: t('Pricing'), href: '/pricing' },
    { label: t('Rankings'), href: '/rankings' },
  ]

  const companyLinks: FooterLink[] = [
    { label: t('About'), href: '/about' },
    { label: t('Terms'), href: '/user-agreement' },
    { label: t('Privacy Policy'), href: '/privacy-policy' },
  ]

  if (footerHtml) {
    return (
      <footer
        className={cn(
          'border-border/40 relative z-10 border-t',
          props.className
        )}
      >
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <div className='border-border/60 text-muted-foreground/60 w-full border-t pt-4 text-center text-xs sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:text-right'>
              <NewApiInlineLink />
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-border/40 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto max-w-6xl px-6 py-12 md:py-14'>
        <div className='flex flex-col justify-between gap-10 md:flex-row md:gap-16'>
          {/* Left section: brand + theme + copyright + status */}
          <div className='flex shrink-0 flex-col gap-4'>
            <div className='flex items-center gap-3'>
              <Link to='/' className='group flex items-center gap-2.5'>
                <div className='flex size-7 items-center justify-center overflow-hidden rounded-lg dark:bg-white'>
                  <img
                    src={displayLogo}
                    alt={displayName}
                    className='size-full rounded-lg object-contain'
                  />
                </div>
                <span className='text-sm font-semibold tracking-tight'>
                  {displayName}
                </span>
              </Link>
              <ThemeIconToggle />
            </div>

            <p className='text-muted-foreground/60 text-xs leading-relaxed'>
              &copy; {currentYear} {displayName}.{' '}
              {props.copyright ?? t('All rights reserved.')} <NewApiInlineLink />
            </p>

            <div className='text-muted-foreground/70 inline-flex items-center gap-1.5 text-xs'>
              <span className='relative flex size-2'>
                <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60'></span>
                <span className='relative inline-flex size-2 rounded-full bg-emerald-500'></span>
              </span>
              {t('All systems operational')}
            </div>
          </div>

          {/* Right section: link columns */}
          <div className='grid grid-cols-2 gap-10 sm:gap-16'>
            <FooterColumnList title={t('Product')} links={productLinks} />
            <FooterColumnList title={t('Company')} links={companyLinks} />
          </div>
        </div>
      </div>
    </footer>
  )
}
