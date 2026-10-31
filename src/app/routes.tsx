import { createBrowserRouter } from 'react-router'
import { AboutPage } from '@/features/about/about-page'
import { AlphabetPage } from '@/features/alphabet/alphabet-page'
import { GrammarPage } from '@/features/grammar/grammar-page'
import { HomePage } from '@/features/home/home-page'
import { ModulePage } from '@/features/module/module-page'
import { ReviewPage } from '@/features/review/review-page'
import { SessionPage } from '@/features/session/session-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { WordsPage } from '@/features/words/words-page'
import { AppLayout } from './layout'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn/:module', element: <ModulePage /> },
      { path: 'learn/:module/session', element: <SessionPage /> },
      { path: 'words', element: <WordsPage /> },
      { path: 'words/:conceptId', element: <WordsPage /> },
      { path: 'grammar', element: <GrammarPage /> },
      { path: 'grammar/:pointId', element: <GrammarPage /> },
      { path: 'alphabet', element: <AlphabetPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
])
