export type CheckErrorCode =
  | "TIMEOUT"
  | "DNS_ERROR"
  | "CONNECTION_REFUSED"
  | "TLS_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "STATUS_MISMATCH"
  | "KEYWORD_MISSING"
  | "RESPONSE_TOO_LARGE"
  | "UNKNOWN_ERROR"

export type CheckOutcome = {
  success: boolean
  latencyMs: number
  statusCode?: number
  errorCode?: CheckErrorCode
  errorMessage?: string
}
