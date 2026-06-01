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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getGroupChannels, mutateGroupChannel } from '../api'
import type { GroupChannel } from '../types'

type Props = { groupName: string; onChanged: () => void }

export function GroupChannelsTable({ groupName, onChanged }: Props) {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<GroupChannel[]>([])
  const [attachId, setAttachId] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const res = await getGroupChannels(groupName)
    if (res.success) setChannels(res.data ?? [])
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName])

  // Server errors are surfaced by the global axios interceptor's toast.
  const detach = async (id: number) => {
    setBusy(true)
    try {
      const res = await mutateGroupChannel(groupName, id, 'detach')
      if (res.success) {
        await reload()
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  const attach = async () => {
    const id = Number(attachId)
    if (!id) return
    setBusy(true)
    try {
      const res = await mutateGroupChannel(groupName, id, 'attach')
      if (res.success) {
        setAttachId('')
        await reload()
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {t('Channels in this group')}
          {channels.length > 0 && (
            <Badge variant="secondary">{channels.length}</Badge>
          )}
        </CardTitle>
        <CardAction className="flex gap-1.5">
          <Input
            className="h-8 w-28"
            placeholder={t('Channel ID')}
            value={attachId}
            onChange={(e) => setAttachId(e.target.value)}
          />
          <Button size="sm" onClick={attach} disabled={busy}>
            {t('Attach')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 pl-4">ID</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className="pr-4 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((ch) => (
              <TableRow key={ch.id}>
                <TableCell className="pl-4">{ch.id}</TableCell>
                <TableCell className="font-medium">{ch.name}</TableCell>
                <TableCell>
                  <Badge variant={ch.status === 1 ? 'secondary' : 'outline'}>
                    {ch.status === 1 ? t('Enabled') : t('Disabled')}
                  </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {ch.has_override && (
                      <Badge variant="outline">{t('override')}</Badge>
                    )}
                    <Link
                      to="/channels"
                      search={{ group: [groupName] }}
                      className={buttonVariants({
                        size: 'sm',
                        variant: 'link',
                      })}
                    >
                      {t('Edit in Channels')}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => detach(ch.id)}
                      disabled={busy}
                    >
                      {t('Detach')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {channels.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t('No channels in this group')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
