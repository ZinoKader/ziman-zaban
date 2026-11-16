import { BookA, ChartNoAxesColumn, GraduationCap, Home, Info, Languages, Menu, Mic, Settings as SettingsIcon, ShieldCheck, Sparkles, SpellCheck } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
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
import { AccountMenu } from '@/features/account/account-menu'
import { ALL_MODULES, MODULES, PICTURES_MODULE } from '@/features/modules'
import { SaveIndicator } from '@/features/progress/save-indicator'
import { progressStrings } from '@/features/progress/strings'
import { hasUnseen } from '@/features/whats-new/changelog'
import { whatsNewStrings } from '@/features/whats-new/strings'
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

const GLIDE = { type: 'spring', bounce: 0.15, duration: 0.45 } as const

/** Pages come in with a short fade and rise. Moves within one page (a word, a grammar point) don't. */
function usePageEntrance(main: React.RefObject<HTMLElement | null>, pathname: string) {
  const section = pathname.split('/').slice(0, pathname.startsWith('/learn/') ? 4 : 2).join('/')
  const last = useRef(section)
  useLayoutEffect(() => {
    if (last.current === section) return
    last.current = section
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    main.current?.animate?.(
      still ? [{ opacity: 0.4 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: still ? 160 : 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [main, section])
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
    <LayoutGroup id={useId()}>
      <div role="radiogroup" aria-label="Target language" className={cn('flex rounded-full border bg-muted p-0.5', className)}>
        {(['ckb', 'fa'] as TargetLang[]).map((l) => (
          <button
            key={l}
            role="radio"
            aria-checked={targetLang === l}
            onClick={() => set({ targetLang: l })}
            className={cn(
              'relative isolate rounded-full px-3 py-1 text-sm font-medium transition-colors',
              targetLang === l ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {targetLang === l && <motion.span layoutId="thumb" transition={GLIDE} className="absolute inset-0 -z-10 rounded-full bg-card shadow-sm" />}
            <span lang={l} className="font-script me-1.5">{l === 'ckb' ? 'کوردی' : 'فارسی'}</span>
            <span className="hidden sm:inline lg:hidden">{s.languagesShort[l]}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
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

function TopLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative isolate flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground xl:px-3',
          'before:absolute before:inset-0 before:-z-20 before:rounded-lg before:transition-colors hover:before:bg-muted/60',
          isActive && 'text-foreground',
          className,
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="top-nav" transition={GLIDE} className="absolute inset-0 -z-10 rounded-lg bg-muted" />}
          {children}
        </>
      )}
    </NavLink>
  )
}

interface TabLinkProps {
  to: string
  end?: boolean
  icon: React.ReactNode | ((active: boolean) => React.ReactNode)
  label: string
}

function TabLink({ to, end, icon, label }: TabLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex flex-col items-center gap-0.5 py-1.5 text-[0.7rem] text-muted-foreground transition-colors active:scale-95', isActive && 'font-medium text-foreground')
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative isolate grid h-7 w-12 place-items-center">
            {isActive && <motion.span layoutId="tab-pill" transition={GLIDE} className="absolute inset-0 -z-10 rounded-full bg-muted" />}
            {typeof icon === 'function' ? icon(isActive) : icon}
          </span>
          <span className="max-w-full truncate px-0.5">{label}</span>
        </>
      )}
    </NavLink>
  )
}

const MORE = [
  { to: '/words', icon: BookA, key: 'words' },
  { to: '/grammar', icon: GraduationCap, key: 'grammar' },
  { to: '/alphabet', icon: SpellCheck, key: 'alphabet' },
  { to: '/whats-new', icon: Sparkles, key: 'whatsNew' },
  { to: '/settings', icon: SettingsIcon, key: 'settings' },
  { to: '/about', icon: Info, key: 'about' },
  { to: '/review', icon: ShieldCheck, key: 'review' },
  { to: '/studio', icon: Mic, key: 'studio' },
] as const

export function AppLayout() {
  useTheme()
  useDocumentLang()
  const s = common.use()
  const p = progressStrings.use()
  const w = whatsNewStrings.use()
  const unseen = hasUnseen(useSettings((st) => st.changelogSeen))
  const location = useLocation()
  const inSession = /\/session/.test(location.pathname)
  const main = useRef<HTMLElement>(null)
  usePageEntrance(main, location.pathname)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col">
        {!inSession && (
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 2xl:max-w-7xl">
              <NavLink to="/" className="flex items-center gap-2 font-semibold">
                <span className="grid size-8 place-items-center rounded-lg bg-primary pt-1 font-poster text-xl text-primary-foreground" aria-hidden>
                  ز
                </span>
                <span className="hidden sm:inline lg:hidden xl:inline">{s.appName}</span>
              </NavLink>
              <nav className="ms-2 hidden items-center gap-1 lg:flex xl:ms-4">
                {ALL_MODULES.map((m) => (
                  <TopLink key={m.slug} to={`/learn/${m.slug}`} className={cn(!m.step && 'hidden 2xl:flex')}>
                    <m.icon className="size-4" />
                    {s.nav[m.skill]}
                  </TopLink>
                ))}
                <TopLink to="/progress">
                  <ChartNoAxesColumn className="size-4" />
                  {p.nav}
                </TopLink>
              </nav>
              <div className="ms-auto flex items-center gap-1 sm:gap-1.5">
                <SaveIndicator />
                <LanguageSwitch />
                <BaseLangSwitch />
                <AccountMenu />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={unseen ? `Menu, ${w.unseen}` : 'Menu'} className="relative">
                      <Menu />
                      {unseen && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary" aria-hidden />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <NavLink to="/progress">
                        <ChartNoAxesColumn /> {p.nav}
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <NavLink to={`/learn/${PICTURES_MODULE.slug}`}>
                        <PICTURES_MODULE.icon /> {s.nav.pictures}
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
                          {m.key === 'whatsNew' && unseen && (
                            <span className="ms-auto size-2 rounded-full bg-primary" aria-label={w.unseen} />
                          )}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
        )}

        <main ref={main} className={cn('flex-1', !inSession && 'pb-24 lg:pb-8')}>
          <Outlet />
        </main>

        {!inSession && (
          <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-5">
              <TabLink to="/" end icon={<Home className="size-5" />} label={s.nav.home} />
              {MODULES.map((m) => (
                <TabLink
                  key={m.slug}
                  to={`/learn/${m.slug}`}
                  icon={<m.icon className="size-5" />}
                  label={s.nav[m.skill]}
                />
              ))}
            </div>
          </nav>
        )}
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  )
}
