import { AlertCircleIcon, LogInIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { redirect, useLoaderData, useNavigate } from "react-router"
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { api, ApiClientError, fetchJson } from "~/lib/api-client"
import { loadAuthState, safeNext } from "~/lib/auth-loader"

export function meta() {
  return [
    { title: "登录 · Monomi" },
    { name: "description", content: "登录 Monomi 管理后台" },
  ]
}

export async function clientLoader({ request }: { request: Request }) {
  const state = await loadAuthState()
  if (!state.setup.initialized) throw redirect("/setup")
  const next = safeNext(request.url)
  if (state.session.authenticated) throw redirect(next)
  return { ...state, next }
}

export default function LoginRoute() {
  const { t } = useTranslation()
  const { next } = useLoaderData<typeof clientLoader>()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await fetchJson(api.auth.login.$url().toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      navigate(next, { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "登录失败，请稍后重试"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/45 px-3 py-5">
      <div className="flex w-full max-w-md flex-col gap-4">
        <BrandMark />
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl">
              {t("loginTitle")}
            </CardTitle>
            <CardDescription>{t("loginDescription")}</CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent>
              <FieldGroup>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon aria-hidden="true" />
                    <AlertTitle>无法登录</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="username">{t("username")}</FieldLabel>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    aria-invalid={Boolean(error)}
                  />
                </Field>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(error)}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="pt-6">
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <LogInIcon data-icon="inline-start" />
                )}
                {pending ? t("loggingIn") : t("login")}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
