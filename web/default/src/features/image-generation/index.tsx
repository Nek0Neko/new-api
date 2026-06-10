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
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  ImageIcon,
  KeyRoundIcon,
  Loader2Icon,
  SettingsIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/use-status'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Main } from '@/components/layout'
import type { SystemStatus } from '@/features/auth/types'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import type { ApiKey } from '@/features/keys/types'
import { buildImageGenerationLaunchUrl } from './launch-url'

function readStatusString(status: SystemStatus | null, key: string): string {
  const direct = status?.[key as keyof SystemStatus]
  if (typeof direct === 'string') return direct

  const nested = status?.data?.[key]
  return typeof nested === 'string' ? nested : ''
}

function getFallbackOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function getServerAddress(status: SystemStatus | null): string {
  return (
    readStatusString(status, 'server_address') ||
    readStatusString(status, 'serverAddress') ||
    getFallbackOrigin()
  )
}

function writeOpeningPage(targetWindow: Window) {
  try {
    targetWindow.document.write(
      '<!doctype html><title>Opening image generation...</title><body style="font-family:sans-serif;padding:24px;color:#222">Opening image generation...</body>'
    )
    targetWindow.document.close()
  } catch {
    /* target window may already be cross-origin */
  }
}

export function ImageGenerationLauncher() {
  const { t } = useTranslation()
  const { status, loading: isStatusLoading } = useStatus()
  const [selectedTokenId, setSelectedTokenId] = useState<string>('')
  const [isOpening, setIsOpening] = useState(false)
  const imageGenerationLink = readStatusString(status, 'image_generation_link')

  const { data: keysData, isLoading: isKeysLoading } = useQuery({
    queryKey: ['image-generation-api-keys'],
    queryFn: () => getApiKeys({ p: 1, size: 100 }),
  })

  const enabledKeys: ApiKey[] = useMemo(() => {
    const items = keysData?.data?.items
    if (!Array.isArray(items)) return []
    return items.filter((item) => item.status === API_KEY_STATUS.ENABLED)
  }, [keysData])

  useEffect(() => {
    if (selectedTokenId || enabledKeys.length === 0) return
    setSelectedTokenId(String(enabledKeys[0].id))
  }, [enabledKeys, selectedTokenId])

  const selectedToken = enabledKeys.find(
    (item) => String(item.id) === selectedTokenId
  )
  const isLoading = isStatusLoading || isKeysLoading

  const openImageGeneration = async () => {
    if (!imageGenerationLink.trim()) {
      toast.error(t('Image generation site URL is not configured'))
      return
    }
    if (!selectedToken) {
      toast.error(t('Please select an API key'))
      return
    }

    const targetWindow = window.open('about:blank', '_blank')
    if (!targetWindow) {
      toast.error(t('The browser blocked the new tab. Please allow pop-ups.'))
      return
    }
    writeOpeningPage(targetWindow)
    setIsOpening(true)

    try {
      const keyResult = await fetchTokenKey(selectedToken.id)
      const rawKey = keyResult.data?.key
      if (!keyResult.success || !rawKey) {
        throw new Error(keyResult.message || t('Failed to load API key'))
      }

      const url = buildImageGenerationLaunchUrl({
        baseUrl: imageGenerationLink,
        serverAddress: getServerAddress(status),
        apiKey: rawKey,
      })
      targetWindow.opener = null
      targetWindow.location.href = url
    } catch (error) {
      targetWindow.close()
      toast.error(
        error instanceof Error
          ? error.message
          : t('Unable to open image generation site')
      )
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <Main>
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8'>
        <Card className='relative overflow-hidden'>
          <div className='from-primary/10 via-background pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--tw-gradient-stops),transparent_42%)] to-transparent' />
          <CardHeader className='relative'>
            <div className='bg-primary/10 text-primary mb-2 inline-flex size-11 items-center justify-center rounded-2xl'>
              <ImageIcon className='size-5' />
            </div>
            <CardTitle>{t('Image Generation')}</CardTitle>
            <CardDescription>
              {t(
                'Choose an API key, then open the configured standalone image generation site in a new tab.'
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className='relative space-y-5'>
            {!imageGenerationLink.trim() ? (
              <Alert>
                <AlertCircleIcon className='size-4' />
                <AlertTitle>
                  {t('Image generation site URL is not configured')}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    'Ask an administrator to configure the standalone image generation site URL before using this entry.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            {enabledKeys.length === 0 && !isLoading ? (
              <Alert>
                <KeyRoundIcon className='size-4' />
                <AlertTitle>{t('No enabled API keys found')}</AlertTitle>
                <AlertDescription>
                  {t(
                    'Create or enable an API key before opening image generation.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className='space-y-2'>
              <div className='text-sm font-medium'>{t('API Key')}</div>
              {isLoading ? (
                <div className='text-muted-foreground inline-flex items-center gap-2 text-sm'>
                  <Loader2Icon className='size-4 animate-spin' />
                  {t('Loading…')}
                </div>
              ) : (
                <Select
                  value={selectedTokenId}
                  onValueChange={(value) => setSelectedTokenId(value ?? '')}
                  disabled={enabledKeys.length === 0}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder={t('Select API key…')} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledKeys.map((token) => (
                      <SelectItem key={token.id} value={String(token.id)}>
                        <div className='flex flex-col'>
                          <span>{token.name}</span>
                          <span className='text-muted-foreground font-mono text-xs'>
                            {token.key}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                onClick={openImageGeneration}
                disabled={
                  isOpening ||
                  isLoading ||
                  !imageGenerationLink.trim() ||
                  !selectedToken
                }
              >
                {isOpening ? (
                  <Loader2Icon className='size-4 animate-spin' />
                ) : (
                  <ExternalLinkIcon className='size-4' />
                )}
                {t('Open image generation')}
              </Button>
              <Button variant='outline' render={<Link to='/keys' />}>
                <KeyRoundIcon className='size-4' />
                {t('Manage API keys')}
              </Button>
              <Button
                variant='ghost'
                render={
                  <Link
                    to='/system-settings/site/$section'
                    params={{ section: 'image-generation' }}
                  />
                }
              >
                <SettingsIcon className='size-4' />
                {t('Configure image generation')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Main>
  )
}
