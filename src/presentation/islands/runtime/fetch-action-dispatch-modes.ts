/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderActionToast, applyFetchSuccessEffects } from './fetch-action-effects'
import { substituteRecord } from './fetch-action-substitution'
import { followAddress } from './follow-address'
import { saveBlob } from './save-blob'
import type { FetchActionResult, ExecuteFetchActionOptions } from './fetch-action-effects'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/**
 * The fetch action's two non-request dispatch modes: navigate to a URL, and
 * download a response as a file.
 */

/**
 * `address` with the current params of the channel `action` reads (`bindTo`)
 * merged into its query (`channelAddress`). The channel module is loaded only
 * by a button that reads one, so every other page keeps it out of its payload.
 */
async function withChannelParams(address: string, action: FetchAction): Promise<string> {
  const { channelAddress } = await import('./shared-filter-channel')
  return channelAddress(address, action.bindTo ?? '', action.sharedFilter?.params)
}

/** A successful browser-driven dispatch (navigate) — no HTTP envelope. */
const DISPATCHED: FetchActionResult = { ok: true, status: 0, body: undefined }

/**
 * Drive the browser to the action's `url` (CSV export, server-driven redirect),
 * in a new tab when `openInNewTab` asks for one — only once the substituted
 * address passes the canonical safe-address check.
 */
export function performNavigate(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): FetchActionResult | Promise<FetchActionResult> {
  const address = substituteRecord(action.url, options.record)
  return action.bindTo === undefined
    ? navigateTo(address, action, options)
    : withChannelParams(address, action).then(
        (url) => navigateTo(url, action, options),
        () => refuseNavigation(action, options)
      )
}

/** Follow `url`, or report the refusal of an address that is not a web address. */
function navigateTo(
  url: string,
  action: FetchAction,
  options: ExecuteFetchActionOptions
): FetchActionResult {
  if (followAddress(url, { openInNewTab: action.openInNewTab })) return DISPATCHED
  // Not a web address (a row storing `javascript:…`): nothing is followed, and
  // the action reports the refusal the way a failed request does.
  return refuseNavigation(action, options)
}

/** Nothing was followed: said the way a failed request is. */
function refuseNavigation(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): FetchActionResult {
  renderActionToast(action.onError, options)
  return { ok: false, status: 0, body: undefined }
}

/**
 * Download the action's `url` as a native file. A real credentialed `fetch`
 * issues the page-level GET (so the request is observable — a bare `<a download>`
 * routes through the browser's download manager and bypasses the page network),
 * then the response Blob is saved through a `download`-attributed anchor named by
 * `filename`. The credentialed fetch also reaches session-bound endpoints (the
 * GDPR archive) the same way the public buckets API is reached.
 */
export async function performDownload(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const address = substituteRecord(action.url, options.record)
  const filename = action.filename ? substituteRecord(action.filename, options.record) : ''
  const again = () => void performDownload(action, options)
  try {
    const url = action.bindTo === undefined ? address : await withChannelParams(address, action)
    const res = await fetch(url, { method: 'GET', credentials: 'include' })
    if (!res.ok) {
      // A refused download is said, like a refused fetch: without this the
      // button came back and nothing on the page told the reader it had failed.
      renderActionToast(action.onError, options, again)
      return { ok: false, status: res.status, body: undefined }
    }
    saveBlob(await res.blob(), filename)
    // Compose the same `onSuccess` CLIENT-STATE effects as the default `fetch`
    // mode (status badge + refetch) once the archive download has dispatched, so
    // a `mode: download` action can both download the file AND, e.g., promote a
    // persistent "Export généré" status. A no-op when no `onSuccess` is set.
    // No body is passed because this path read a Blob, not JSON — so any
    // `$response.<field>` in the status message resolves empty by construction,
    // which is what the schema documents for this mode.
    applyFetchSuccessEffects(action.onSuccess)
    return { ok: true, status: res.status, body: undefined }
  } catch {
    renderActionToast(action.onError, options, again)
    return { ok: false, status: 0, body: undefined }
  }
}
