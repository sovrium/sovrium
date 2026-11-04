/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one-time codes of signing requests, and the per-address budgets that
 * bound them.
 *
 * A challenge row holds the HMAC of its code, never the code; its tries only
 * count upwards and it is consumed once, in the transaction of the signature
 * it verified (`SignatureRequestRepository.signWith`). The address budgets
 * are kept durable, so a restart opens no window: each counted event is one
 * row keyed by a digest of the address, never the address, and expiring with
 * the hour it counts in.
 */

import { Context, type Effect } from 'effect'
import type { DatabaseError } from '@/domain/errors'
import type {
  CodeIssueRefusal,
  SignerCodeStanding,
} from '@/domain/models/app/signatures/signature-challenge-service'
import type { SignatureEventBody } from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** A code channel. */
export type SignatureCodeChannel = 'email' | 'sms'

/** What an address budget counts: codes sent, or links that led nowhere. */
export type SigningAddressEvent = 'code-sent' | 'sms-code-sent' | 'invalid-link'

/** One challenge as stored. Instants are epoch milliseconds. */
export interface StoredSignatureChallenge {
  readonly id: string
  readonly signerId: string
  readonly channel: SignatureCodeChannel
  readonly codeHmac: string
  readonly expiresAtMs: number
  readonly consumed: boolean
  readonly documentHash?: string | undefined
}

export class SignatureChallengeRepository extends Context.Service<
  SignatureChallengeRepository,
  {
    /** The address the send froze for a signer, or `undefined` once erased. */
    readonly destination: (signerId: string) => Effect.Effect<string | undefined, DatabaseError>
    /** The phone the send froze for a signer of a flow texting its codes; `undefined` when none. */
    readonly phoneDestination: (
      signerId: string
    ) => Effect.Effect<string | undefined, DatabaseError>
    /**
     * Whether the signer answered a code of `channel` for this document
     * before: a challenge of hers consumed by a verification.
     */
    readonly hasVerified: (input: {
      readonly signerId: string
      readonly channel: SignatureCodeChannel
      readonly documentHash: string
    }) => Effect.Effect<boolean, DatabaseError>
    /**
     * Consume a verified challenge ahead of the signature, with its
     * `challenge-verified` event, in one transaction; `false` when a racing
     * request consumed it first.
     */
    readonly consumeVerified: (input: {
      readonly challengeId: string
      readonly requestId: string
      readonly nowMs: number
      readonly event: Omit<SignatureEventBody, 'seq'>
    }) => Effect.Effect<boolean, DatabaseError>
    /**
     * Admit a new challenge and record it, before its code is sent, in one
     * transaction holding the request's lock (and the address budget's): the
     * signer's standing of the channel and the address's count read, `refuse`
     * judging them, then, when it names no refusal, the address event counted
     * and the challenge (its code's HMAC, the document it is bound to, its
     * deadline) inserted. Codes asked for together are thereby judged one
     * after the other, so a cooldown or a budget admits exactly one of them.
     * Resolves to the refusal, or `undefined` once the challenge is recorded.
     */
    readonly issueWithinBudgets: (input: {
      readonly requestId: string
      readonly address: string
      readonly event: SigningAddressEvent
      readonly challenge: {
        readonly id: string
        readonly signerId: string
        readonly channel: SignatureCodeChannel
        readonly codeHmac: string
        readonly documentHash: string
        readonly expiresAtMs: number
      }
      readonly nowMs: number
      readonly sinceMs: number
      readonly untilMs: number
      readonly refuse: (facts: {
        readonly standing: SignerCodeStanding
        readonly sentFromAddress: number
      }) => CodeIssueRefusal | undefined
    }) => Effect.Effect<CodeIssueRefusal | undefined, DatabaseError>
    /**
     * Mark a recorded challenge whose code could not be delivered expired at
     * birth: it no longer counts as a code she received, while her cooldown
     * still runs from it.
     */
    readonly expireAtBirth: (input: {
      readonly id: string
      readonly signerId: string
      readonly channel: SignatureCodeChannel
      readonly codeHmac: string
      readonly documentHash: string
      readonly nowMs: number
    }) => Effect.Effect<void, DatabaseError>
    /** One challenge, or `undefined` for an id nobody issued. */
    readonly find: (
      challengeId: string
    ) => Effect.Effect<StoredSignatureChallenge | undefined, DatabaseError>
    /**
     * Count one more try on a challenge before its code is compared; the
     * signer's tries of that channel across all her challenges, this one included.
     */
    readonly countTry: (input: {
      readonly challengeId: string
      readonly signerId: string
      readonly channel: SignatureCodeChannel
    }) => Effect.Effect<number, DatabaseError>
    /** How many `event`s one address made since `sinceMs`. */
    readonly addressEvents: (input: {
      readonly address: string
      readonly event: SigningAddressEvent
      readonly sinceMs: number
      readonly nowMs: number
    }) => Effect.Effect<number, DatabaseError>
    /** Count one `event` from an address, kept until `untilMs`. */
    readonly recordAddressEvent: (input: {
      readonly address: string
      readonly event: SigningAddressEvent
      readonly nowMs: number
      readonly untilMs: number
    }) => Effect.Effect<void, DatabaseError>
  }
>()('SignatureChallengeRepository') {}
