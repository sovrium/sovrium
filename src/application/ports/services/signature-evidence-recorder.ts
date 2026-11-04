/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a captured signature's evidence is recorded.
 *
 * `captureSignature` mints the evidence id the stored value carries and hands
 * this port the signature together with the record write that stores it. The
 * port runs that write with the evidence entry attached, so the entry is
 * written INSIDE the write's own transaction: a write that commits commits its
 * evidence, a recording that fails rolls the write back, and no signature is
 * ever stored without its evidence (`signature_requests`, `signature_signers`,
 * `signature_subjects` and two chain events, `signed` then `completed`).
 *
 * The capture reads the port with `Effect.serviceOption`: a runtime that does
 * not provide it (a unit test, a harness with no database) stores the value
 * alone, and providing it changes no caller.
 */

import { Context, type Effect } from 'effect'
import type { DatabaseError } from '@/domain/errors'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'

/** One captured signature, as the evidence chain records it. */
export interface CapturedSignatureEvidence {
  readonly tableName: string
  /**
   * The record the write updates. Left out, the record the write creates in
   * `tableName`: a form whose signature field is bound to a column signs the
   * row its submission creates, whose id is known only once it is inserted.
   */
  readonly recordId?: string | undefined
  readonly field: string
  /** The value stored in the field; its `evidenceId` names the entry to write. */
  readonly value: SignatureValueV2
  /** SHA-256 (hex) of the stored mark, when the signature was drawn. */
  readonly markSha256?: string | undefined
  /**
   * The signer's address and device, as the request carried them. Each enters
   * the chain only as a salted commitment; the value itself is kept apart, and
   * goes with an erasure.
   */
  readonly subject: {
    readonly email?: string | undefined
    readonly ipAddress?: string | undefined
    readonly userAgent?: string | undefined
  }
}

export class SignatureEvidenceRecorder extends Context.Service<
  SignatureEvidenceRecorder,
  {
    /**
     * Run `write`, the record write storing `evidence.value`, with the
     * evidence entry written in its transaction. Fails when the write
     * committed no update of the record (no creation of one, when
     * `evidence.recordId` is left out), since its evidence was then not
     * written either.
     */
    readonly recordWith: <A, E, R>(
      evidence: CapturedSignatureEvidence,
      write: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | DatabaseError, R>
  }
>()('SignatureEvidenceRecorder') {}
