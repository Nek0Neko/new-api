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

const PROVIDERS: { id: string; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'meta', label: 'Meta' },
  { id: 'cohere', label: 'Cohere' },
  { id: 'azure', label: 'Azure' },
  { id: 'aws', label: 'AWS Bedrock' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'qwen', label: 'Qwen' },
]

export function TrustedBy() {
  const { t } = useTranslation()

  return (
    <section className='bg-background relative z-10 border-b'>
      <div className='mx-auto max-w-6xl px-6 py-12 md:py-14'>
        <p className='text-muted-foreground/70 mb-6 text-center text-[11px] font-medium tracking-[0.18em] uppercase'>
          {t('Built on top of the providers your team already uses')}
        </p>

        <div className='relative overflow-hidden'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 z-10'
            style={{
              background:
                'linear-gradient(to right, var(--background), transparent 8%, transparent 92%, var(--background))',
            }}
          />
          <div className='marquee-track flex w-max items-center gap-10 py-1'>
            {[...PROVIDERS, ...PROVIDERS, ...PROVIDERS].map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className='text-muted-foreground/60 hover:text-foreground flex h-7 shrink-0 items-center gap-2 transition-colors'
              >
                <span
                  aria-hidden
                  className='bg-muted-foreground/30 size-1.5 rounded-full'
                />
                <span className='text-sm font-medium tracking-tight'>
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
