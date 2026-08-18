import {
  Globe2Icon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"

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

export function UtilityMenus({ showLogout = false }: { showLogout?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="选择语言">
            <Globe2Icon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuLabel>显示语言</DropdownMenuLabel>
            <DropdownMenuItem>简体中文</DropdownMenuItem>
            <DropdownMenuItem>English</DropdownMenuItem>
            <DropdownMenuItem>日本語</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="选择主题模式">
            <SunIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuLabel>主题模式</DropdownMenuLabel>
            <DropdownMenuItem>
              <SunIcon aria-hidden="true" />
              浅色
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MoonIcon aria-hidden="true" />
              深色
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MonitorIcon aria-hidden="true" />
              跟随系统
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {showLogout && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button variant="ghost" size="icon" aria-label="退出">
            <LogOutIcon aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  )
}
