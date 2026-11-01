import { BookA, ChartNoAxesColumn, GraduationCap, Home, Info, Languages, Menu, Settings as SettingsIcon, ShieldCheck, SpellCheck } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { TargetLang } from '@/content/types'
import { common } from '@/i18n/common'
import { cn } from '@/lib/utils'
import { MODULES } from '@/features/modules'
import { SaveIndicator } from '@/features/progress/save-indicator'
import { progressStrings } from '@/features/progress/strings'
import { useSettings } from '@/store/settings'

function useTheme() {
  const theme = useSettings((s) => s.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

function useDocumentLang() {
  const baseLang = useSettings((s) => s.baseLang)
  useEffect(() => {
    document.documentElement.lang = baseLang
  }, [baseLang])
}

export function LanguageSwitch({ className }: { className?: string }) {
  const s = common.use()
  const targetLang = useSettings((st) => st.targetLang)
  const set = useSettings((st) => st.set)
  return (
    <div role="radiogroup" aria-label="Target language" className={cn('flex rounded-full border bg-muted p-0.5', className)}>
      {(['ckb', 'fa'] as TargetLang[]).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={targetLang === l}
          onClick={() => set({ targetLang: l })}
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium transition',
            targetLang === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span lang={l} className="font-script me-1.5">{l === 'ckb' ? 'کوردی' : 'فارسی'}</span>
          <span className="hidden sm:inline lg:hidden">{s.languagesShort[l]}</span>
        </button>
      ))}
    </div>
  )
}

function BaseLangSwitch() {
  const baseLang = useSettings((s) => s.baseLang)
  const set = useSettings((s) => s.set)
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => set({ baseLang: baseLang === 'en' ? 'sv' : 'en' })}
      aria-label={baseLang === 'en' ? 'Byt till svenska' : 'Switch to English'}
      className="font-semibold"
    >
      <Languages /> {baseLang === 'en' ? 'SV' : 'EN'}
    </Button>
  )
}

const MORE = [
  { to: '/words', icon: BookA, key: 'words' },
  { to: '/grammar', icon: GraduationCap, key: 'grammar' },
  { to: '/alphabet', icon: SpellCheck, key: 'alphabet' },
  { to: '/settings', icon: SettingsIcon, key: 'settings' },
  { to: '/about', icon: Info, key: 'about' },
  { to: '/review', icon: ShieldCheck, key: 'review' },
] as const

export function AppLayout() {
  useTheme()
  useDocumentLang()
  const s = common.use()
  const p = progressStrings.use()
  const location = useLocation()
  const inSession = /\/session/.test(location.pathname)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col">
        {!inSession && (
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
              <NavLink to="/" className="flex items-center gap-2 font-semibold">
                <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground font-script text-lg" aria-hidden>
                  ز
                </span>
                <span className="hidden sm:inline lg:hidden xl:inline">{s.appName}</span>
              </NavLink>
              <nav className="ms-2 hidden items-center gap-1 lg:flex xl:ms-4">
                {MODULES.map((m) => (
                  <NavLink
                    key={m.slug}
                    to={`/learn/${m.slug}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground',
                        isActive && 'bg-muted text-foreground',
                      )
                    }
                  >
                    <m.icon className={cn('size-4', m.text)} />
                    {s.nav[m.skill]}
                  </NavLink>
                ))}
                <NavLink
                  to="/progress"
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground',
                      isActive && 'bg-muted text-foreground',
                    )
                  }
                >
                  <ChartNoAxesColumn className="size-4" />
                  {p.nav}
                </NavLink>
              </nav>
              <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
                <SaveIndicator />
                <LanguageSwitch />
                <BaseLangSwitch />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Menu">
                      <Menu />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <NavLink to="/progress">
                        <ChartNoAxesColumn /> {p.nav}
                      </NavLink>
                    </DropdownMenuItem>
                    {MORE.slice(0, 3).map((m) => (
                      <DropdownMenuItem key={m.to} asChild>
                        <NavLink to={m.to}>
                          <m.icon /> {s.nav[m.key]}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {MORE.slice(3).map((m) => (
                      <DropdownMenuItem key={m.to} asChild>
                        <NavLink to={m.to}>
                          <m.icon /> {s.nav[m.key]}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        )}

        <main className={cn('flex-1', !inSession && 'pb-24 lg:pb-8')}>
          <Outlet />
        </main>

        {!inSession && (
          <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-5">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-0.5 py-2 text-[0.7rem] text-muted-foreground', isActive && 'text-foreground')
                }
              >
                <Home className="size-5" />
                {s.nav.home}
              </NavLink>
              {MODULES.map((m) => (
                <NavLink
                  key={m.slug}
                  to={`/learn/${m.slug}`}
                  className={({ isActive }) =>
                    cn('flex flex-col items-center gap-0.5 py-2 text-[0.7rem] text-muted-foreground', isActive && 'text-foreground')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <m.icon className={cn('size-5', isActive && m.text)} />
                      <span className="max-w-full truncate px-0.5">{s.nav[m.skill]}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  )
}
