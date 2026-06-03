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
import { useMemo, useRef } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const cosSchema = z.object({
  tencent_cos: z.object({
    enabled: z.boolean(),
    secret_id: z.string(),
    secret_key: z.string(),
    region: z.string(),
    bucket: z.string(),
    custom_domain: z.string(),
    path_prefix: z.string(),
  }),
})

type CosFormValues = z.infer<typeof cosSchema>

type TencentCosSectionProps = {
  defaultValues: {
    'tencent_cos.enabled': boolean
    'tencent_cos.secret_id': string
    'tencent_cos.secret_key': string
    'tencent_cos.region': string
    'tencent_cos.bucket': string
    'tencent_cos.custom_domain': string
    'tencent_cos.path_prefix': string
  }
}

type NormalizedCos = {
  'tencent_cos.enabled': boolean
  'tencent_cos.secret_id': string
  'tencent_cos.secret_key': string
  'tencent_cos.region': string
  'tencent_cos.bucket': string
  'tencent_cos.custom_domain': string
  'tencent_cos.path_prefix': string
}

const buildFormDefaults = (
  d: TencentCosSectionProps['defaultValues']
): CosFormValues => ({
  tencent_cos: {
    enabled: d['tencent_cos.enabled'],
    secret_id: d['tencent_cos.secret_id'] ?? '',
    secret_key: d['tencent_cos.secret_key'] ?? '',
    region: d['tencent_cos.region'] ?? '',
    bucket: d['tencent_cos.bucket'] ?? '',
    custom_domain: d['tencent_cos.custom_domain'] ?? '',
    path_prefix: d['tencent_cos.path_prefix'] ?? '',
  },
})

const normalize = (d: TencentCosSectionProps['defaultValues']): NormalizedCos => ({
  'tencent_cos.enabled': d['tencent_cos.enabled'],
  'tencent_cos.secret_id': (d['tencent_cos.secret_id'] ?? '').trim(),
  'tencent_cos.secret_key': (d['tencent_cos.secret_key'] ?? '').trim(),
  'tencent_cos.region': (d['tencent_cos.region'] ?? '').trim(),
  'tencent_cos.bucket': (d['tencent_cos.bucket'] ?? '').trim(),
  'tencent_cos.custom_domain': (d['tencent_cos.custom_domain'] ?? '').trim(),
  'tencent_cos.path_prefix': (d['tencent_cos.path_prefix'] ?? '').trim(),
})

const normalizeForm = (v: CosFormValues): NormalizedCos => ({
  'tencent_cos.enabled': v.tencent_cos.enabled,
  'tencent_cos.secret_id': v.tencent_cos.secret_id.trim(),
  'tencent_cos.secret_key': v.tencent_cos.secret_key.trim(),
  'tencent_cos.region': v.tencent_cos.region.trim(),
  'tencent_cos.bucket': v.tencent_cos.bucket.trim(),
  'tencent_cos.custom_domain': v.tencent_cos.custom_domain.trim(),
  'tencent_cos.path_prefix': v.tencent_cos.path_prefix.trim(),
})

const SECRET_KEYS = new Set(['tencent_cos.secret_id', 'tencent_cos.secret_key'])

export function TencentCosSection({ defaultValues }: TencentCosSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const baselineRef = useRef<NormalizedCos>(normalize(defaultValues))

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<CosFormValues>({
    resolver: zodResolver(cosSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const cosEnabled = form.watch('tencent_cos.enabled')

  const onSubmit = async (values: CosFormValues) => {
    const normalized = normalizeForm(values)
    const updates = (
      Object.keys(normalized) as Array<keyof NormalizedCos>
    ).filter(
      (key) =>
        !(SECRET_KEYS.has(key) && normalized[key] === '') &&
        normalized[key] !== baselineRef.current[key]
    )

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of updates) {
      const value = normalized[key]
      await updateOption.mutateAsync({
        key,
        value,
      })
    }

    baselineRef.current = normalized
  }

  return (
    <SettingsSection title={t('Tencent COS Storage')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save COS settings'
          />

          <FormField
            control={form.control}
            name='tencent_cos.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Tencent COS')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Store generated images in COS and return URLs instead of base64'
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

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='tencent_cos.region'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('COS Region')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder='ap-guangzhou'
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='tencent_cos.bucket'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('COS Bucket')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder='mybucket-1250000000'
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Bucket name including the APPID suffix')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='tencent_cos.secret_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret ID')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    type='password'
                    disabled={!cosEnabled}
                    placeholder={t('Enter new value to update')}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Leave blank to keep the existing credential')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='tencent_cos.secret_key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Secret Key')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    type='password'
                    disabled={!cosEnabled}
                    placeholder={t('Enter new value to update')}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Leave blank to keep the existing credential')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-6 md:grid-cols-2'>
            <FormField
              control={form.control}
              name='tencent_cos.custom_domain'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Custom Domain / CDN')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder='https://img.example.com'
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Optional. Leave blank to use the default bucket domain')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='tencent_cos.path_prefix'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Path Prefix')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      placeholder='images'
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
