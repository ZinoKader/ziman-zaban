import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { BootGate } from './app/boot-gate'
import { router } from './app/routes'
import { queryClient } from './data/query-client'
import { trackServerSaves } from './data/server-saves'
import { PROGRESS_KEY } from './store/progress'
import { startTabSync } from './store/tab-sync'
import './index.css'

document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
queryClient.mount()
trackServerSaves(queryClient, PROGRESS_KEY)
startTabSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootGate>
      <RouterProvider router={router} />
    </BootGate>
  </StrictMode>,
)
