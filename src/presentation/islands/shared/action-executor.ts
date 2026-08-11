/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared client-side action executor (Consoles-as-Config CAP-3 — 3a core path).
 *
 * The one place an island dispatches a config `type: 'fetch'` action. Built as a
 * reusable seam so the data-table row-action column, the record-drawer / detail
 * buttons, bulk actions, AND the dashboard's bespoke operate gestures (GDPR
 * erase / cancel, …) all speak the SAME operate contract instead of each
 * re-implementing a credentialed fetch + envelope read.
 *
 * Core-mutate behaviour (the `fetch` mode, default):
 *  - optional `confirm`/`confirmMessage` gate — abort the operation when declined;
 *  - `fetch(url, { method, credentials: 'include', body })` to the action's
 *    ARBITRARY target path (unrestricted — `/api/admin/*`, the Better-Auth
 *    `/api/auth/admin/*` plugin, the public `/api/buckets/*`, …);
 *  - decide success/error per `responseEnvelope` (non-Sovrium body tolerance);
 *  - render the matching `onSuccess` / `onError` toast (injected, so this module
 *    stays decoupled from any one island's toast helper);
 *  - return `{ ok, status, body }` so a caller that needs the response (e.g. the
 *    GDPR erase, which reads `scheduledErasureAt`) can build state from it.
 *
 * The credentialed-fetch + envelope discipline mirrors
 * `../hooks/use-system-source-fetch.ts` (CAP-1/CAP-2 read path) on the WRITE side.
 *
 * Beyond the default `fetch`, three browser-driven modes are handled (CAP-3b):
 *  - `navigate`: drive the browser to `url` (`window.location.assign`) — for a
 *    server response that paints the browser directly (a CSV export at
 *    `?format=csv` returned with `Content-Disposition`). No fetch, no toast.
 *  - `download`: trigger a native file download of `url` (an `<a download>` click,
 *    named by `filename`) — for a binary object such as a bucket file or the GDPR
 *    archive. No fetch, no toast.
 *  - `oauth`: a fetch-THEN-redirect round-trip (distinct from `navigate`, which
 *    goes STRAIGHT to a static `url`): credentialed-fetch the authorize `url` (a
 *    server endpoint that returns the provider consent URL as DATA in its JSON
 *    body), read the destination from the body at `redirectKey` (default `url`),
 *    and `window.location.assign` it so the provider's consent flow begins — for
 *    a connection `authorize`. `callbackPath` is the provider's registered
 *    redirect_uri (config metadata) with no client navigation of its own.
 *
 * ALL modes resolve `$record.<field>` references in the target `url` (and, for
 * `download`, in `filename`) against an injected `record` context, so a row-bound
 * action (a data-table actions column over `…/files/$record.key`) targets the
 * clicked row's object. The default `fetch` mode additionally resolves the SAME
 * `$record.<field>` references in each string value of the JSON `body`, so a
 * confirm-gated row mutate (the directory's ban / set-role POST
 * `{ userId: '$record.id', role: '$record.role' }`) carries the clicked row's
 * identity into the request payload as well as the url. When an action's url
 * holds no `$record.` reference the url pass is a no-op, so sharing it across
 * every mode leaves those actions unchanged.
 */

import { dispatch as dispatchIslandEvent } from '../_shared/event-bus'
import type {
  FetchAction,
  FetchResponseEnvelope,
} from '@/domain/models/app/pages/components/action'

/** The outcome of a dispatched fetch action. */
export interface FetchActionResult {
  /** Whether the response is a success under the action's `responseEnvelope`. */
  readonly ok: boolean
  /** The HTTP status (`0` when the request never reached the server). */
  readonly status: number
  /** The parsed JSON response body, or `undefined` when there was none. */
  readonly body: unknown
}

/** Injected capabilities so this shared module stays decoupled from any island. */
export interface ExecuteFetchActionOptions {
  /**
   * Confirm gate used when `action.confirm` is set. Defaults to `window.confirm`.
   * Return `false` to abort the operation (no request is sent).
   */
  readonly confirm?: (message: string) => boolean
  /**
   * Toast renderer for the action's `onSuccess` / `onError` slots.
   *
   * Stays INJECTED, and stays OPTIONAL, even though the shared renderer now
   * lives alongside this module at `./toast` and could simply be imported. The
   * original reason (keeping `islands/shared/` off a feature island's toast) is
   * indeed gone — but omitting it is load-bearing in its own right: `client.ts`
   * passes no renderer at its fetch-button and endpoint-form call sites
   * precisely so this module stays silent, then renders its own RICHER toast
   * from the returned `{ ok }` — one that honours `duration` / `actionLabel` /
   * `actionUrl`, all of which a bare `renderToast(message, variant)` drops.
   * Defaulting this to the shared renderer would emit a second, plainer toast
   * beside that rich one on both paths.
   */
  readonly renderToast?: (message: string, variant?: string) => void
  /**
   * Row / detail record context for `$record.<field>` substitution in the
   * `navigate` / `download` target `url` (and the `download` `filename`). Supplied
   * by row-bound callers (a data-table actions column) so a per-record action
   * targets the clicked row's object. Absent for non-row gestures.
   */
  readonly record?: Record<string, unknown>
}

/** Fallback confirm copy when `confirm` is set without a `confirmMessage`. */
const DEFAULT_CONFIRM_MESSAGE = 'Confirmer cette action ?'

/** Confirm gate used outside a DOM (SSR / tests) — always proceeds. */
const ALWAYS_CONFIRM = (): boolean => true

/** A toast slot (the action's `onSuccess` / `onError`), possibly absent. */
type ToastSlot = FetchAction['onSuccess']

/** A response body is "errored" under the Better-Auth envelope when its `error` is truthy. */
function bodyHasError(body: unknown): boolean {
  if (typeof body !== 'object' || !body) return false
  return Boolean((body as { readonly error?: unknown }).error)
}

/**
 * Decide success from the HTTP status + parsed body under the chosen envelope:
 *  - `sovrium` (default) / `raw`: success = any 2xx;
 *  - `better-auth`: the target is always-200 + enumeration-safe, so success is a
 *    2xx WITHOUT an `error` field in the body (a silent error is still a non-2xx
 *    OR an `{ error }` body).
 */
export function evaluateFetchEnvelope(
  envelope: FetchResponseEnvelope,
  status: number,
  body: unknown
): boolean {
  const is2xx = status >= 200 && status < 300
  if (envelope === 'better-auth') return is2xx && !bodyHasError(body)
  return is2xx
}

/** The default confirm gate (`window.confirm`); always confirms outside a DOM. */
function resolveConfirm(options: ExecuteFetchActionOptions): (message: string) => boolean {
  if (options.confirm) return options.confirm
  if (typeof window !== 'undefined') return window.confirm.bind(window)
  return ALWAYS_CONFIRM
}

/** Whether the action clears its `confirm` gate (no gate, or the gate confirmed). */
function passesConfirmGate(action: FetchAction, options: ExecuteFetchActionOptions): boolean {
  if (!action.confirm) return true
  return resolveConfirm(options)(action.confirmMessage ?? DEFAULT_CONFIRM_MESSAGE)
}

/** Render the action's success/error toast slot when one is configured + a renderer is injected. */
function renderActionToast(slot: ToastSlot, options: ExecuteFetchActionOptions): void {
  if (slot && options.renderToast) options.renderToast(slot.message, slot.variant)
}

/**
 * Apply a fetch action's `onSuccess` CLIENT-STATE effects after a successful
 * mutate (additive to the transient toast):
 *  - `status`: write a PERSISTENT inline message into the sibling element named
 *    by `status.target` (its `props.id`) and promote it to a `role="status"`
 *    live region — the "Export généré" badge that confirms completion and STAYS
 *    on screen. `aria-label` carries the message so the region's accessible name
 *    resolves regardless of the `status` role's name-from-content rule.
 *  - `refetch`: dispatch a `sovrium:refetch` event for each named `props.id` so a
 *    sibling data-bound component (a DB-table `dataSource` OR a `dataSource.system`
 *    read endpoint) re-queries — a freshly-created row appears without a reload.
 *
 * Both are no-ops when the matching slot is absent, so every existing toast-only
 * `onSuccess` is unchanged. The DOM write uses `setAttribute` / `replaceChildren`
 * (method calls) rather than property assignment, matching this module's
 * `functional/immutable-data` discipline.
 *
 * Exported so a non-`fetch` runtime that produces its own 2xx (the `file-upload`
 * island's multipart submission) can run the SAME success effects without
 * re-implementing the status-region promotion + sibling-refetch dispatch.
 */
export function applyFetchSuccessEffects(onSuccess: FetchAction['onSuccess']): void {
  if (!onSuccess) return
  const { status } = onSuccess
  if (status && typeof document !== 'undefined') {
    const target = document.getElementById(status.target)
    if (target) {
      target.setAttribute('role', 'status')
      target.setAttribute('aria-label', status.message)
      target.replaceChildren(status.message)
    }
  }
  const { refetch } = onSuccess
  if (refetch) {
    const ids = typeof refetch === 'string' ? [refetch] : refetch
    ids.forEach((id) => dispatchIslandEvent('sovrium:refetch', { id }))
  }
}

/**
 * Build the `fetch` init for the action — credentialed, JSON body when present.
 * The body's string values are resolved against the injected `record` so a
 * row-bound mutate carries the clicked row's identity (`{ userId: '$record.id' }`).
 */
function buildRequestInit(
  action: FetchAction,
  record: Record<string, unknown> | undefined
): RequestInit {
  const method = action.method ?? 'GET'
  const body = substituteRecordInBody(action.body, record)
  const hasBody = body !== undefined
  const headers = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(action.headers ?? {}),
  }
  return {
    method,
    credentials: 'include',
    headers,
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  }
}

/** Tolerate an empty / non-JSON body (e.g. a 204) — resolve to `undefined`. */
function emptyBody(): undefined {
  return undefined
}

/** Run the credentialed request, evaluate the envelope, and toast the outcome. */
async function performFetchAction(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const envelope = action.responseEnvelope ?? 'sovrium'
  // Resolve `$record.<field>` in the target url against the injected row record,
  // exactly as the `navigate` and `download` modes do, so every mode behaves the
  // same. When the url holds no `$record.` reference this is a no-op, so the
  // operate actions whose ids ride the body, or whose url is already built, are
  // left unchanged.
  const url = substituteRecord(action.url, options.record)
  try {
    const res = await fetch(url, buildRequestInit(action, options.record))
    const body = await res.json().catch(emptyBody)
    const ok = evaluateFetchEnvelope(envelope, res.status, body)
    renderActionToast(ok ? action.onSuccess : action.onError, options)
    if (ok) applyFetchSuccessEffects(action.onSuccess)
    return { ok, status: res.status, body }
  } catch {
    renderActionToast(action.onError, options)
    return { ok: false, status: 0, body: undefined }
  }
}

/** Matches a `$record.<field>` reference in a target `url` / `filename`. */
const RECORD_FIELD_PATTERN = /\$record\.(\w+)/g

/**
 * Substitute `$record.<field>` references in a target string (any mode's `url`,
 * plus the `download` `filename`) against the injected row record. A no-op when
 * no `record` is supplied or the template carries no reference, so static targets
 * pass through untouched.
 */
function substituteRecord(template: string, record: Record<string, unknown> | undefined): string {
  if (record === undefined || !template.includes('$record.')) return template
  return template.replaceAll(RECORD_FIELD_PATTERN, (_full, field: string) => {
    const cell = record[field]
    return cell === undefined ? '' : String(cell)
  })
}

/**
 * Resolve `$record.<field>` references in each STRING value of a JSON request
 * body against the injected row record — so a config mutate's body template
 * (`{ userId: '$record.id', role: '$record.role' }`) carries the clicked row's
 * identity into the payload. Non-string values pass through untouched, and the
 * whole body is returned unchanged when no `record` is supplied (the static-body
 * fetch path — GDPR erase / cancel — is unaffected).
 */
function substituteRecordInBody(
  body: FetchAction['body'],
  record: Record<string, unknown> | undefined
): FetchAction['body'] {
  if (body === undefined || record === undefined) return body
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecord(value, record) : value,
    ])
  )
}

/** A successful browser-driven dispatch (navigate) — no HTTP envelope. */
const DISPATCHED: FetchActionResult = { ok: true, status: 0, body: undefined }

/** Drive the browser to the action's `url` (CSV export, server-driven redirect). */
function performNavigate(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): FetchActionResult {
  const url = substituteRecord(action.url, options.record)
  if (typeof window !== 'undefined') window.location.assign(url)
  return DISPATCHED
}

/** Save a fetched `Blob` as a `download`-attributed anchor click (named by `filename`). */
function saveBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const objectUrl = URL.createObjectURL(blob)
  // `setAttribute` (a method call) configures the transient anchor without
  // tripping `functional/immutable-data`'s ban on property-assignment mutation.
  const anchor = document.createElement('a')
  anchor.setAttribute('href', objectUrl)
  anchor.setAttribute('download', filename)
  anchor.setAttribute('style', 'display:none')
  document.body.append(anchor)
  anchor.click()
  // Defer cleanup so the download task is dispatched before the object URL is
  // revoked and the anchor removed (the FileSaver-style deferred-cleanup pattern).
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
    anchor.remove()
  }, 0)
}

/**
 * Download the action's `url` as a native file. A real credentialed `fetch`
 * issues the page-level GET (so the request is observable — a bare `<a download>`
 * routes through the browser's download manager and bypasses the page network),
 * then the response Blob is saved through a `download`-attributed anchor named by
 * `filename`. The credentialed fetch also reaches session-bound endpoints (the
 * GDPR archive) the same way the public buckets API is reached.
 */
async function performDownload(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const url = substituteRecord(action.url, options.record)
  const filename = action.filename ? substituteRecord(action.filename, options.record) : ''
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'include' })
    if (!res.ok) return { ok: false, status: res.status, body: undefined }
    saveBlob(await res.blob(), filename)
    // Compose the same `onSuccess` CLIENT-STATE effects as the default `fetch`
    // mode (status badge + refetch) once the archive download has dispatched, so
    // a `mode: download` action can both download the file AND, e.g., promote a
    // persistent "Export généré" status. A no-op when no `onSuccess` is set.
    applyFetchSuccessEffects(action.onSuccess)
    return { ok: true, status: res.status, body: undefined }
  } catch {
    return { ok: false, status: 0, body: undefined }
  }
}

/** Default `redirectKey` — the authorize body field the consent URL is read from. */
const DEFAULT_REDIRECT_KEY = 'url'

/**
 * Read the OAuth redirect destination from the authorize response body at
 * `redirectKey` (default `'url'`). Returns `undefined` when the body is not an
 * object or the named field is absent / non-string.
 */
function readRedirectDestination(
  body: unknown,
  redirectKey: string | undefined
): string | undefined {
  if (typeof body !== 'object' || !body) return undefined
  const value = (body as Record<string, unknown>)[redirectKey ?? DEFAULT_REDIRECT_KEY]
  return typeof value === 'string' ? value : undefined
}

/**
 * Initiate an OAuth authorize round-trip — a fetch-THEN-redirect gesture,
 * distinct from `navigate` (which drives the browser STRAIGHT to a static
 * `url`). The client credentialed-fetches the authorize `url` (a server
 * endpoint that returns the provider consent URL as DATA in its JSON body),
 * reads that URL from the body at `redirectKey` (default `url`), then
 * `window.location.assign`es it so the provider's consent flow begins. The
 * action's `callbackPath` is the provider's registered redirect_uri (config
 * metadata only — no client navigation of its own). The url's `$record.<field>`
 * references are resolved against the injected row record exactly as every other
 * mode does, so a row-bound authorize targets the clicked row's record.
 */
async function performOauth(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const url = substituteRecord(action.url, options.record)
  try {
    const res = await fetch(url, buildRequestInit(action, options.record))
    const body = await res.json().catch(emptyBody)
    if (!res.ok) return { ok: false, status: res.status, body }
    const destination = readRedirectDestination(body, action.redirectKey)
    if (destination !== undefined && typeof window !== 'undefined') {
      window.location.assign(destination)
    }
    return { ok: destination !== undefined, status: res.status, body }
  } catch {
    return { ok: false, status: 0, body: undefined }
  }
}

/**
 * Dispatch a config `fetch` action. The default `fetch` mode runs the
 * credentialed core-mutate request; `navigate` / `download` / `oauth` drive the
 * browser directly (`oauth` fetches an authorize endpoint first, then redirects
 * to the URL it returns). Returns `undefined` only when the action is gated off
 * by a declined confirm.
 */
export async function executeFetchAction(
  action: FetchAction,
  options: ExecuteFetchActionOptions = {}
): Promise<FetchActionResult | undefined> {
  // Confirm gate (applies to every mode): abort silently when declined.
  if (!passesConfirmGate(action, options)) return undefined
  const mode = action.mode ?? 'fetch'
  if (mode === 'fetch') return performFetchAction(action, options)
  if (mode === 'navigate') return performNavigate(action, options)
  if (mode === 'download') return performDownload(action, options)
  if (mode === 'oauth') return performOauth(action, options)
  // Any future unhandled mode: no-op.
  return undefined
}
