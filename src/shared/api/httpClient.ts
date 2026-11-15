import { getAccessToken } from '../lib/authSession'
import { env } from '../lib/env'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/**
 * SEG-3: the gateway refused the request because this address sent too many
 * (429). `retryAfterSeconds` comes from the response's Retry-After header.
 */
export class RateLimitedError extends HttpError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(429, `Too many requests. Wait ${retryAfterSeconds} s and try again.`)
    this.name = 'RateLimitedError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Sends the request without the access token (only the guest-token request needs this). */
  anonymous?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal, anonymous = false } = options
  // Every request carries the session's access token: the gateway answers 401 without a valid one.
  const token = anonymous ? null : await getAccessToken()

  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new RateLimitedError(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 1)
  }

  if (!response.ok) {
    throw new HttpError(response.status, `Request to ${path} failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

/** Thin wrapper around `fetch` that targets the API gateway. */
export const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
