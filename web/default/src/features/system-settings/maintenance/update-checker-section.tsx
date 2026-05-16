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
  RefreshCcwIcon,
  RocketIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { formatTimestamp } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SettingsSection } from '../components/settings-section'

// Shape returned by GET /api/maintenance/image-status (backend:
// service/image_check.go → ImageStatus). Optional fields are present when
// the corresponding part of the check succeeded.
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
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const uptime = startTime ? formatTimestamp(startTime) : t('Unknown')
  const version = currentVersion || t('Unknown')

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  // Stop polling on unmount so a navigated-away page doesn't keep ticking.
  useEffect(() => stopPolling, [stopPolling])

  const handleCheckUpdates = async () => {
    setChecking(true)
    try {
      const res = await api.get<{
        success: boolean
        message?: string
        data?: ImageStatus
      }>('/api/maintenance/image-status', { skipBusinessError: true } as Record<
        string,
        unknown
      >)
      if (!res.data?.success) {
        toast.error(res.data?.message || t('Failed to check for updates'))
        return
      }
      const data = res.data.data || {}
      setStatus(data)
      if (data.message) {
        // Backend surfaced a non-fatal warning (e.g. registry unreachable).
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

  // After triggering an upgrade the container will restart. Poll /api/status
  // every 3s; the first request that succeeds after a failure means the new
  // container is up. The container restart invalidates the existing session,
  // so once it's back, clear local auth and hard-redirect to /sign-in. This
  // also ensures the browser picks up any new frontend assets shipped with
  // the new image. Without this redirect the user is stranded with a stale
  // "Session expired" toast the next time they touch a protected endpoint.
  const pollForRestart = useCallback(() => {
    let sawFailure = false
    stopPolling()
    pollTimer.current = setInterval(async () => {
      try {
        const res = await api.get('/api/status', {
          skipBusinessError: true,
          skipErrorHandler: true,
        } as Record<string, unknown>)
        if (sawFailure && res?.data?.success) {
          stopPolling()
          setUpgrading(false)
          toast.success(t('Upgrade complete. Please sign in again.'))
          try {
            useAuthStore.getState().auth.reset()
          } catch {
            /* empty */
          }
          // Brief delay so the success toast is visible before the reload.
          setTimeout(() => {
            window.location.replace('/sign-in')
          }, 800)
        }
      } catch {
        sawFailure = true
      }
    }, 3000)

    // Hard timeout so the spinner doesn't run forever if something is wrong.
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
        { skipBusinessError: true } as Record<string, unknown>
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
      <SettingsSection
        title={t('System maintenance')}
        description={t(
          'Compare the running container image against the registry and roll out updates.'
        )}
      >
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
                  {status.local_digest || '—'}
                </dd>
                <dt className='text-muted-foreground'>
                  {t('Registry digest')}
                </dt>
                <dd className='font-mono break-all'>
                  {status.remote_digest || '—'}
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
    </>
  )
}
