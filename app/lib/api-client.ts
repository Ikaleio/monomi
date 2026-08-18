import { hc } from "hono/client"

import type { AppType } from "../../server/app"

const apiOrigin =
  typeof window === "undefined" ? "http://localhost" : window.location.origin

export const api = hc<AppType>(`${apiOrigin}/api`)

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message)
  }
}

export async function unwrap<T>(
  response: Response & { json(): Promise<T> },
): Promise<T> {
  if (response.status === 204) return undefined as T
  const payload = await response.json()
  if (!response.ok) {
    const error = payload as {
      error?: {
        code?: string
        message?: string
        fields?: Record<string, string[]>
      }
    }
    throw new ApiClientError(
      response.status,
      error.error?.code ?? "REQUEST_FAILED",
      error.error?.message ?? "请求失败",
      error.error?.fields,
    )
  }
  return payload
}

export async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  return unwrap(response as Response & { json(): Promise<T> })
}

export const swrConfig = {
  revalidateOnFocus: true,
  shouldRetryOnError: false,
}
