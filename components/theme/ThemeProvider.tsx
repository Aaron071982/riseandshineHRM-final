'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'

const THEME_KEY = 'theme'

export type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveDark(theme: Theme): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return getSystemDark()
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedDark, setResolvedDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  const onAdmin = pathname?.startsWith('/admin') ?? false

  useEffect(() => {
    setMounted(true)
    setThemeState(getStoredTheme())
    // Sync from profile when logged in (profile theme overrides localStorage)
    fetch('/api/profile', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const pref = data?.profile?.themePreference
        if (pref === 'light' || pref === 'dark' || pref === 'system') {
          setThemeState(pref)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_KEY, pref)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!mounted) return
    const darkPreference = resolveDark(theme)
    const shouldBeDark = onAdmin && darkPreference
    setResolvedDark(darkPreference)
    applyDark(shouldBeDark)
  }, [theme, mounted, onAdmin])

  useEffect(() => {
    if (!mounted || theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handle = () => {
      const darkPreference = mq.matches
      setResolvedDark(darkPreference)
      applyDark(onAdmin && darkPreference)
    }
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [theme, mounted, onAdmin])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, next)
    }
    const darkPreference = next === 'dark' || (next === 'system' && getSystemDark())
    setResolvedDark(darkPreference)
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    applyDark(path.indexOf('/admin') === 0 && darkPreference)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, resolvedDark }),
    [theme, setTheme, resolvedDark]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
