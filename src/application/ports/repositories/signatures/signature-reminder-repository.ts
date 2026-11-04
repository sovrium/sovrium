/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reminders of open signing requests, as the sweep reads and writes them.
 *
 * `due` lists the signers whose turn has come, who have not signed, and whose
 * last message is older than the flow's interval, on requests still open and
 * before their deadline. `remind` gives one of them her next reminder in one
 * transaction: it counts her `reminded` events, and under the flow's `max`
 * it rotates her link (a new token digest, the old link answering the uniform
 * not-found), moves her reminder clock, and appends the `reminded` event. A
 * tick that overlaps another finds her clock already moved and does nothing.
 */

import { Context, type Effect } from 'effect'
import type { DatabaseError } from '@/domain/errors'
import type { SignatureEventBody } from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** One signer due a reminder, with the contact the send froze for her. */
export interface ReminderCandidate {
  readonly signerId: string
  readonly signerName: string
  readonly requestId: string
  readonly recordId: string
  readonly email: string | undefined
  readonly displayName: string | undefined
  /** When the request stops accepting signatures, epoch milliseconds; `undefined` for none. */
  readonly expiresAtMs: number | undefined
}

/** A reminder given: the new link's token, and which reminder it is. */
export interface ReminderGiven {
  readonly token: string
  readonly reminder: number
}

export class SignatureReminderRepository extends Context.Service<
  SignatureReminderRepository,
  {
    readonly due: (input: {
      readonly flowName: string
      readonly notifiedBeforeMs: number
      readonly nowMs: number
    }) => Effect.Effect<readonly ReminderCandidate[], DatabaseError>
    /**
     * Give `candidate` her next reminder; `undefined` when she has had `max`,
     * signed, or was reminded by an overlapping tick meanwhile.
     */
    readonly remind: (input: {
      readonly candidate: ReminderCandidate
      readonly max: number
      readonly notifiedBeforeMs: number
      readonly nowMs: number
      readonly event: (reminder: number) => Omit<SignatureEventBody, 'seq'>
    }) => Effect.Effect<ReminderGiven | undefined, DatabaseError>
  }
>()('SignatureReminderRepository') {}
