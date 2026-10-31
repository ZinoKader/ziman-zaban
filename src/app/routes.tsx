import { createBrowserRouter } from 'react-router'
import { PagePlaceholder } from '@/components/page-placeholder'
import { HomePage } from '@/features/home/home-page'
import { ModulePage } from '@/features/module/module-page'
import { SessionPage } from '@/features/session/session-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { AppLayout } from './layout'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn/:module', element: <ModulePage /> },
      { path: 'learn/:module/session', element: <SessionPage /> },
      { path: 'words', element: <PagePlaceholder title="Words" /> },
      { path: 'grammar', element: <PagePlaceholder title="Grammar" /> },
      { path: 'alphabet', element: <PagePlaceholder title="Alphabet" /> },
      { path: 'about', element: <PagePlaceholder title="Method & sources" /> },
      { path: 'review', element: <PagePlaceholder title="Native review" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
])
