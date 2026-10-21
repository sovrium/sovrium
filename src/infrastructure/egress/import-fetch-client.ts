/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The HTTP half of `sovrium import fetch` — the ONE network egress of the
 * migration command ([internal ref] A14, bounds 9 and 10).
 *
 * - **Read-only.** It sends what a source's documented read endpoints take
 *   (`GET`, and the `POST` of a query endpoint such as Notion's), to the
 *   source's own host and nowhere else.
 * - **The token is a header, nothing more.** It is handed in by the caller,
 *   who read it from the environment; this module never logs it, and an error
 *   it raises names the status and the path, never a header.
 * - **Every request is bounded**: a deadline per request (`withFetchTimeout`,
 *   which aborts), transient transport failures and `5xx` retried on
 *   `egressRetrySchedule`, and a `429` waited out — `Retry-After` when the
 *   source sends one, the source's documented lockout otherwise — then retried,
 *   unless the source's `429` is a spent daily quota, which stops the fetch.
 * - **One override, loopback only.** `SOVRIUM_IMPORT_FETCH_BASE_URL` sends
 *   every request to `<override>/<tool><path>` instead of the vendor host — the
 *   seam the E2E fake vendor server uses. Because the override receives the
 *   operator's token, it is honoured for a loopback origin and refused for any
 *   other.
 * - **Attachments** are downloaded by `import-fetch-download.ts`.
 */

import { Data, Duration, Effect } from 'effect'
import { egressRetrySchedule } from './egress-retry'
import { withFetchTimeout } from './with-fetch-timeout'

/** The variable that points every fetch at a local fake vendor server. */
export const IMPORT_FETCH_BASE_URL_ENV = 'SOVRIUM_IMPORT_FETCH_BASE_URL'

/** A fetch failure; its message names a status and a path, never a credential. */
export class ImportFetchError extends Data.TaggedError('ImportFetchError')<{
  readonly message: string
  /** True when a later run may succeed where this one stopped (a transient failure). */
  readonly resumable: boolean
  /** The HTTP status the source answered, when the failure is one. */
  readonly status?: number
}> {}

/** How one source is reached. */
export interface ImportFetchTarget {
  /** The tool's segment under the override (`airtable`). */
  readonly tool: string
  /** The vendor's own base URL (`https://api.airtable.com`). */
  readonly realBaseUrl: string
  /** The headers every request carries — the credential among them. */
  readonly headers: Readonly<Record<string, string>>
  /** The wait after a `429` that names none, in seconds (Airtable locks a base for 30). */
  readonly lockoutSeconds: number
  /**
   * The least time between two requests, for a source that states its rate
   * limit (Webflow's 60 a minute, Zite's 30 a second), so a fetch stays under it
   * instead of collecting `429`s.
   */
  readonly minIntervalMs?: number
  /**
   * For a source whose `429` means a DAILY quota is spent (Jotform's resets at
   * midnight Eastern time), the message the fetch stops with: waiting it out
   * would hold the command for hours, so it is never retried. A later run
   * resumes from the snapshot.
   */
  readonly quotaExhausted?: string
}

/** One JSON response. */
export interface ImportFetchResponse {
  readonly json: unknown
  readonly bytes: Uint8Array
}

const REQUEST_TIMEOUT_MS = 60_000
const MAX_RATE_LIMIT_WAITS = 6
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/**
 * The origin requests go to: the override when one is set (loopback only),
 * the vendor's base URL otherwise. `undefined` with a reason refuses the run.
 */
export const resolveImportBase = (
  target: Pick<ImportFetchTarget, 'tool' | 'realBaseUrl'>,
  override: string | undefined
):
  | { readonly ok: true; readonly base: string }
  | { readonly ok: false; readonly reason: string } => {
  if (override === undefined || override === '') return { ok: true, base: target.realBaseUrl }
  const url = URL.canParse(override) ? new URL(override) : undefined
  if (url === undefined || url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      reason: `${IMPORT_FETCH_BASE_URL_ENV} must name a loopback http origin (it receives your token); it is ignored for anything else.`,
    }
  }
  return { ok: true, base: `${url.origin}/${target.tool}` }
}

/** Seconds a `429` asks to wait. */
const retryAfterOf = (response: Response, fallback: number): number => {
  const header = Number(response.headers.get('retry-after'))
  return Number.isFinite(header) && header > 0 ? header : fallback
}

class Transient extends Data.TaggedError('Transient')<{ readonly message: string }> {}

const pathOf = (url: string): string => new URL(url).pathname

/** One request, retried on transient failures; a `429` is returned to the caller. */
const attempt = (url: string, init: RequestInit) =>
  Effect.tryPromise({
    try: () => withFetchTimeout(url, init, REQUEST_TIMEOUT_MS),
    catch: () => new Transient({ message: `no answer from ${pathOf(url)}` }),
  }).pipe(
    Effect.filterOrFail(
      (response) => response.status < 500,
      (response) => new Transient({ message: `${String(response.status)} on ${pathOf(url)}` })
    ),
    Effect.retry({ schedule: egressRetrySchedule({ attempts: 4, maxDelayMs: 10_000 }) })
  )

/** One request to a source. */
interface SourceRequest {
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly query?: Readonly<Record<string, string>>
  readonly body?: unknown
}

const fetchError = (message: string, resumable: boolean, status?: number) =>
  new ImportFetchError({ message, resumable, ...(status === undefined ? {} : { status }) })

const initOf = (target: ImportFetchTarget, request: SourceRequest): RequestInit => ({
  method: request.method,
  headers: {
    ...target.headers,
    accept: 'application/json',
    ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
  },
  ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
})

/** When each paced target may send next, as an epoch millisecond. */
const nextSendAt = new WeakMap<ImportFetchTarget, number>()

/** Wait until the target's pace lets the next request go, and book the slot after it. */
const pace = (target: ImportFetchTarget): Effect.Effect<void> =>
  target.minIntervalMs === undefined
    ? Effect.void
    : Effect.suspend(() => {
        const now = Date.now()
        const slot = Math.max(now, nextSendAt.get(target) ?? now)
        nextSendAt.set(target, slot + (target.minIntervalMs ?? 0))
        return slot > now ? Effect.sleep(Duration.millis(slot - now)) : Effect.void
      })

/** Send, and wait out each `429` — `Retry-After`, or the source's lockout — up to a bound. */
const sendWaitingOutRateLimits = (
  target: ImportFetchTarget,
  url: string,
  request: SourceRequest
): Effect.Effect<Response, ImportFetchError> => {
  const init = initOf(target, request)
  const loop = (waits: number): Effect.Effect<Response, Transient | ImportFetchError> =>
    pace(target).pipe(
      Effect.flatMap(() => attempt(url, init)),
      Effect.flatMap((response) => {
        if (response.status !== 429) return Effect.succeed(response)
        if (target.quotaExhausted !== undefined) {
          return Effect.fail(fetchError(target.quotaExhausted, true))
        }
        if (waits >= MAX_RATE_LIMIT_WAITS) {
          return Effect.fail(fetchError(`still rate-limited on ${request.path}`, true))
        }
        const seconds = retryAfterOf(response, target.lockoutSeconds)
        return Effect.sleep(Duration.seconds(seconds)).pipe(Effect.flatMap(() => loop(waits + 1)))
      })
    )
  return loop(0).pipe(
    Effect.mapError((error) =>
      error._tag === 'Transient' ? fetchError(error.message, true) : error
    )
  )
}

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null ? (value as Readonly<Record<string, unknown>>) : {}

/**
 * The vendor's own error code, ` (NOT_FOUND)`, when an error body names one —
 * `{ error: { code } }` (Zite) or `{ code }` (Webflow) — and nothing otherwise.
 * Only the code is kept: a message may echo what the request carried.
 */
const errorCodeOf = (bytes: Uint8Array): string => {
  const parsed = (() => {
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      // A body that is not JSON names no code; the status alone is reported.
      return undefined
    }
  })()
  const code = recordOf(recordOf(parsed)['error'])['code'] ?? recordOf(parsed)['code']
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? ` (${code})` : ''
}

/** The body as JSON, or the status as a refusal. */
const readJson = (
  response: Response,
  path: string
): Effect.Effect<ImportFetchResponse, ImportFetchError> =>
  Effect.tryPromise({
    try: async () => new Uint8Array(await response.arrayBuffer()),
    catch: () => fetchError(`the answer from ${path} was cut off`, true),
  }).pipe(
    Effect.flatMap((bytes) => {
      const { status } = response
      const code = status >= 400 ? errorCodeOf(bytes) : ''
      if (status === 401 || status === 403) {
        return Effect.fail(
          fetchError(`${String(status)} on ${path}${code}: the token was refused`, false, status)
        )
      }
      if (status >= 400)
        return Effect.fail(fetchError(`${String(status)} on ${path}${code}`, false, status))
      return Effect.try({
        try: () => ({ json: JSON.parse(new TextDecoder().decode(bytes)) as unknown, bytes }),
        catch: () => fetchError(`${path} did not answer JSON`, false),
      })
    })
  )

/** A JSON request against the source, with rate limits waited out. */
export const fetchSourceJson = (
  target: ImportFetchTarget,
  base: string,
  request: SourceRequest
): Effect.Effect<ImportFetchResponse, ImportFetchError> => {
  const url = new URL(`${base}${request.path}`)
  Object.entries(request.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value))
  return sendWaitingOutRateLimits(target, url.toString(), request).pipe(
    Effect.flatMap((response) => readJson(response, request.path)),
    Effect.withSpan('import.fetch-source-json', {
      attributes: { tool: target.tool, path: request.path },
    })
  )
}
