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
import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const _imageGenerationLinkSchema = z.object({
  ImageGenerationLink: z.string().url().optional().or(z.literal('')),
})

type ImageGenerationLinkFormValues = z.infer<typeof _imageGenerationLinkSchema>

type ImageGenerationLinkSectionProps = {
  defaultValue: string
}

export function ImageGenerationLinkSection({
  defaultValue,
}: ImageGenerationLinkSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const imageGenerationLinkSchema = z.object({
    ImageGenerationLink: z
      .string()
      .url({ error: () => t('Please enter a valid URL') })
      .optional()
      .or(z.literal('')),
  })

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<ImageGenerationLinkFormValues>({
      resolver: zodResolver(imageGenerationLinkSchema) as Resolver<
        ImageGenerationLinkFormValues,
        unknown,
        ImageGenerationLinkFormValues
      >,
      defaultValues: {
        ImageGenerationLink: defaultValue ?? '',
      },
      onSubmit: async (data) => {
        await updateOption.mutateAsync({
          key: 'ImageGenerationLink',
          value: data.ImageGenerationLink?.trim() ?? '',
        })
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('Image Generation')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting || updateOption.isPending}
              isResetDisabled={!isDirty}
              saveLabel='Save image generation settings'
            />
            <FormDirtyIndicator isDirty={isDirty} />

            <FormField
              control={form.control}
              name='ImageGenerationLink'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Image generation site URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://images.example.com'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Users will choose an API key, then open this standalone image generation site in a new tab.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
