/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToast } from './toast'

/**
 * What a page says when a record write it sent was refused because the
 * reader's writes were too many (429): a toast naming the seconds to wait,
 * read from `Retry-After`, in the page's language — and nothing else changes.
 * The rows, the selection and the buttons stay as they were, so the reader
 * retries the same gesture once the wait is over.
 *
 * Every write a page sends from a script reads its answer through
 * {@link toastWriteRefusal}: the grid's bulk bar and row actions, a delete
 * button, a dialog's confirmed delete.
 */

/**
 * The English words. The page-language text comes from the server catalogue
 * (`rateLimit.retryIn`) through the host island's resolved strings.
 */
const RETRY_IN = 'Too many requests, retry in {seconds} s.'

/** The English words of any other failure (`form.operationFailed` in the catalogue). */
const FAILED = 'Operation failed'

/** The seconds a refusal asks to wait: its `Retry-After`, at least one. */
const retryAfterOf = (response: Response): number => {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 1
}

/**
 * When `response` refused a write because the writes were too many, say so in
 * a toast and answer `true`; any other answer is left to the caller.
 */
export function toastWriteRefusal(
  response: Response,
  strings?: Readonly<Record<string, string>> | undefined
): boolean {
  if (response.status !== 429) return false
  const words = strings?.['rateLimit.retryIn'] ?? RETRY_IN
  renderToast(words.replace('{seconds}', String(retryAfterOf(response))), 'warning')
  return true
}

/**
 * Say, once, that a record write the page sent failed for any other reason —
 * a server error, a refusal, a lost connection. The write is never sent again:
 * the reader decides whether to repeat the gesture.
 */
export function toastWriteFailure(strings?: Readonly<Record<string, string>> | undefined): void {
  renderToast(strings?.['form.operationFailed'] ?? FAILED, 'error')
}

/** One entry of a refused write's `errors`: the field it names and the words for it. */
interface FieldErrorEntry {
  readonly field?: unknown
  readonly message?: unknown
}

/**
 * The per-field messages of a write the records API refused with `400` / `422`
 * — `{ errors: [{ field, message }] }` — keyed by field, or `undefined` when the
 * refusal names no field. Read only from a 4xx body: a 5xx body is never shown.
 */
export function readFieldErrors(body: unknown): Readonly<Record<string, string>> | undefined {
  const errors = (body as { readonly errors?: unknown } | null | undefined)?.errors
  if (!Array.isArray(errors)) return undefined
  const entries = (errors as readonly FieldErrorEntry[]).flatMap((entry) =>
    typeof entry?.field === 'string' && typeof entry.message === 'string'
      ? [[entry.field, entry.message] as const]
      : []
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
