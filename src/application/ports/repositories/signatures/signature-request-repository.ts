/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The life of a signing request in the evidence tables: opened by a send,
 * moved by its signers, ended by a decline, a cancel, its deadline or its
 * last signature.
 *
 * Every move is a transaction whose transition is conditional (the request
 * still open, the signer still invited) and which appends its event to the
 * request's chain, so two moves racing settle on one winner and the chain
 * records exactly what happened. A signer's link is a token only its holder
 * has: the repository mints it, stores its digest and hands the token back
 * once, to be mailed.
 */

import { Context, Data, type Effect } from 'effect'
import type { DatabaseError } from '@/domain/errors'
import type {
  ChainedSignatureEvent,
  SignatureEventBody,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'
import type {
  FrozenSigner,
  StoredRequestStatus,
} from '@/domain/models/app/signatures/signature-request-service'

/** An event to append: everything but its place in the chain. */
type EventToAppend = Omit<SignatureEventBody, 'seq'>

/** A record already has a request of this flow that has not ended. */
export class SignatureRequestAlreadyOpen extends Data.TaggedError('SignatureRequestAlreadyOpen')<{
  readonly requestId: string
}> {}

/** The signer's session no longer signs: her request ended, or she already signed or declined. */
export class SigningSessionClosed extends Data.TaggedError('SigningSessionClosed')<{
  readonly reason: 'ended' | 'already-signed'
}> {}

/** A request to open, with everything frozen at send. */
export interface OpenSignatureRequestInput {
  readonly requestId: string
  readonly flowName: string
  readonly tableName: string
  readonly recordId: string
  readonly order: 'sequential' | 'parallel'
  readonly statements: Readonly<Record<string, string>>
  readonly documentHash: string
  readonly documentKey: string
  readonly nowMs: number
  readonly expiresAtMs: number
  readonly identityKind: 'anonymous' | 'email-otp' | 'sms-otp'
  readonly signers: readonly FrozenSigner[]
  /** The positions invited now: they receive a token. */
  readonly invited: readonly number[]
  readonly sentEvent: EventToAppend
}

/** A signer just invited, with the token her link carries: shown once, then gone. */
export interface InvitedSigner {
  readonly name: string
  readonly email: string
  readonly displayName: string
  readonly token: string
}

/** One request as the lifecycle reads it. Instants are ISO 8601. */
export interface SignatureRequestRow {
  readonly id: string
  readonly flowName: string
  readonly tableName: string
  readonly recordId: string
  readonly status: StoredRequestStatus
  readonly order: 'sequential' | 'parallel'
  readonly statements: Readonly<Record<string, string>>
  readonly documentHash?: string | undefined
  readonly documentKey?: string | undefined
  readonly sealLevel: string
  readonly createdAt: string
  readonly expiresAt?: string | undefined
  readonly completedAt?: string | undefined
  readonly keepUntil?: string | undefined
}

/** One signer of a request, with the name the send recorded for her. */
export interface SignatureRequestSignerRow {
  readonly id: string
  readonly name: string
  readonly position: number
  readonly status: string
  readonly field?: string | undefined
  readonly displayName?: string | undefined
  readonly signedAt?: string | undefined
}

/** A request as the operator's list reads it: the request, with its signers in order. */
export interface SignatureRequestWithSigners extends SignatureRequestRow {
  readonly signers: readonly SignatureRequestSignerRow[]
}

/** What a signing session holds: the signer a token names, and her request. */
export interface SigningSession {
  readonly signerId: string
  readonly signerName: string
  readonly position: number
  readonly signerStatus: string
  readonly field?: string | undefined
  readonly identityKind: string
  readonly tokenExpiresAt?: string | undefined
  readonly request: SignatureRequestRow
}

/** One signature to record in the transaction of the record write that stores it. */
export interface FlowSignatureInput {
  readonly session: SigningSession
  readonly nowMs: number
  /** The `signed` event, but its contact commitments, which the repository takes from the send. */
  readonly event: EventToAppend
  /** The signer's network address and browser, kept apart as subject data. */
  readonly network: {
    readonly ipAddress?: string | undefined
    readonly userAgent?: string | undefined
  }
  /** The record field the flow writes its status into, when it declares one. */
  readonly statusField?: string | undefined
  /**
   * The challenge whose code verified the signer: consumed in the same
   * transaction, its `challenge-verified` event appended before `signed`.
   */
  readonly verifiedChallenge?:
    { readonly challengeId: string; readonly event: EventToAppend } | undefined
}

/** What a recorded signature moved. */
export interface FlowSignatureOutcome {
  readonly event: ChainedSignatureEvent
  readonly status: StoredRequestStatus
  /** The next signer of a sequential request, invited by this signature. */
  readonly invited?: InvitedSigner | undefined
}

export class SignatureRequestRepository extends Context.Service<
  SignatureRequestRepository,
  {
    /** Open a request: its row, its signers, their contacts and the `sent` event, at once. */
    readonly open: (
      input: OpenSignatureRequestInput
    ) => Effect.Effect<readonly InvitedSigner[], DatabaseError | SignatureRequestAlreadyOpen>
    readonly read: (
      requestId: string
    ) => Effect.Effect<SignatureRequestRow | undefined, DatabaseError>
    readonly signers: (
      requestId: string
    ) => Effect.Effect<readonly SignatureRequestSignerRow[], DatabaseError>
    /** The newest `limit` requests, newest first, each with her signers in order. */
    readonly recent: (
      limit: number
    ) => Effect.Effect<readonly SignatureRequestWithSigners[], DatabaseError>
    /** The request of `flowName` on one record that has not ended. */
    readonly unended: (input: {
      readonly flowName: string
      readonly tableName: string
      readonly recordId: string
    }) => Effect.Effect<SignatureRequestRow | undefined, DatabaseError>
    /** Whether one record has a request of any of `flowNames` that has not ended. */
    readonly hasUnended: (input: {
      readonly tableName: string
      readonly recordId: string
      readonly flowNames: readonly string[]
    }) => Effect.Effect<boolean, DatabaseError>
    /** The session a link token opens, or `undefined` for a token nobody issued. */
    readonly session: (token: string) => Effect.Effect<SigningSession | undefined, DatabaseError>
    /** The session of signer `signerId`, as a signing page's cookie names it, or `undefined`. */
    readonly sessionOfSigner: (
      signerId: string
    ) => Effect.Effect<SigningSession | undefined, DatabaseError>
    /**
     * Run `write`, the record write storing a signer's signature, with the
     * signature's evidence in its transaction: the signer marked signed, the
     * request moved on, her network data kept, the `signed` event appended,
     * the next signer invited in sequence, and the status cell written.
     */
    readonly signWith: <A, E, R>(
      input: FlowSignatureInput,
      write: Effect.Effect<A, E, R>
    ) => Effect.Effect<
      { readonly written: A; readonly outcome: FlowSignatureOutcome },
      E | DatabaseError | SigningSessionClosed,
      R
    >
    /**
     * Decline for the session's signer: she and the request end declined, with
     * the event. A `reason` is kept on a subject row of hers, with its salt,
     * and the event records only its commitment (`commitments.reason`), so an
     * erasure of her subject rows takes the reason with them.
     */
    readonly decline: (input: {
      readonly session: SigningSession
      readonly nowMs: number
      readonly keepUntilMs: number
      readonly event: EventToAppend
      readonly reason?: string | undefined
    }) => Effect.Effect<ChainedSignatureEvent, DatabaseError | SigningSessionClosed>
    /**
     * End a request standing in one of `from` as `status`, with its event;
     * `undefined` when it no longer stood there (another move ended it first).
     */
    readonly end: (input: {
      readonly requestId: string
      readonly from: readonly StoredRequestStatus[]
      readonly status: 'completed' | 'cancelled' | 'expired'
      readonly nowMs: number
      readonly keepUntilMs: number
      /** Events appended before `event`, in order (a completion's `sealed`). */
      readonly before?: readonly EventToAppend[] | undefined
      readonly event: EventToAppend
      /** The level a completion's seal reached; left as it stands when absent. */
      readonly sealLevel?: 'none' | 'b-b' | 'b-t' | undefined
    }) => Effect.Effect<ChainedSignatureEvent | undefined, DatabaseError>
    /** The open requests whose deadline has passed. */
    readonly overdue: (nowMs: number) => Effect.Effect<readonly string[], DatabaseError>
    /** The requests every signer has signed, still to be completed. */
    readonly sealing: Effect.Effect<readonly string[], DatabaseError>
    /**
     * Give each signer who signed the completed request a link to her copies
     * of its documents, valid until `expiresAtMs`; each with the token, shown
     * once. The token replaces her signing link's, which no longer opened
     * anything once she signed.
     */
    readonly issueDeliveryLinks: (input: {
      readonly requestId: string
      readonly expiresAtMs: number
    }) => Effect.Effect<readonly InvitedSigner[], DatabaseError>
  }
>()('SignatureRequestRepository') {}
