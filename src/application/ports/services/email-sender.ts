/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Outgoing mail, as the use-cases that send it see it.
 *
 * One method: hand a message to the operator's SMTP transport and answer the
 * transport's message id. When SMTP is not configured the implementation logs
 * the intended message and answers a synthetic id instead of failing, so a
 * use-case never has to know whether mail is wired.
 */

import { Context, Data, type Effect } from 'effect'

/** The transport refused or could not take the message. */
export class EmailSendError extends Data.TaggedError('EmailSendError')<{
  readonly cause: unknown
  readonly message: string
}> {}

export interface OutgoingEmail {
  readonly to: string
  readonly subject: string
  readonly html?: string | undefined
  readonly text?: string | undefined
  /** The sender, whole (`"Name" <address>`). Wins over {@link fromName}. */
  readonly from?: string | undefined
  /**
   * The display name to send under when the operator set no `SMTP_FROM_NAME`;
   * the address is always the operator's `SMTP_FROM`. Callers pass the app's
   * name, so an app's mail arrives from that app rather than from "Sovrium".
   */
  readonly fromName?: string | undefined
  readonly cc?: readonly string[] | undefined
  readonly bcc?: readonly string[] | undefined
  readonly replyTo?: readonly string[] | undefined
}

export class EmailSender extends Context.Service<
  EmailSender,
  {
    readonly send: (message: Readonly<OutgoingEmail>) => Effect.Effect<string, EmailSendError>
  }
>()('EmailSender') {}
