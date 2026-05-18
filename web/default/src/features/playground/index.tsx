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
import {
  MessageSquareIcon,
  ImageIcon,
  VideoIcon,
  Music2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChatPlayground } from './chat-panel'
import { ImagePlayground } from './image'
import { VideoPlayground } from './video'
import { MusicPlayground } from './music'

type PlaygroundTab = 'chat' | 'image' | 'video' | 'music'

const STORAGE_KEY = 'playground_active_tab'
const DEFAULT_TAB: PlaygroundTab = 'chat'
const VALID_TABS: PlaygroundTab[] = ['chat', 'image', 'video', 'music']

function loadActiveTab(): PlaygroundTab {
  if (typeof window === 'undefined') return DEFAULT_TAB
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw && VALID_TABS.includes(raw as PlaygroundTab)) {
      return raw as PlaygroundTab
    }
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  return DEFAULT_TAB
}

export function Playground() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<PlaygroundTab>(loadActiveTab)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, activeTab)
    } catch {
      // ignore quota/private-mode errors
    }
  }, [activeTab])

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as PlaygroundTab)}
      className='size-full gap-0'
    >
      <div className='flex shrink-0 items-center justify-center border-b px-4 py-2'>
        <TabsList>
          <TabsTrigger value='chat'>
            <MessageSquareIcon size={16} />
            <span>{t('Chat')}</span>
          </TabsTrigger>
          <TabsTrigger value='image'>
            <ImageIcon size={16} />
            <span>{t('Image')}</span>
          </TabsTrigger>
          <TabsTrigger value='video'>
            <VideoIcon size={16} />
            <span>{t('Video')}</span>
          </TabsTrigger>
          <TabsTrigger value='music'>
            <Music2Icon size={16} />
            <span>{t('Music')}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value='chat' className='min-h-0 flex-1 overflow-hidden'>
        <ChatPlayground />
      </TabsContent>
      <TabsContent value='image' className='min-h-0 flex-1 overflow-hidden'>
        <ImagePlayground />
      </TabsContent>
      <TabsContent value='video' className='min-h-0 flex-1 overflow-hidden'>
        <VideoPlayground />
      </TabsContent>
      <TabsContent value='music' className='min-h-0 flex-1 overflow-hidden'>
        <MusicPlayground />
      </TabsContent>
    </Tabs>
  )
}
