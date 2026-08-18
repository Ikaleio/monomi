import { AlertCircleIcon, UserRoundPlusIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { redirect, useNavigate } from "react-router"
import { useTranslation } from "react-i18next"

import { BrandMark } from "~/components/brand-mark"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { api, ApiClientError, fetchJson } from "~/lib/api-client"
import { loadAuthState } from "~/lib/auth-loader"

export function meta() {
  return [{ title: "首次设置 · Monomi" }, { name: "description", content: "创建 Monomi 管理员" }]
}

export async function clientLoader() {
  const state = await loadAuthState()
  if (state.setup.initialized) {
    throw redirect(state.session.authenticated ? "/app" : "/login")
  }
  return state
}

export default function SetupRoute() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const mismatch = confirmation.length > 0 && password !== confirmation

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setError(t("passwordMismatch"))
      return
    }
    setPending(true)
    setError(null)
    try {
      await fetchJson(api.setup.$url().toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      navigate("/app", { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "初始化失败，请稍后重试")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/45 p-5">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <BrandMark />
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{t("setupTitle")}</CardTitle>
            <CardDescription>{t("setupDescription")}</CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent>
              <FieldGroup>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle>无法完成设置</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <FieldLabel htmlFor="username">{t("username")}</FieldLabel>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9._-]+"
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </Field>
                <Field data-invalid={mismatch}>
                  <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={mismatch}
                  />
                </Field>
                <Field data-invalid={mismatch}>
                  <FieldLabel htmlFor="confirmation">{t("confirmPassword")}</FieldLabel>
                  <Input
                    id="confirmation"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    aria-invalid={mismatch}
                  />
                  {mismatch && <FieldError>{t("passwordMismatch")}</FieldError>}
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="pt-6">
              <Button type="submit" className="w-full" disabled={pending || mismatch}>
                {pending ? <Spinner data-icon="inline-start" /> : <UserRoundPlusIcon data-icon="inline-start" />}
                {pending ? t("saving") : t("createAdmin")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
