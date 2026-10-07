/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dispatch as dispatchIslandEvent } from './event-bus'
import { substituteResponse, substituteRecordInBody } from './fetch-action-substitution'
import { refreshServerRenderedRegions } from './refetch-server-rendered-region'
import type {
  FetchAction,
  FetchResponseEnvelope,
} from '@/domain/models/app/pages/components/action'

/**
 * What a fetch action does around its request: the request it builds, how
 * its response envelope is judged, and the success effects (toast, refresh,
 * redirect, events) a successful one applies.
 */

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

/** Render the action's success/error toast slot when one is configured + a renderer is injected. */
export function renderActionToast(slot: ToastSlot, options: ExecuteFetchActionOptions): void {
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
 *  - `refetch`: re-read each named `props.id` so a sibling data-bound component
 *    (a DB-table `dataSource` OR a `dataSource.system` read endpoint) reflects the
 *    mutation — a freshly-created row appears without a reload. Two shapes, two
 *    routes, because they hold their rows in different places: a component that
 *    fetches its own rows is told to re-query by a `sovrium:refetch` event, while
 *    one the SERVER rendered in full has no client to tell, and is re-read by
 *    `refreshServerRenderedRegions`. Naming either kind behaves the same from the
 *    config's point of view, which is what the schema promises.
 *  - `reload`: re-request the WHOLE document so the SERVER recomposes it — the
 *    one effect `refetch` cannot express, because a refetch re-queries ONE named
 *    region and `refreshServerRenderedRegions` skips any region holding a
 *    mounted island. A value the server read before composing a byte (the page's
 *    own language, the operator's name in the chrome) is therefore unreachable
 *    from the page that changes it: the write lands, the toast says so, and the
 *    page keeps showing what it was composed with.
 *
 * `reload` lives HERE rather than in any one caller because this function is the
 * single point all three write paths reach — the `fetch` action, the
 * endpoint-bound form, and the `file-upload` island's multipart submission — and
 * because it is only ever reached on SUCCESS. An implementation reading the key
 * off the config object instead would recompose after a FAILED request too, and
 * throw away the error the operator has to act on.
 *
 * The success TOAST is not suppressed and is not displayed either: the reload
 * replaces the document it would have been written into, which is exactly what
 * the key's own `description` states. Decode refuses `status` and `refetch`
 * beside `reload`, so the two writes above cannot be racing it.
 *
 * Both are no-ops when the matching slot is absent, so every existing toast-only
 * `onSuccess` is unchanged. The DOM write uses `setAttribute` / `replaceChildren`
 * (method calls) rather than property assignment, matching this module's
 * `functional/immutable-data` discipline.
 *
 * `body` is the JSON body the action's own request returned, and is what any
 * `$response.<field>` reference in `status.message` is resolved against. It is
 * OPTIONAL because two of the three callers legitimately have none: a
 * `mode: download` reads a Blob, and the `file-upload` island's multipart
 * submission never parses one — there, every `$response.` reference resolves to
 * the empty string by construction, which is exactly what the schema documents.
 *
 * The interpolated string is computed ONCE and used for BOTH the `aria-label`
 * and the text write: interpolating only the text node would leave a screen
 * reader announcing the raw token.
 *
 * Exported so a non-`fetch` runtime that produces its own 2xx (the `file-upload`
 * island's multipart submission) can run the SAME success effects without
 * re-implementing the status-region promotion + sibling-refetch dispatch.
 */
export function applyFetchSuccessEffects(
  onSuccess: FetchAction['onSuccess'],
  body?: unknown
): void {
  if (!onSuccess) return
  const { status } = onSuccess
  if (status && typeof document !== 'undefined') {
    const target = document.getElementById(status.target)
    if (target) {
      const message = substituteResponse(status.message, body)
      target.setAttribute('role', 'status')
      target.setAttribute('aria-label', message)
      // `replaceChildren(<string>)` creates a TEXT node, so a body field holding
      // `<b>x</b>` shows those characters rather than being parsed as markup.
      // This is deliberately NOT an `innerHTML` write, so no second sanitiser is
      // introduced (standing rule S2).
      target.replaceChildren(message)
    }
  }
  const { refetch } = onSuccess
  if (refetch) {
    const ids = typeof refetch === 'string' ? [refetch] : refetch
    ids.forEach((id) => dispatchIslandEvent('sovrium:refetch', { id }))
    // The event reaches a component that fetches its own rows. A component the
    // SERVER rendered in full subscribes to nothing, so it is re-read by the
    // action that named it instead — see `refetch-server-rendered-region.ts`.
    // Not awaited: this function's contract is synchronous, and every caller
    // treats the success effects as fire-and-forget.
    void refreshServerRenderedRegions(ids)
  }
  if (onSuccess.reload === true && typeof window !== 'undefined') window.location.reload()
}

/**
 * Build the `fetch` init for the action — credentialed, JSON body when present.
 * The body's string values are resolved against the injected `record` so a
 * row-bound mutate carries the clicked row's identity (`{ userId: '$record.id' }`).
 */
export function buildRequestInit(
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
export function emptyBody(): undefined {
  return undefined
}
