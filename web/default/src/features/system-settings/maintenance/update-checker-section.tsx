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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCcwIcon,
  RocketIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { formatTimestamp, formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { SettingsSection } from '../components/settings-section'

type ImageStatus = {
  node_name?: string
  in_container?: boolean
  image_ref?: string
  local_digest?: string
  remote_digest?: string
  has_update?: boolean
  upgrader_ready?: boolean
  checked_at?: number
  message?: string
}

type ReleaseInfo = {
  tag_name: string
  name?: string
  body?: string
  html_url?: string
  published_at?: string
}

type UpdateCheckerSectionProps = {
  currentVersion?: string | null
  startTime?: number | null
}

export function UpdateCheckerSection({
  currentVersion,
  startTime,
}: UpdateCheckerSectionProps) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<ImageStatus | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [loadingRelease, setLoadingRelease] = useState(false)
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const uptime = startTime ? formatTimestamp(startTime) : t('Unknown')
  const version = currentVersion || t('Unknown')

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const handleCheckUpdates = async () => {
    setChecking(true)
    try {
      const res = await api.get<{
        success: boolean
        message?: string
        data?: ImageStatus
      }>('/api/maintenance/image-status', { skipBusinessError: true })
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Failed to check for updates'))
        return
      }
      const data = res.data.data || {}
      setStatus(data)
      if (data.message) {
        toast.warning(data.message)
        return
      }
      if (data.has_update) {
        toast.info(t('A newer image is available.'))
      } else if (data.local_digest && data.remote_digest) {
        toast.success(t('You are already on the latest image.'))
      }
    } catch {
      // Axios interceptor already shows a toast for HTTP errors.
    } finally {
      setChecking(false)
    }
  }

  const pollForRestart = useCallback(() => {
    let sawFailure = false
    stopPolling()
    pollTimer.current = setInterval(async () => {
      try {
        const res = await api.get('/api/status', {
          skipBusinessError: true,
          skipErrorHandler: true,
        })
        if (sawFailure && res?.data?.success) {
          stopPolling()
          setUpgrading(false)
          toast.success(t('Upgrade complete. Please sign in again.'))
          try {
            useAuthStore.getState().auth.reset()
          } catch {
            /* empty */
          }
          setTimeout(() => {
            window.location.replace('/sign-in')
          }, 800)
        }
      } catch {
        sawFailure = true
      }
    }, 3000)

    setTimeout(
      () => {
        if (pollTimer.current) {
          stopPolling()
          setUpgrading(false)
          toast.warning(
            t(
              'Upgrade did not complete within the expected window. Check the host logs.'
            )
          )
        }
      },
      5 * 60 * 1000
    )
  }, [stopPolling, t])

  const handleUpgrade = async () => {
    setUpgrading(true)
    setConfirmOpen(false)
    try {
      const res = await api.post<{ success: boolean; message?: string }>(
        '/api/maintenance/upgrade',
        {},
        { skipBusinessError: true }
      )
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Failed to trigger upgrade'))
        setUpgrading(false)
        return
      }
      toast.info(
        t(
          'Upgrade triggered. The container will restart shortly. This page will refresh state automatically.'
        )
      )
      pollForRestart()
    } catch {
      setUpgrading(false)
    }
  }

  const handleOpenReleaseNotes = async () => {
    setLoadingRelease(true)
    try {
      const response = await fetch(
        'https://api.github.com/repos/Calcium-Ion/new-api/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'new-api-dashboard',
          },
        }
      )

      if (!response.ok) {
        throw new Error(t('Failed to contact GitHub releases API'))
      }

      const data = (await response.json()) as ReleaseInfo
      if (!data?.tag_name) {
        throw new Error(t('Unexpected release payload'))
      }

      setRelease(data)
      setReleaseDialogOpen(true)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('Failed to load update announcement')
      toast.error(message)
    } finally {
      setLoadingRelease(false)
    }
  }

  const goToRelease = () => {
    if (release?.html_url) {
      window.open(release.html_url, '_blank', 'noopener,noreferrer')
    }
  }

  const updateBadge = (() => {
    if (!status) return null
    if (status.has_update) {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-300'>
          <AlertTriangleIcon className='h-3 w-3' />
          {t('Update available')}
        </span>
      )
    }
    if (status.local_digest && status.remote_digest) {
      return (
        <span className='inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300'>
          <CheckCircle2Icon className='h-3 w-3' />
          {t('Up to date')}
        </span>
      )
    }
    return null
  })()

  const upgraderUnavailable =
    status !== null && status.in_container && !status.upgrader_ready

  return (
    <>
      <SettingsSection title={t('System maintenance')}>
        <div className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='rounded-lg border p-4'>
              <div className='text-muted-foreground text-sm'>
                {t('Current version')}
              </div>
              <div className='text-lg font-semibold'>{version}</div>
            </div>
            <div className='rounded-lg border p-4'>
              <div className='text-muted-foreground text-sm'>
                {t('Uptime since')}
              </div>
              <div className='text-lg font-semibold'>{uptime}</div>
            </div>
          </div>

          {status && (
            <div className='space-y-3 rounded-lg border p-4'>
              <div className='flex items-center justify-between gap-2'>
                <div className='text-sm font-medium'>
                  {t('Container image')}
                </div>
                {updateBadge}
              </div>
              <dl className='grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]'>
                <dt className='text-muted-foreground'>{t('Image')}</dt>
                <dd className='font-mono break-all'>
                  {status.image_ref || t('Unknown')}
                </dd>
                <dt className='text-muted-foreground'>{t('Node')}</dt>
                <dd className='font-mono'>
                  {status.node_name || t('Unknown')}
                </dd>
                <dt className='text-muted-foreground'>{t('Running digest')}</dt>
                <dd className='font-mono break-all'>
                  {status.local_digest || '-'}
                </dd>
                <dt className='text-muted-foreground'>
                  {t('Registry digest')}
                </dt>
                <dd className='font-mono break-all'>
                  {status.remote_digest || '-'}
                </dd>
              </dl>
              {status.message && (
                <p className='text-muted-foreground text-xs'>
                  {status.message}
                </p>
              )}
              {upgraderUnavailable && (
                <p className='flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300'>
                  <AlertTriangleIcon className='mt-0.5 h-3 w-3 shrink-0' />
                  {t(
                    'Watchtower service is not reachable. One-click upgrade is disabled.'
                  )}
                </p>
              )}
            </div>
          )}

          <div className='flex flex-wrap gap-2'>
            <Button
              onClick={handleCheckUpdates}
              disabled={checking || upgrading}
              variant='secondary'
            >
              <RefreshCcwIcon
                className={`me-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`}
              />
              {checking ? t('Checking updates...') : t('Check for updates')}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={
                upgrading || !status?.has_update || !status?.upgrader_ready
              }
            >
              <RocketIcon
                className={`me-2 h-4 w-4 ${upgrading ? 'animate-pulse' : ''}`}
              />
              {upgrading ? t('Upgrading...') : t('Upgrade now')}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={handleOpenReleaseNotes}
              disabled={loadingRelease}
            >
              {loadingRelease ? (
                <>
                  <RefreshCcwIcon className='me-2 h-4 w-4 animate-spin' />
                  {t('Loading update announcement...')}
                </>
              ) : (
                <>
                  <FileTextIcon className='me-2 h-4 w-4' />
                  {t('View update announcement')}
                </>
              )}
            </Button>
          </div>

          <p className='text-muted-foreground text-xs'>
            {t(
              'Note: upgrade only affects the node serving this request. Repeat on each node in multi-host deployments.'
            )}
          </p>
        </div>
      </SettingsSection>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Confirm upgrade')}</DialogTitle>
            <DialogDescription>
              {t(
                'This will pull the latest image and recreate the container. The service will be unavailable for a few seconds.'
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setConfirmOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' onClick={handleUpgrade}>
              {t('Start upgrade')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent className='max-h-[80vh] overflow-y-auto sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>
              {release?.tag_name
                ? t('Update announcement: {{version}}', {
                    version: release.tag_name,
                  })
                : t('Update announcement')}
            </DialogTitle>
            {release?.published_at && (
              <DialogDescription>
                {`${t('Published')} ${formatTimestampToDate(
                  new Date(release.published_at).getTime(),
                  'milliseconds'
                )}`}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className='space-y-4'>
            {release?.body ? (
              <Markdown>{release.body}</Markdown>
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t('No release notes provided.')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='secondary'
              onClick={() => setReleaseDialogOpen(false)}
            >
              {t('Close')}
            </Button>
            {release?.html_url && (
              <Button type='button' onClick={goToRelease}>
                <ExternalLinkIcon className='me-2 h-4 w-4' />
                {t('Open release')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
