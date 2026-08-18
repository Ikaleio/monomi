import {
  CheckIcon,
  Globe2Icon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { mutate } from "swr"
import { useTranslation } from "react-i18next"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Separator } from "~/components/ui/separator"
import { useThemeMode, type ThemeMode } from "~/hooks/use-theme"
import { api, unwrap } from "~/lib/api-client"
import { setLocale, type Locale } from "~/lib/i18n"

const themes: Array<{
  value: ThemeMode
  labelKey: "light" | "dark" | "system"
  icon: typeof SunIcon
}> = [
  { value: "light", labelKey: "light", icon: SunIcon },
  { value: "dark", labelKey: "dark", icon: MoonIcon },
  { value: "system", labelKey: "system", icon: MonitorIcon },
]

const languages: Array<{
  value: Locale
  labelKey: "chinese" | "english" | "japanese"
}> = [
  { value: "zh-CN", labelKey: "chinese" },
  { value: "en", labelKey: "english" },
  { value: "ja", labelKey: "japanese" },
]

export function UtilityMenus({ showLogout = false }: { showLogout?: boolean }) {
  const { theme, setTheme } = useThemeMode()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const ThemeIcon =
    themes.find((item) => item.value === theme)?.icon ?? MonitorIcon

  async function logout() {
    try {
      await unwrap(await api.auth.logout.$post())
      await mutate("session", undefined, { revalidate: false })
      navigate("/login", { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("requestFailed"))
    }
  }

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("language")}>
            <Globe2Icon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            {languages.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onSelect={() => void setLocale(item.value)}
              >
                <span>{t(item.labelKey)}</span>
                {i18n.language === item.value && (
                  <CheckIcon className="ml-auto" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("theme")}>
            <ThemeIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
            {themes.map((item) => {
              const Icon = item.icon
              return (
                <DropdownMenuItem
                  key={item.value}
                  onSelect={() => setTheme(item.value)}
                >
                  <Icon aria-hidden="true" />
                  {t(item.labelKey)}
                  {theme === item.value && (
                    <CheckIcon className="ml-auto" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {showLogout && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("logout")}
            onClick={logout}
          >
            <LogOutIcon aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  )
}
