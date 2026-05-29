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
import { useRef } from 'react'
import { ImagePlusIcon, XIcon, ScissorsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fileToImageInputFile, imageInputFileToDataUrl } from './image-encoding'
import type { ImageInputFile } from './types'

async function filesToImageInputs(fileList: FileList | null) {
  if (!fileList || fileList.length === 0) return []
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
  return Promise.all(files.map(fileToImageInputFile))
}

interface AddImageButtonProps {
  disabled?: boolean
  onAdd: (files: ImageInputFile[]) => void
}

/** Compact toolbar control that opens the file picker and adds reference images. */
export function AddImageButton({ disabled, onAdd }: AddImageButtonProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (fileList: FileList | null) => {
    const inputs = await filesToImageInputs(fileList)
    if (inputs.length > 0) onAdd(inputs)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Button
        type='button'
        variant='outline'
        className='h-8 gap-1.5'
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlusIcon className='size-4' />
        {t('Add image')}
      </Button>
      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
    </>
  )
}

interface UploadTrayProps {
  images: ImageInputFile[]
  mask: ImageInputFile | null
  disabled?: boolean
  onRemove: (id: string) => void
  onEditMask: () => void
  onClearMask: () => void
}

/** Thumbnail strip for uploaded reference images (rendered only when non-empty). */
export function UploadTray({
  images,
  mask,
  disabled,
  onRemove,
  onEditMask,
  onClearMask,
}: UploadTrayProps) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {images.map((img, idx) => (
        <div
          key={img.id}
          className='group border-border bg-muted relative size-16 overflow-hidden rounded-lg border'
        >
          <img
            alt={img.name}
            src={imageInputFileToDataUrl(img)}
            className='block h-full w-full object-cover'
          />
          <button
            type='button'
            disabled={disabled}
            onClick={() => onRemove(img.id)}
            className='bg-background/80 text-foreground hover:bg-background absolute top-0.5 right-0.5 inline-flex size-5 items-center justify-center rounded-md opacity-0 backdrop-blur transition-opacity group-hover:opacity-100'
            aria-label={t('Remove')}
          >
            <XIcon className='size-3' />
          </button>
          {idx === 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type='button'
                      disabled={disabled}
                      onClick={onEditMask}
                      className='bg-background/80 text-foreground hover:bg-background absolute bottom-0.5 left-0.5 inline-flex size-5 items-center justify-center rounded-md backdrop-blur transition-colors'
                      aria-label={t('Edit mask')}
                    >
                      <ScissorsIcon className='size-3' />
                    </button>
                  }
                />
                <TooltipContent side='top'>
                  <p className='text-xs'>{t('Edit mask')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ))}

      {mask && (
        <span className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
          {t('Mask set')}
          <button
            type='button'
            onClick={onClearMask}
            className='hover:text-foreground underline'
          >
            {t('Clear')}
          </button>
        </span>
      )}
    </div>
  )
}
