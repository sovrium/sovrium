/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Outgoing text messages, as the use-cases that send them see it.
 *
 * One method: hand one message to the provider a declared connection names,
 * with that connection's credential, and answer the provider's message id.
 * It is the engine's own road, never an automation step, so a message (a
 * one-time code) never lands in a run's log; an implementation logs neither
 * the body nor the credential.
 */

import { Context, Data, type Effect } from 'effect'

/** The messaging API shapes a connection may name as its `provider`. */
export type SmsProvider = 'twilio'

/** The connection a message is sent through, its references already resolved. */
export interface SmsConnection {
  readonly provider: SmsProvider
  /** The provider API's root, `https://api.twilio.com` for Twilio when the connection names none. */
  readonly baseUrl: string
  /** The basic credential: for Twilio, the account id and the auth token. */
  readonly username: string
  readonly password: string
}

export interface OutgoingSms {
  readonly to: string
  /** A phone number or a messaging-service id; the provider's account default when absent. */
  readonly from?: string | undefined
  readonly body: string
}

/**
 * Why a message was not sent:
 *
 * - `budget-exhausted` — the provider took nothing because the account's
 *   sending budget is spent (HTTP 429, Twilio error 20429);
 * - `failed` — the provider refused or failed (any other answer), or could
 *   not be reached;
 * - `unconfigured` — the connection's credential or address is missing.
 */
export class SmsSendError extends Data.TaggedError('SmsSendError')<{
  readonly reason: 'budget-exhausted' | 'failed' | 'unconfigured'
  /** For the operator's log: a status and a provider error code, never the body. */
  readonly message: string
}> {}

export class SmsSender extends Context.Service<
  SmsSender,
  {
    readonly send: (
      connection: SmsConnection,
      message: OutgoingSms
    ) => Effect.Effect<string, SmsSendError>
  }
>()('SmsSender') {}
