import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type ThemeMode = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: ThemeMode
  setTheme(theme: ThemeMode): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function cookieTheme(): ThemeMode {
  if (typeof document === "undefined") return "system"
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("monomi_theme="))
    ?.split("=")[1]
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system")

  useEffect(() => setThemeState(cookieTheme()), [])
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches)
      document.documentElement.classList.toggle("dark", dark)
      document.documentElement.style.colorScheme = dark ? "dark" : "light"
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme(next: ThemeMode) {
        document.cookie = `monomi_theme=${next}; path=/; max-age=31536000; samesite=lax`
        setThemeState(next)
      },
    }),
    [theme]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context)
    throw new Error("useThemeMode must be used inside ThemeProvider")
  return context
}
