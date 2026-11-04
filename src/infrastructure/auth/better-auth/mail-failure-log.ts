/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactEmail, redactEmailAddresses } from '@/domain/kernel/sanitize/email-redaction'
import { logError } from '../../logging'

/** How deep a cause chain is copied; the log renders five links at most anyway. */
const MAX_SCRUBBED_DEPTH = 10

/**
 * The transport's failure with every address in its text masked, link by link
 * down the cause chain, so the cause still reaches the log — its name, its
 * status codes, its stack frames — without the recipient it names. A mail
 * transport writes the address it refused into its own message
 * (`550 5.1.1 <ada@example.com>: Recipient address rejected`), and the log
 * prints that message, the stack that repeats it, and every cause beneath it.
 */
const scrubMailError = (error: unknown, depth = 0): unknown => {
  if (typeof error === 'string') return redactEmailAddresses(error)
  if (!(error instanceof Error)) return error
  const copy = new Error(redactEmailAddresses(error.message))
  copy.name = error.name
  copy.stack = error.stack === undefined ? undefined : redactEmailAddresses(error.stack)
  const { cause } = error as { readonly cause?: unknown }
  if (cause !== undefined && cause !== error && depth < MAX_SCRUBBED_DEPTH)
    copy.cause = scrubMailError(cause, depth + 1)
  return copy
}

/**
 * The line an auth email that could not be sent leaves in the journal. The
 * recipient is masked (`ada@example.com` → `a•••@example.com`): enough to tell
 * which account's mail failed and to group repeated failures, never the
 * address itself, which a log reader and every log sink have no business with.
 * The transport's own error is logged as the cause with the same masking
 * applied to every address in its text.
 *
 * @param what - What was being sent, e.g. `welcome email`
 * @param to - The recipient address, masked before it is written
 * @param error - The transport's failure, logged as the cause, addresses masked
 */
export const logMailFailure = (what: string, to: string, error: unknown): void =>
  logError(`[EMAIL] Failed to send ${what} to ${redactEmail(to)}`, scrubMailError(error))
