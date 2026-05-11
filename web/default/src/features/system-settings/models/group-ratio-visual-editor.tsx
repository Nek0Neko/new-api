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
  onChange: (field: string, value: string) => void
}

type GroupPricingRow = {
  _id: string
  name: string
  ratio: number
  topupRatio: number
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

let groupPricingIdCounter = 0
function createGroupPricingId() {
  groupPricingIdCounter += 1
  return `gpr_${groupPricingIdCounter}`
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

function buildGroupPricingRows(
  groupRatio: string,
  topupGroupRatio: string,
  userUsableGroups: string
): GroupPricingRow[] {
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
    return {
      _id: createGroupPricingId(),
      name,
      ratio: normalizeRatio(ratioMap[name]),
      topupRatio: normalizeRatio(topupRatioMap[name]),
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

function serializeGroupPricingRows(rows: GroupPricingRow[]) {
  const groupRatio: Record<string, number> = {}
  const topupGroupRatio: Record<string, number> = {}
  const userUsableGroups: Record<string, StoredGroupMeta> = {}

  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    groupRatio[name] = normalizeRatio(row.ratio)
    topupGroupRatio[name] = normalizeRatio(row.topupRatio)
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

function groupPricingSignature(rows: GroupPricingRow[]): string {
  const serialized = serializeGroupPricingRows(rows)
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

function sourceGroupPricingSignature(
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
      <GroupPricingTable
        groupRatio={groupRatio}
        topupGroupRatio={topupGroupRatio}
        userUsableGroups={userUsableGroups}
        onChange={onChange}
      />

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

type GroupPricingTableProps = {
  groupRatio: string
  topupGroupRatio: string
  userUsableGroups: string
  onChange: (field: string, value: string) => void
}

function GroupPricingTable({
  groupRatio,
  topupGroupRatio,
  userUsableGroups,
  onChange,
}: GroupPricingTableProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<GroupPricingRow[]>(() =>
    buildGroupPricingRows(groupRatio, topupGroupRatio, userUsableGroups)
  )

  useEffect(() => {
    const incomingSignature = sourceGroupPricingSignature(
      groupRatio,
      topupGroupRatio,
      userUsableGroups
    )
    setRows((currentRows) => {
      if (groupPricingSignature(currentRows) === incomingSignature) {
        return currentRows
      }
      return buildGroupPricingRows(
        groupRatio,
        topupGroupRatio,
        userUsableGroups
      )
    })
  }, [groupRatio, topupGroupRatio, userUsableGroups])

  const emitRows = useCallback(
    (nextRows: GroupPricingRow[]) => {
      setRows(nextRows)
      const serialized = serializeGroupPricingRows(nextRows)
      onChange('GroupRatio', serialized.GroupRatio)
      onChange('TopupGroupRatio', serialized.TopupGroupRatio)
      onChange('UserUsableGroups', serialized.UserUsableGroups)
    },
    [onChange]
  )

  const updateRow = useCallback(
    (
      id: string,
      field: Exclude<keyof GroupPricingRow, '_id'>,
      value: string | number | boolean
    ) => {
      emitRows(
        rows.map((row) => (row._id === id ? { ...row, [field]: value } : row))
      )
    },
    [emitRows, rows]
  )

  const addRow = useCallback(() => {
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
        _id: createGroupPricingId(),
        name,
        ratio: 1,
        topupRatio: 1,
        selectable: true,
        description: '',
        adminOnly: false,
        autoUpgrade: false,
        upgradeThresholdYuan: 0,
      },
    ])
  }, [emitRows, rows])

  const removeRow = useCallback(
    (id: string) => {
      emitRows(rows.filter((row) => row._id !== id))
    },
    [emitRows, rows]
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
    <Card className={sectionCardClassName}>
      <CardHeader className={sectionHeaderClassName}>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <CardTitle>{t('Pricing groups')}</CardTitle>
            <CardDescription>
              {t(
                'Edit billing ratios and user-selectable groups in one table.'
              )}
            </CardDescription>
          </div>
          <Button onClick={addRow} size='sm' className='sm:self-start'>
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
                  <TableHead className='min-w-32'>{t('Group name')}</TableHead>
                  <TableHead className='w-24'>{t('Ratio')}</TableHead>
                  <TableHead className='w-28'>{t('Top-up ratio')}</TableHead>
                  <TableHead className='w-24 text-center'>
                    {t('User selectable')}
                  </TableHead>
                  <TableHead className='w-24 text-center'>
                    {t('Admin only')}
                  </TableHead>
                  <TableHead className='w-24 text-center'>
                    {t('Auto upgrade')}
                  </TableHead>
                  <TableHead className='w-32'>{t('Threshold (¥)')}</TableHead>
                  <TableHead className='min-w-40'>{t('Description')}</TableHead>
                  <TableHead className='w-16 text-right'>
                    {t('Actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className='text-muted-foreground h-20 text-center text-sm'
                    >
                      {t('No groups yet. Add a group to get started.')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
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
                            checked={row.selectable}
                            onCheckedChange={(checked) =>
                              updateRow(row._id, 'selectable', checked === true)
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
                              updateRow(row._id, 'adminOnly', checked === true)
                            }
                            aria-label={t('Admin only')}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-center'>
                          <Checkbox
                            checked={row.autoUpgrade}
                            disabled={!row.selectable || row.adminOnly}
                            onCheckedChange={(checked) =>
                              updateRow(
                                row._id,
                                'autoUpgrade',
                                checked === true
                              )
                            }
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
                        {row.selectable ? (
                          <Input
                            value={row.description}
                            placeholder={t('Group description')}
                            onChange={(event) =>
                              updateRow(
                                row._id,
                                'description',
                                event.target.value
                              )
                            }
                          />
                        ) : (
                          <span className='text-muted-foreground px-3 text-sm'>
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => removeRow(row._id)}
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
  )
}
