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
import { useState, useMemo, useEffect, useCallback, memo } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { safeJsonParse } from '../utils/json-parser'

type GroupRatioVisualEditorProps = {
  groupRatio: string
  topupGroupRatio: string
  userUsableGroups: string
  autoGroups: string
  newUserDefaultGroup: string
  defaultChannelGroup: string
  onChange: (field: string, value: string) => void
}

// A single conceptual group. The same name may have a consumption ratio,
// a top-up ratio, both, or neither; the two tables below render the slice
// of rows that apply to each side.
type GroupRow = {
  _id: string
  name: string
  // Consumption side (channel group / 消费分组)
  hasRatio: boolean
  ratio: number
  // Recharge side (user tier / 充值分组)
  hasTopupRatio: boolean
  topupRatio: number
  // Shared metadata (stored in userUsableGroups)
  selectable: boolean
  description: string
  adminOnly: boolean
  autoUpgrade: boolean
  // Threshold in RMB yuan (NOT cents) — UI-friendly. Serialized to cents on save.
  upgradeThresholdYuan: number
}

type StoredGroupMeta = {
  description?: string
  visibility?: string
  admin_only?: boolean
  auto_upgrade?: boolean
  upgrade_threshold?: number
}

const sectionCardClassName =
  'relative shadow-sm ring-0 before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border before:border-border/90'
const sectionHeaderClassName = 'border-b bg-muted/20'

let groupRowIdCounter = 0
function createGroupRowId() {
  groupRowIdCounter += 1
  return `gpr_${groupRowIdCounter}`
}

function normalizeRatio(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 1
}

function normalizeUsableGroupsMap(
  raw: unknown
): Record<string, StoredGroupMeta> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, StoredGroupMeta> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      // Legacy format: bare description string.
      out[name] = { description: value, visibility: 'public' }
    } else if (value && typeof value === 'object') {
      out[name] = value as StoredGroupMeta
    }
  }
  return out
}

function buildGroupRows(
  groupRatio: string,
  topupGroupRatio: string,
  userUsableGroups: string
): GroupRow[] {
  const ratioMap = safeJsonParse<Record<string, number>>(groupRatio, {
    fallback: {},
    context: 'group ratios',
  })
  const topupRatioMap = safeJsonParse<Record<string, number>>(topupGroupRatio, {
    fallback: {},
    context: 'topup group ratios',
  })
  const usableRaw = safeJsonParse<Record<string, unknown>>(userUsableGroups, {
    fallback: {},
    context: 'user usable groups',
  })
  const usableMap = normalizeUsableGroupsMap(usableRaw)
  const names = new Set([
    ...Object.keys(ratioMap),
    ...Object.keys(topupRatioMap),
    ...Object.keys(usableMap),
  ])

  return Array.from(names).map((name) => {
    const meta = usableMap[name] ?? {}
    const hasRatio = Object.prototype.hasOwnProperty.call(ratioMap, name)
    const hasTopupRatio = Object.prototype.hasOwnProperty.call(
      topupRatioMap,
      name
    )
    return {
      _id: createGroupRowId(),
      name,
      hasRatio,
      ratio: hasRatio ? normalizeRatio(ratioMap[name]) : 1,
      hasTopupRatio,
      topupRatio: hasTopupRatio ? normalizeRatio(topupRatioMap[name]) : 1,
      selectable: Object.prototype.hasOwnProperty.call(usableMap, name),
      description: String(meta.description ?? ''),
      adminOnly: Boolean(meta.admin_only),
      autoUpgrade: Boolean(meta.auto_upgrade),
      upgradeThresholdYuan:
        typeof meta.upgrade_threshold === 'number'
          ? meta.upgrade_threshold / 100
          : 0,
    }
  })
}

function serializeGroupRows(rows: GroupRow[]) {
  const groupRatio: Record<string, number> = {}
  const topupGroupRatio: Record<string, number> = {}
  const userUsableGroups: Record<string, StoredGroupMeta> = {}

  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    if (row.hasRatio) {
      groupRatio[name] = normalizeRatio(row.ratio)
    }
    if (row.hasTopupRatio) {
      topupGroupRatio[name] = normalizeRatio(row.topupRatio)
    }
    if (row.selectable) {
      const meta: StoredGroupMeta = {
        description: row.description,
        visibility: row.adminOnly ? 'private' : 'public',
      }
      if (row.adminOnly) meta.admin_only = true
      if (row.autoUpgrade) meta.auto_upgrade = true
      const thresholdCents = Math.max(
        0,
        Math.round((row.upgradeThresholdYuan ?? 0) * 100)
      )
      if (thresholdCents > 0) meta.upgrade_threshold = thresholdCents
      userUsableGroups[name] = meta
    }
  }

  return {
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    TopupGroupRatio: JSON.stringify(topupGroupRatio, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
  }
}

function groupRowsSignature(rows: GroupRow[]): string {
  const serialized = serializeGroupRows(rows)
  return JSON.stringify({
    groupRatio: safeJsonParse(serialized.GroupRatio, {
      fallback: {},
      silent: true,
    }),
    topupGroupRatio: safeJsonParse(serialized.TopupGroupRatio, {
      fallback: {},
      silent: true,
    }),
    userUsableGroups: safeJsonParse(serialized.UserUsableGroups, {
      fallback: {},
      silent: true,
    }),
  })
}

function sourceGroupRowsSignature(
  groupRatio: string,
  topupGroupRatio: string,
  userUsableGroups: string
): string {
  const usableRaw = safeJsonParse<Record<string, unknown>>(userUsableGroups, {
    fallback: {},
    silent: true,
  })
  return JSON.stringify({
    groupRatio: safeJsonParse(groupRatio, { fallback: {}, silent: true }),
    topupGroupRatio: safeJsonParse(topupGroupRatio, {
      fallback: {},
      silent: true,
    }),
    userUsableGroups: normalizeUsableGroupsMap(usableRaw),
  })
}

export const GroupRatioVisualEditor = memo(function GroupRatioVisualEditor({
  groupRatio,
  topupGroupRatio,
  userUsableGroups,
  autoGroups,
  newUserDefaultGroup,
  defaultChannelGroup,
  onChange,
}: GroupRatioVisualEditorProps) {
  const { t } = useTranslation()

  const [autoGroupDialogOpen, setAutoGroupDialogOpen] = useState(false)
  const [autoGroupInput, setAutoGroupInput] = useState('')

  // Parse auto groups
  const autoGroupsList = useMemo(() => {
    return safeJsonParse<string[]>(autoGroups, {
      fallback: [],
      context: 'auto groups',
    })
  }, [autoGroups])

  // Build the option list for the "new user default group" picker from the
  // configured usable groups + the saved value (in case it isn't in the map).
  const defaultGroupOptions = useMemo(() => {
    const usableRaw = safeJsonParse<Record<string, unknown>>(userUsableGroups, {
      fallback: {},
      silent: true,
    })
    const usableMap = normalizeUsableGroupsMap(usableRaw)
    const seen = new Set<string>()
    const out: { name: string; description: string }[] = []
    for (const name of Object.keys(usableMap)) {
      if (!name || seen.has(name)) continue
      seen.add(name)
      const meta = usableMap[name]
      out.push({
        name,
        description: String(meta?.description ?? ''),
      })
    }
    // Ensure the currently saved value is always selectable, even if it was
    // removed from UserUsableGroups.
    const currentValue = (newUserDefaultGroup ?? '').trim() || 'default'
    if (!seen.has(currentValue)) {
      out.unshift({ name: currentValue, description: '' })
    }
    return out
  }, [userUsableGroups, newUserDefaultGroup])

  const selectedDefaultGroup = (newUserDefaultGroup ?? '').trim() || 'default'

  // Build the option list for the "default channel group" picker from the
  // configured GroupRatio (consumption groups). Channel groups are a different
  // axis from user tiers — they tag channels/tokens and drive billing markup.
  const channelGroupOptions = useMemo(() => {
    const ratioMap = safeJsonParse<Record<string, unknown>>(groupRatio, {
      fallback: {},
      silent: true,
    })
    const seen = new Set<string>()
    const out: { name: string }[] = []
    for (const name of Object.keys(ratioMap)) {
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({ name })
    }
    const currentValue = (defaultChannelGroup ?? '').trim() || 'default'
    if (!seen.has(currentValue)) {
      out.unshift({ name: currentValue })
    }
    return out
  }, [groupRatio, defaultChannelGroup])

  const selectedDefaultChannelGroup =
    (defaultChannelGroup ?? '').trim() || 'default'

  // Auto groups handlers
  const handleAutoGroupAdd = () => {
    setAutoGroupInput('')
    setAutoGroupDialogOpen(true)
  }

  const handleAutoGroupSave = () => {
    if (!autoGroupInput.trim()) return

    const list = [...autoGroupsList, autoGroupInput.trim()]
    onChange('AutoGroups', JSON.stringify(list, null, 2))
    setAutoGroupDialogOpen(false)
  }

  const handleAutoGroupDelete = (index: number) => {
    const list = autoGroupsList.filter((_, i) => i !== index)
    onChange('AutoGroups', JSON.stringify(list, null, 2))
  }

  const handleAutoGroupMove = (index: number, direction: 'up' | 'down') => {
    const list = [...autoGroupsList]
    const newIndex = direction === 'up' ? index - 1 : index + 1

    if (newIndex < 0 || newIndex >= list.length) return
    ;[list[index], list[newIndex]] = [list[newIndex], list[index]]
    onChange('AutoGroups', JSON.stringify(list, null, 2))
  }

  return (
    <div className='space-y-4'>
      <GroupPricingTables
        groupRatio={groupRatio}
        topupGroupRatio={topupGroupRatio}
        userUsableGroups={userUsableGroups}
        onChange={onChange}
      />

      {/* New user default group */}
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <CardTitle>{t('New user default group')}</CardTitle>
          <CardDescription>
            {t(
              'Group assigned to newly registered users. This single value drives both the consumption ratio (GroupRatio) and the recharge ratio (TopupGroupRatio) for the user.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='max-w-sm space-y-2'>
            <Label htmlFor='new-user-default-group'>{t('Default group')}</Label>
            <Select
              value={selectedDefaultGroup}
              onValueChange={(value) =>
                onChange('NewUserDefaultGroup', value ?? '')
              }
            >
              <SelectTrigger id='new-user-default-group'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultGroupOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.description
                      ? `${option.name} — ${option.description}`
                      : option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Default channel group (consumption side) */}
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <CardTitle>{t('Default channel group')}</CardTitle>
          <CardDescription>
            {t(
              'Channel-group pre-selected when an admin creates a new channel. Independent of user tiers — drives the request-time GroupRatio billing markup.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='max-w-sm space-y-2'>
            <Label htmlFor='default-channel-group'>{t('Default group')}</Label>
            <Select
              value={selectedDefaultChannelGroup}
              onValueChange={(value) =>
                onChange('DefaultChannelGroup', value ?? '')
              }
            >
              <SelectTrigger id='default-channel-group'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channelGroupOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Auto Groups */}
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <CardTitle>{t('Auto assignment order')}</CardTitle>
          <CardDescription>
            {t(
              'Priority order for automatic group assignment. New tokens rotate through this list.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <Button onClick={handleAutoGroupAdd} size='sm'>
              <Plus className='mr-2 h-4 w-4' />
              {t('Add group')}
            </Button>
            {autoGroupsList.length > 0 && (
              <div className='space-y-2'>
                {autoGroupsList.map((group, index) => (
                  <div
                    key={index}
                    className='flex items-center gap-2 rounded-md border p-3'
                  >
                    <GripVertical className='text-muted-foreground h-4 w-4' />
                    <span className='flex-1 font-medium'>{group}</span>
                    <div className='flex gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={index === 0}
                        onClick={() => handleAutoGroupMove(index, 'up')}
                      >
                        ↑
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={index === autoGroupsList.length - 1}
                        onClick={() => handleAutoGroupMove(index, 'down')}
                      >
                        ↓
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => handleAutoGroupDelete(index)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto Group Dialog */}
      <Dialog open={autoGroupDialogOpen} onOpenChange={setAutoGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Add auto group')}</DialogTitle>
            <DialogDescription>
              {t('Add a group identifier to the auto assignment list.')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>{t('Group identifier')}</Label>
              <Input
                value={autoGroupInput}
                onChange={(e) => setAutoGroupInput(e.target.value)}
                placeholder={t('default')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setAutoGroupDialogOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleAutoGroupSave}>{t('Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

type GroupPricingTablesProps = {
  groupRatio: string
  topupGroupRatio: string
  userUsableGroups: string
  onChange: (field: string, value: string) => void
}

function GroupPricingTables({
  groupRatio,
  topupGroupRatio,
  userUsableGroups,
  onChange,
}: GroupPricingTablesProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<GroupRow[]>(() =>
    buildGroupRows(groupRatio, topupGroupRatio, userUsableGroups)
  )

  useEffect(() => {
    const incomingSignature = sourceGroupRowsSignature(
      groupRatio,
      topupGroupRatio,
      userUsableGroups
    )
    setRows((currentRows) => {
      if (groupRowsSignature(currentRows) === incomingSignature) {
        return currentRows
      }
      return buildGroupRows(groupRatio, topupGroupRatio, userUsableGroups)
    })
  }, [groupRatio, topupGroupRatio, userUsableGroups])

  const emitRows = useCallback(
    (nextRows: GroupRow[]) => {
      setRows(nextRows)
      const serialized = serializeGroupRows(nextRows)
      onChange('GroupRatio', serialized.GroupRatio)
      onChange('TopupGroupRatio', serialized.TopupGroupRatio)
      onChange('UserUsableGroups', serialized.UserUsableGroups)
    },
    [onChange]
  )

  const updateRow = useCallback(
    (
      id: string,
      field: Exclude<keyof GroupRow, '_id'>,
      value: string | number | boolean
    ) => {
      emitRows(
        rows.map((row) => (row._id === id ? { ...row, [field]: value } : row))
      )
    },
    [emitRows, rows]
  )

  const removeFromConsumption = useCallback(
    (id: string) => {
      const next = rows
        .map((row) => (row._id === id ? { ...row, hasRatio: false } : row))
        // Drop a row entirely if it no longer participates in either side
        // AND has no user-facing metadata.
        .filter((row) => row.hasRatio || row.hasTopupRatio || row.selectable)
      emitRows(next)
    },
    [emitRows, rows]
  )

  const removeFromRecharge = useCallback(
    (id: string) => {
      const next = rows
        .map((row) =>
          row._id === id
            ? {
                ...row,
                hasTopupRatio: false,
                autoUpgrade: false,
                upgradeThresholdYuan: 0,
              }
            : row
        )
        .filter((row) => row.hasRatio || row.hasTopupRatio || row.selectable)
      emitRows(next)
    },
    [emitRows, rows]
  )

  const addConsumptionRow = useCallback(() => {
    const existingNames = new Set(rows.map((row) => row.name))
    let index = 1
    let name = `group_${index}`
    while (existingNames.has(name)) {
      index += 1
      name = `group_${index}`
    }
    emitRows([
      ...rows,
      {
        _id: createGroupRowId(),
        name,
        hasRatio: true,
        ratio: 1,
        hasTopupRatio: false,
        topupRatio: 1,
        selectable: true,
        description: '',
        adminOnly: false,
        autoUpgrade: false,
        upgradeThresholdYuan: 0,
      },
    ])
  }, [emitRows, rows])

  const addRechargeRow = useCallback(() => {
    const existingNames = new Set(rows.map((row) => row.name))
    let index = 1
    let name = `tier_${index}`
    while (existingNames.has(name)) {
      index += 1
      name = `tier_${index}`
    }
    emitRows([
      ...rows,
      {
        _id: createGroupRowId(),
        name,
        hasRatio: false,
        ratio: 1,
        hasTopupRatio: true,
        topupRatio: 1,
        selectable: true,
        description: '',
        adminOnly: false,
        autoUpgrade: false,
        upgradeThresholdYuan: 0,
      },
    ])
  }, [emitRows, rows])

  const consumptionRows = useMemo(
    () => rows.filter((row) => row.hasRatio),
    [rows]
  )
  const rechargeRows = useMemo(
    () => rows.filter((row) => row.hasTopupRatio),
    [rows]
  )

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  }, [rows])

  return (
    <div className='space-y-4'>
      {/* 消费分组 — Consumption groups (channel-side billing ratio) */}
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle>{t('Consumption groups')}</CardTitle>
              <CardDescription>
                {t(
                  'Channel-side groups tagged on channels and tokens. The ratio multiplies the per-request billing cost.'
                )}
              </CardDescription>
            </div>
            <Button
              onClick={addConsumptionRow}
              size='sm'
              className='sm:self-start'
            >
              <Plus className='mr-2 h-4 w-4' />
              {t('Add group')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-32'>
                      {t('Group name')}
                    </TableHead>
                    <TableHead className='w-24'>{t('Ratio')}</TableHead>
                    <TableHead className='w-24 text-center'>
                      {t('User selectable')}
                    </TableHead>
                    <TableHead className='w-24 text-center'>
                      {t('Admin only')}
                    </TableHead>
                    <TableHead className='min-w-40'>
                      {t('Description')}
                    </TableHead>
                    <TableHead className='w-16 text-right'>
                      {t('Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptionRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-muted-foreground h-20 text-center text-sm'
                      >
                        {t(
                          'No consumption groups yet. Add a group to get started.'
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    consumptionRows.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell>
                          <Input
                            value={row.name}
                            onChange={(event) =>
                              updateRow(row._id, 'name', event.target.value)
                            }
                            aria-invalid={duplicateNames.includes(
                              row.name.trim()
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type='number'
                            min={0}
                            step={0.1}
                            value={String(row.ratio)}
                            onChange={(event) =>
                              updateRow(
                                row._id,
                                'ratio',
                                normalizeRatio(event.target.value)
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-center'>
                            <Checkbox
                              checked={row.selectable}
                              onCheckedChange={(checked) =>
                                updateRow(
                                  row._id,
                                  'selectable',
                                  checked === true
                                )
                              }
                              aria-label={t('User selectable')}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-center'>
                            <Checkbox
                              checked={row.adminOnly}
                              disabled={!row.selectable}
                              onCheckedChange={(checked) =>
                                updateRow(
                                  row._id,
                                  'adminOnly',
                                  checked === true
                                )
                              }
                              aria-label={t('Admin only')}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.description}
                            placeholder={t('Group description')}
                            onChange={(event) => {
                              emitRows(
                                rows.map((r) =>
                                  r._id === row._id
                                    ? {
                                        ...r,
                                        selectable: true,
                                        description: event.target.value,
                                      }
                                    : r
                                )
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => removeFromConsumption(row._id)}
                            aria-label={t('Delete')}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 充值分组 — Recharge groups (user-tier topup ratio) */}
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle>{t('Recharge groups')}</CardTitle>
              <CardDescription>
                {t(
                  'User-tier groups assigned to a user. The top-up ratio multiplies the recharge price; auto-upgrade promotes users once they pass the cumulative threshold.'
                )}
              </CardDescription>
            </div>
            <Button
              onClick={addRechargeRow}
              size='sm'
              className='sm:self-start'
            >
              <Plus className='mr-2 h-4 w-4' />
              {t('Add group')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-32'>
                      {t('Group name')}
                    </TableHead>
                    <TableHead className='w-28'>{t('Top-up ratio')}</TableHead>
                    <TableHead className='w-24 text-center'>
                      {t('Admin only')}
                    </TableHead>
                    <TableHead className='w-24 text-center'>
                      {t('Auto upgrade')}
                    </TableHead>
                    <TableHead className='w-32'>{t('Threshold ($)')}</TableHead>
                    <TableHead className='min-w-40'>
                      {t('Description')}
                    </TableHead>
                    <TableHead className='w-16 text-right'>
                      {t('Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rechargeRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-muted-foreground h-20 text-center text-sm'
                      >
                        {t(
                          'No recharge groups yet. Add a group to get started.'
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rechargeRows.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell>
                          <Input
                            value={row.name}
                            onChange={(event) =>
                              updateRow(row._id, 'name', event.target.value)
                            }
                            aria-invalid={duplicateNames.includes(
                              row.name.trim()
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type='number'
                            min={0}
                            step={0.05}
                            value={String(row.topupRatio)}
                            onChange={(event) =>
                              updateRow(
                                row._id,
                                'topupRatio',
                                normalizeRatio(event.target.value)
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-center'>
                            <Checkbox
                              checked={row.adminOnly}
                              onCheckedChange={(checked) => {
                                const isAdminOnly = checked === true
                                emitRows(
                                  rows.map((r) =>
                                    r._id === row._id
                                      ? {
                                          ...r,
                                          // Recharge rows always carry metadata
                                          selectable: true,
                                          adminOnly: isAdminOnly,
                                          // Admin-only tiers can't also auto-upgrade
                                          autoUpgrade: isAdminOnly
                                            ? false
                                            : r.autoUpgrade,
                                        }
                                      : r
                                  )
                                )
                              }}
                              aria-label={t('Admin only')}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-center'>
                            <Checkbox
                              checked={row.autoUpgrade}
                              disabled={row.adminOnly}
                              onCheckedChange={(checked) => {
                                emitRows(
                                  rows.map((r) =>
                                    r._id === row._id
                                      ? {
                                          ...r,
                                          selectable: true,
                                          autoUpgrade: checked === true,
                                        }
                                      : r
                                  )
                                )
                              }}
                              aria-label={t('Auto upgrade')}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type='number'
                            min={0}
                            step={1}
                            value={String(row.upgradeThresholdYuan)}
                            disabled={!row.autoUpgrade}
                            onChange={(event) => {
                              const v = parseFloat(event.target.value)
                              updateRow(
                                row._id,
                                'upgradeThresholdYuan',
                                Number.isFinite(v) ? Math.max(0, v) : 0
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.description}
                            placeholder={t('Group description')}
                            onChange={(event) => {
                              emitRows(
                                rows.map((r) =>
                                  r._id === row._id
                                    ? {
                                        ...r,
                                        selectable: true,
                                        description: event.target.value,
                                      }
                                    : r
                                )
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => removeFromRecharge(row._id)}
                            aria-label={t('Delete')}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {duplicateNames.length > 0 && (
              <p className='text-destructive text-sm'>
                {t('Duplicate group names: {{names}}', {
                  names: duplicateNames.join(', '),
                })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
