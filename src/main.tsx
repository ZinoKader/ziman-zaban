import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { HydrationGate } from './app/hydration-gate'
import { router } from './app/routes'
import { startPersistence } from './store/hydration'
import { startTabSync } from './store/tab-sync'
import './index.css'

// The saved theme is only known after hydration; until then follow the device so the splash doesn't flash white.
document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
startPersistence()
startTabSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HydrationGate>
      <RouterProvider router={router} />
    </HydrationGate>
  </StrictMode>,
)
