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
 *
 * `$record.` runs one way — values INTO the request. The return leg is
 * `$response.<dot.path>`, resolved in an `onSuccess.status.message` against the
 * JSON body that action's own request came back with, so a value only the SERVER
 * could produce can be shown once, where the operator is looking. It is the one
 * slot here that READS a response rather than writing to a request.
 */

import { performNavigate, performDownload } from './fetch-action-dispatch-modes'
import {
  evaluateFetchEnvelope,
  renderActionToast,
  applyFetchSuccessEffects,
  buildRequestInit,
  emptyBody,
} from './fetch-action-effects'
import { substituteRecord } from './fetch-action-substitution'
import type { FetchActionResult, ExecuteFetchActionOptions } from './fetch-action-effects'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * Fallback confirm copy when `confirm` is set without a `confirmMessage`.
 *
 * ENGLISH on purpose, and it must stay equal to the `en` entry of
 * `confirmGate.message` in `domain/utils/translation-resolver.ts` — the same
 * invariant `CONFIRM_AFFIRM_LABEL_FALLBACK` documents in
 * `domain/utils/confirm-gate-labels.ts`. This was hard-coded French while the
 * gate's Confirm/Cancel buttons around it resolved to English, so an app of any
 * language got a French question above two English buttons: the exact
 * two-disagreeing-fallback-chains bug that helper exists to prevent, fixed for
 * the buttons but never for the prompt.
 */
const DEFAULT_CONFIRM_MESSAGE = 'Confirm this action?'

/** Confirm gate used outside a DOM (SSR / tests) — always proceeds. */
const ALWAYS_CONFIRM = (): boolean => true

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
    // The parsed body travels the one hop into the success effects so a
    // `status.message` can quote a `$response.<field>` of what came back.
    if (ok) applyFetchSuccessEffects(action.onSuccess, body)
    return { ok, status: res.status, body }
  } catch {
    renderActionToast(action.onError, options)
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
