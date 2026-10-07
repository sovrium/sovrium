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
): FetchActionResult {
  const url = substituteRecord(action.url, options.record)
  if (followAddress(url, { openInNewTab: action.openInNewTab })) return DISPATCHED
  // Not a web address (a row storing `javascript:…`): nothing is followed, and
  // the action reports the refusal the way a failed request does.
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
    // No body is passed because this path read a Blob, not JSON — so any
    // `$response.<field>` in the status message resolves empty by construction,
    // which is what the schema documents for this mode.
    applyFetchSuccessEffects(action.onSuccess)
    return { ok: true, status: res.status, body: undefined }
  } catch {
    return { ok: false, status: 0, body: undefined }
  }
}
