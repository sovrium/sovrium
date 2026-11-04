/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evidence of signing requests, as the five evidence tables hold it.
 *
 * Appending to a chain is a compare-and-set: the next event is hashed from the
 * head as last read, outside any transaction, and inserted as `seq = head + 1`;
 * when another writer appended first the insert loses on `UNIQUE(request_id,
 * seq)`, the head is read again and the event hashed again. The tables refuse
 * every rewrite themselves (their triggers), so nothing here updates a chain
 * row or a subject row.
 */

import { Context, type Effect } from 'effect'
import type { DatabaseError } from '@/domain/errors'
import type { SignatureIdentity } from '@/domain/models/api/signatures/common'
import type {
  ChainedSignatureEvent,
  SignatureEventBody,
  TerminalRequestStatus,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** One signing request, as stored. Instants are ISO 8601. */
export interface StoredSignatureRequest {
  readonly id: string
  readonly flowName: string
  readonly tableName: string
  readonly recordId: string
  readonly status: string
  /** The frozen statement, keyed as the request froze it. */
  readonly statements: Readonly<Record<string, string>>
  readonly documentHash?: string | undefined
  readonly documentKey?: string | undefined
  readonly sealedDocumentKey?: string | undefined
  readonly proofKey?: string | undefined
  readonly createdAt: string
  readonly expiresAt?: string | undefined
  readonly completedAt?: string | undefined
  readonly keepUntil?: string | undefined
}

/** One signer of a request, as stored: never her name, address or device. */
export interface StoredSignatureSigner {
  readonly id: string
  readonly signerName: string
  readonly position: number
  readonly status: string
  readonly fieldName?: string | undefined
  readonly identityKind: SignatureIdentity['kind']
  readonly signedAt?: string | undefined
}

/**
 * One signature an account gave, as the evidence tables hold it: the signer
 * row her account is linked to, the request it belongs to, and the contact
 * details her subject row keeps (absent once erased).
 */
export interface AccountSignatureRow {
  readonly requestId: string
  readonly flowName: string
  readonly signerName: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName?: string | undefined
  readonly signedAt?: string | undefined
  readonly identityKind: SignatureIdentity['kind']
  /** The frozen statement, keyed as the request froze it. */
  readonly statements: Readonly<Record<string, string>>
  /** How she signed, as the chain recorded it. */
  readonly method?: string | undefined
  readonly contact: {
    readonly name?: string | undefined
    readonly email?: string | undefined
    readonly phone?: string | undefined
  }
}

/** An event to append: everything but its place in the chain. */
export type SignatureEventToAppend = Omit<SignatureEventBody, 'seq'>

/** The record cell an erasure redacts, and how. */
export interface ErasedSignatureCell {
  readonly tableName: string
  readonly recordId: string
  readonly field: string
  /** The cell as the erasure leaves it, or `undefined` to leave it as it is. */
  readonly redact: (cell: unknown) => Readonly<Record<string, unknown>> | undefined
}

export class SignatureEvidenceRepository extends Context.Service<
  SignatureEvidenceRepository,
  {
    readonly readRequest: (
      requestId: string
    ) => Effect.Effect<StoredSignatureRequest | undefined, DatabaseError>
    readonly readSigners: (
      requestId: string
    ) => Effect.Effect<readonly StoredSignatureSigner[], DatabaseError>
    /** The chain, in order, each event read back from the bytes it was hashed over. */
    readonly readChain: (
      requestId: string
    ) => Effect.Effect<readonly ChainedSignatureEvent[], DatabaseError>
    /** Append one event to a request's chain; resolves to the event as linked. */
    readonly appendEvent: (
      requestId: string,
      event: SignatureEventToAppend
    ) => Effect.Effect<ChainedSignatureEvent, DatabaseError>
    /**
     * Erase one signer of a request, in one transaction: her record cell
     * redacted (when `cell` is given), her subject rows deleted (her name,
     * address, device and the salts that open her commitments), her account
     * link cleared, and `event` appended to the chain so a reader sees why her
     * commitments no longer open.
     *
     * Erasing a signer the chain already records as erased appends nothing and
     * resolves to that first `erased` event. The check is part of each attempt
     * of the compare-and-set, so two erasures racing append one event.
     */
    readonly eraseSigner: (input: {
      readonly requestId: string
      readonly signerId: string
      readonly event: SignatureEventToAppend
      readonly cell?: ErasedSignatureCell | undefined
    }) => Effect.Effect<ChainedSignatureEvent, DatabaseError>
    /**
     * Move a request to its end, `status`, and set the date its evidence may
     * go. `completed_at` is set for a completed request only. A request that
     * already has a `keep_until` keeps it: the column is written once.
     */
    /**
     * Record where a completed request's signed document and proof file are
     * kept. Each key is written once: a key already recorded is left as it is.
     */
    readonly recordOutputs: (input: {
      readonly requestId: string
      readonly signedDocumentKey: string
      readonly proofKey: string
    }) => Effect.Effect<void, DatabaseError>
    /**
     * The completed requests whose documents are not recorded yet: a server
     * stopped between the `completed` event and the record of its outputs.
     */
    readonly completedWithoutOutputs: Effect.Effect<readonly string[], DatabaseError>
    readonly endRequest: (input: {
      readonly requestId: string
      readonly status: TerminalRequestStatus
      readonly endedAtMs: number
      readonly keepUntilMs: number
    }) => Effect.Effect<void, DatabaseError>
    /** The requests whose evidence may go: a `keep_until` before `nowMs`. */
    readonly dueForDeletion: (nowMs: number) => Effect.Effect<readonly string[], DatabaseError>
    /**
     * Delete every row of a request whose retention ended, in one transaction
     * and in the order the keys allow: the chain, the subjects, the
     * challenges, the signers, then the request. The database refuses the
     * chain's delete while `keep_until` has not passed, which fails the whole
     * delete.
     */
    readonly deleteRequest: (requestId: string) => Effect.Effect<void, DatabaseError>
    /**
     * Delete the evidence of every signature captured on one record (requests
     * that belong to no flow), in one transaction: such a request keeps no
     * retention of its own, so its retention ends with its record. Resolves to
     * the storage keys of the marks those signatures recorded.
     */
    readonly deleteRecordCaptures: (input: {
      readonly tableName: string
      readonly recordId: string
    }) => Effect.Effect<readonly string[], DatabaseError>
    /**
     * Link signer `signerName` of request `requestId` to account `userId`, once:
     * a signer already linked keeps her link.
     */
    readonly linkSignerAccount: (input: {
      readonly requestId: string
      readonly signerName: string
      readonly userId: string
    }) => Effect.Effect<void, DatabaseError>
    /** Every signature the account `userId` gave, flows and record captures alike. */
    readonly readAccountSignatures: (
      userId: string
    ) => Effect.Effect<readonly AccountSignatureRow[], DatabaseError>
  }
>()('SignatureEvidenceRepository') {}
