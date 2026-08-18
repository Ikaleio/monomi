import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { ZodError } from "zod"

export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[] | undefined>,
  ) {
    super(message)
  }
}

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  fields?: Record<string, string[] | undefined>,
) {
  return c.json({ error: { code, message, ...(fields ? { fields } : {}) } }, status)
}

export function handleError(error: Error, c: Context, production: boolean) {
  if (error instanceof ApiError) {
    return jsonError(c, error.status, error.code, error.message, error.fields)
  }
  if (error instanceof ZodError) {
    const flattened = error.flatten().fieldErrors
    return jsonError(c, 400, "VALIDATION_ERROR", "提交的数据无效", flattened)
  }
  const message = production ? "服务器内部错误" : error.message
  return jsonError(c, 500, "INTERNAL_ERROR", message)
}
