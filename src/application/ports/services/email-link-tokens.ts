/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'

/** What an unsubscribe link names: the recipient, the category left, the message it came in. */
export interface UnsubscribeClaims {
  readonly address: string
  readonly category: string
  /** The message reference (`system.email_messages.id`). */
  readonly ref: string
}

/**
 * The tokens a bulk message's links carry, sealed by the server with a key
 * derived from the instance's root secret. An unsubscribe token names the
 * recipient (encrypted, never in clear text), the category and the message,
 * and expires after 90 days; an open token names the message only. A token
 * that was altered, forged or has expired opens to `undefined`.
 */
export class EmailLinkTokens extends Context.Service<
  EmailLinkTokens,
  {
    readonly sealUnsubscribe: (claims: UnsubscribeClaims) => string
    readonly openUnsubscribe: (token: string) => UnsubscribeClaims | undefined
    readonly sealOpen: (ref: string) => string
    readonly openOpen: (token: string) => string | undefined
  }
>()('EmailLinkTokens') {}
