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
import { ComponentType } from 'react'
import {
  Anthropic,
  Azure,
  Bedrock,
  Cohere,
  DeepSeek,
  Gemini,
  Meta,
  Mistral,
  OpenAI,
  Qwen,
} from '@lobehub/icons'
import { useTranslation } from 'react-i18next'

interface Provider {
  id: string
  label: string
  Icon: ComponentType<{ size?: number | string }>
}

const PROVIDERS: Provider[] = [
  { id: 'openai', label: 'OpenAI', Icon: OpenAI },
  { id: 'anthropic', label: 'Anthropic', Icon: Anthropic },
  { id: 'google', label: 'Google', Icon: Gemini },
  { id: 'mistral', label: 'Mistral', Icon: Mistral },
  { id: 'meta', label: 'Meta', Icon: Meta },
  { id: 'cohere', label: 'Cohere', Icon: Cohere },
  { id: 'azure', label: 'Azure', Icon: Azure },
  { id: 'aws', label: 'AWS Bedrock', Icon: Bedrock },
  { id: 'deepseek', label: 'DeepSeek', Icon: DeepSeek },
  { id: 'qwen', label: 'Qwen', Icon: Qwen },
]

export function TrustedBy() {
  const { t } = useTranslation()

  return (
    <section className='bg-background border-border/60 relative z-10 border-b'>
      <div className='home-section-band mx-auto max-w-6xl px-6'>
        <div className='mb-8 flex justify-center'>
          <span className='home-section-rule-center'>
            {t('Powered by the providers your team already trusts')}
          </span>
        </div>

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
            {[...PROVIDERS, ...PROVIDERS, ...PROVIDERS].map((p, i) => {
              const Icon = p.Icon
              return (
                <div
                  key={`${p.id}-${i}`}
                  className='text-muted-foreground/60 hover:text-foreground flex h-7 shrink-0 items-center gap-2 transition-colors'
                >
                  <Icon size={18} aria-hidden />
                  <span className='text-sm font-medium tracking-tight'>
                    {p.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
