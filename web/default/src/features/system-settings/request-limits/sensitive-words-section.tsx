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
import { useEffect, useRef, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  parseSensitiveWordGroups,
  parseTxtWords,
  serializeSensitiveWordGroups,
} from './sensitive-word-groups'

const sensitiveSchema = z.object({
  CheckSensitiveEnabled: z.boolean(),
  CheckSensitiveOnPromptEnabled: z.boolean(),
})

type SensitiveFormValues = z.infer<typeof sensitiveSchema>

type SensitiveWordsSectionProps = {
  defaultValues: SensitiveFormValues & {
    SensitiveWords?: string
  }
}

type EditableGroup = {
  name: string
  enabled: boolean
  wordsText: string
}

type PendingImport = {
  name: string
  words: string[]
}

function toEditableGroups(value: string | undefined): EditableGroup[] {
  return parseSensitiveWordGroups(value ?? '').map((group) => ({
    name: group.name,
    enabled: group.enabled,
    wordsText: group.words.join('\n'),
  }))
}

function normalizeStoredValue(value: string | undefined): string {
  return serializeSensitiveWordGroups(parseSensitiveWordGroups(value ?? ''))
}

function downloadTxt(name: string, words: string[]) {
  const blob = new Blob([words.join('\n')], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name || 'sensitive-words'}.txt`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function SensitiveWordsSection({
  defaultValues,
}: SensitiveWordsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<SensitiveFormValues>({
    resolver: zodResolver(sensitiveSchema),
    defaultValues: {
      CheckSensitiveEnabled: defaultValues.CheckSensitiveEnabled,
      CheckSensitiveOnPromptEnabled: defaultValues.CheckSensitiveOnPromptEnabled,
    },
  })

  const [groups, setGroups] = useState<EditableGroup[]>(() =>
    toEditableGroups(defaultValues.SensitiveWords)
  )
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)

  useEffect(() => {
    form.reset({
      CheckSensitiveEnabled: defaultValues.CheckSensitiveEnabled,
      CheckSensitiveOnPromptEnabled: defaultValues.CheckSensitiveOnPromptEnabled,
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroups(toEditableGroups(defaultValues.SensitiveWords))
  }, [defaultValues, form])

  const updateGroup = (index: number, patch: Partial<EditableGroup>) => {
    setGroups((prev) =>
      prev.map((group, i) => (i === index ? { ...group, ...patch } : group))
    )
  }

  const addGroup = () => {
    setGroups((prev) => [...prev, { name: '', enabled: true, wordsText: '' }])
  }

  const deleteGroup = (index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index))
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    const groupName = file.name.replace(/\.txt$/i, '').trim()
    const words = parseTxtWords(await file.text())
    // reset so re-uploading the same file fires the change event again
    event.target.value = ''

    if (words.length === 0) {
      toast.error(t('The uploaded file is empty'))
      return
    }

    const existsIndex = groups.findIndex(
      (group) => group.name.trim() === groupName
    )
    if (existsIndex !== -1) {
      setPendingImport({ name: groupName, words })
      return
    }

    setGroups((prev) => [
      ...prev,
      { name: groupName, enabled: true, wordsText: words.join('\n') },
    ])
  }

  const applyImport = (mode: 'merge' | 'overwrite') => {
    if (!pendingImport) return
    const { name, words } = pendingImport
    setGroups((prev) =>
      prev.map((group) => {
        if (group.name.trim() !== name) return group
        if (mode === 'overwrite') {
          return { ...group, wordsText: words.join('\n') }
        }
        const existing = parseTxtWords(group.wordsText)
        const merged = Array.from(new Set([...existing, ...words]))
        return { ...group, wordsText: merged.join('\n') }
      })
    )
    setPendingImport(null)
  }

  const exportGroup = (group: EditableGroup) => {
    downloadTxt(group.name.trim(), parseTxtWords(group.wordsText))
  }

  const onSubmit = async (values: SensitiveFormValues) => {
    // validate group names before saving anything
    const seen = new Set<string>()
    for (const group of groups) {
      const name = group.name.trim()
      if (name === '') {
        toast.error(t('Group name cannot be empty'))
        return
      }
      if (seen.has(name)) {
        toast.error(t('Duplicate group name: {{name}}', { name }))
        return
      }
      seen.add(name)
    }

    const switchUpdates: Array<[keyof SensitiveFormValues, boolean]> = (
      Object.keys(values) as Array<keyof SensitiveFormValues>
    )
      .filter((key) => values[key] !== defaultValues[key])
      .map((key) => [key, values[key]])

    for (const [key, value] of switchUpdates) {
      await updateOption.mutateAsync({ key, value })
    }

    const serialized = serializeSensitiveWordGroups(
      groups.map((group) => ({
        name: group.name.trim(),
        enabled: group.enabled,
        words: parseTxtWords(group.wordsText),
      }))
    )
    if (serialized !== normalizeStoredValue(defaultValues.SensitiveWords)) {
      await updateOption.mutateAsync({ key: 'SensitiveWords', value: serialized })
    }
  }

  return (
    <SettingsSection title={t('Sensitive Words')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save sensitive words'
          />
          <div className='space-y-4'>
            <FormField
              control={form.control}
              name='CheckSensitiveEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable filtering')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Blocks messages when sensitive keywords are detected.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='CheckSensitiveOnPromptEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Inspect user prompts')}</FormLabel>
                    <FormDescription>
                      {t(
                        'When enabled, prompts are scanned before reaching upstream models.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </div>

          <div className='space-y-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <FormLabel>{t('Blocked keywords')}</FormLabel>
              <div className='flex items-center gap-2'>
                <Button type='button' variant='outline' onClick={addGroup}>
                  {t('Add group')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={triggerUpload}
                >
                  {t('Upload .txt file')}
                </Button>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.txt,text/plain'
                  className='hidden'
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <FormDescription>
              {t(
                'Organize keywords into groups. The file name becomes the group name; each line is one keyword.'
              )}
            </FormDescription>

            {groups.map((group, index) => (
              <Card key={index}>
                <CardContent className='space-y-3 pt-4'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Input
                      className='min-w-40 flex-1'
                      placeholder={t('Group name')}
                      value={group.name}
                      onChange={(event) =>
                        updateGroup(index, { name: event.target.value })
                      }
                    />
                    <Badge variant='secondary'>
                      {parseTxtWords(group.wordsText).length} {t('words')}
                    </Badge>
                    <Switch
                      checked={group.enabled}
                      onCheckedChange={(checked) =>
                        updateGroup(index, { enabled: checked })
                      }
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => exportGroup(group)}
                    >
                      {t('Export')}
                    </Button>
                    <Button
                      type='button'
                      variant='destructive'
                      size='sm'
                      onClick={() => deleteGroup(index)}
                    >
                      {t('Delete group')}
                    </Button>
                  </div>
                  <Textarea
                    rows={6}
                    placeholder={t('Enter one keyword per line')}
                    value={group.wordsText}
                    onChange={(event) =>
                      updateGroup(index, { wordsText: event.target.value })
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </SettingsForm>
      </Form>

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('A group named {{name}} already exists.', {
                name: pendingImport?.name ?? '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Merge keeps existing keywords and adds new ones; overwrite replaces the group contents.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant='outline'
              onClick={() => applyImport('merge')}
            >
              {t('Merge')}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => applyImport('overwrite')}>
              {t('Overwrite')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
