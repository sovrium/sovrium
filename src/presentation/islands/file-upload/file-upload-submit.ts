/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * File-upload submission runtime.
 *
 * Wires the `file-upload` island's picked file(s) to its configured
 * `uploadAction`: a credentialed `multipart/form-data` POST (form part name
 * `file`, the same contract the crud-form file-field + the bucket upload
 * endpoint speak). On the 2xx response it answers as a `fetch` button does, in
 * the one order (`action-outcome.ts`): the `onSuccess` toast, then the SAME
 * `applyFetchSuccessEffects` a `fetch` action's `onSuccess` uses (persistent
 * `role="status"` badge + sibling `refetch`), `close`, then `navigate` — the
 * answer's JSON body filling `$response.<field>` in the status message and the
 * navigate (a body that is not JSON fills them empty). So a config page can
 * compose `file-upload` + a sibling file `table` into a self-refreshing
 * browse-and-upload surface. On a non-2xx response (a rejected MIME type, an
 * oversized file, a storage failure) it dispatches the configured `onError`
 * toast through the same toast path the action-executor injects.
 *
 * No new effects/toast mechanism is introduced — `applyFetchSuccessEffects`
 * (action-executor) and `renderToast` (the shipped island toast) are reused.
 */

import { runSuccessOutcome } from '../runtime/action-outcome'
import {
  applyFetchSuccessEffects,
  fetchSuccessNavigate,
  renderActionToast,
} from '../runtime/fetch-action-effects'
import { renderToast } from '../runtime/toast'
import type { ToastRetry } from '../runtime/toast-accessibility'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

export interface UploadSubmitConfig {
  /** The resolved upload destination URL (the bucket files endpoint). */
  readonly url: string
  /** Success effects (status badge + sibling refetch) run on a 2xx response. */
  readonly onSuccess?: FetchSuccessResponse
  /** Failure toast dispatched on a non-2xx response or a network error. */
  readonly onError?: FetchToastResponse
  /** The control the files were picked from: the overlay it sits in is the one `close` closes. */
  readonly origin?: Element
  /**
   * A Retry on the failure toast, sending the same files again — set by a
   * compact upload, whose toast is the only place its failure is drawn. The
   * config is handed to the toast as its controls, so it is read there.
   */
  readonly retry?: ToastRetry | undefined
}

/**
 * Render the configured failure toast (a no-op when none is configured), its
 * `{file}` naming the file(s) that did not go up — on a page of many uploads,
 * "an upload failed" leaves the reader to guess which.
 */
function renderUploadError(files: readonly File[], config: UploadSubmitConfig): void {
  const { onError } = config
  const names = files.map((file) => file.name).join(', ')
  if (onError)
    renderToast(onError.message.replaceAll('{file}', names), onError.variant, undefined, config)
}

/**
 * POST the picked file(s) to `url` as `multipart/form-data` and apply the
 * configured success effects / error toast. Returns `true` on a 2xx response.
 *
 * The `FormData` body is sent WITHOUT an explicit `Content-Type` header so the
 * browser sets `multipart/form-data` plus the part boundary itself; the request
 * is credentialed so it also reaches session-bound buckets.
 */
export async function submitUpload(
  files: readonly File[],
  config: UploadSubmitConfig
): Promise<boolean> {
  const body = new FormData()
  files.forEach((file) => body.append('file', file))
  try {
    const res = await fetch(config.url, { method: 'POST', body, credentials: 'include' })
    if (res.ok) {
      const answer: unknown = await res.json().catch(() => undefined)
      const { onSuccess } = config
      runSuccessOutcome(config.origin, {
        toast: () => renderActionToast(onSuccess, { renderToast }),
        effects: () => applyFetchSuccessEffects(onSuccess, answer),
        close: onSuccess?.close,
        navigate: fetchSuccessNavigate(onSuccess, answer),
      })
      return true
    }
    // Without a configured onError this branch is otherwise invisible (no
    // toast, no refetch, nothing paints) — log it so console capture in
    // traces records WHICH leg failed instead of leaving a silently stale UI.
    console.warn('[file-upload] upload rejected:', res.status, config.url)
  } catch (err) {
    console.warn('[file-upload] upload failed:', config.url, err)
  }
  renderUploadError(files, config)
  return false
}
