/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evidence of a signature captured on a record, written in the record
 * write's own transaction (`SignatureEvidenceRecorder`).
 *
 * A capture on a record is a request of one signer that ends as it starts: the
 * request row takes the value's evidence id as its id (so the evidence of a
 * stored value is found from the value), one `signer` row, one subject row and
 * two chain events, `signed` then `completed`. Everything is prepared — the
 * salts drawn, the commitments taken, the chain hashed — BEFORE the write's
 * transaction opens; inside it the rows are only inserted.
 *
 * A capture on a record declares no retention, so its request has no
 * `keep_until`: its evidence stays until a retention is declared for it.
 */

import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { SignatureEvidenceRecorder } from '@/application/ports/services/signature-evidence-recorder'
import { DatabaseError } from '@/domain/errors'
import { recordCaptureFlowName } from '@/domain/models/app/signatures/signature-capture-service'
import {
  chainEventsAfter,
  contactCommitmentValue,
  emptyChainHead,
  sha256Hex,
  subjectCommitment,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'
import {
  evidenceInstant,
  evidenceTable,
  insertChainEventOn,
  insertSubjectOn,
  SignatureEvidenceScope,
  type PendingSignatureEvidence,
} from './signature-evidence-queries'
import { executeRawOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'
import type { CapturedSignatureEvidence } from '@/application/ports/services/signature-evidence-recorder'

/** The name a capture on a record gives its one signer. */
export const RECORD_CAPTURE_SIGNER = 'signer'

/** 16 random bytes, hex: one salt. */
const freshSalt = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')

/** The datums a capture commits to, with the salt drawn for each. */
const saltedDatums = (evidence: CapturedSignatureEvidence) => {
  const { subject, value } = evidence
  const datums: Readonly<Record<string, string | undefined>> = {
    name: value.signerName,
    ipAddress: subject.ipAddress,
    userAgent: subject.userAgent,
  }
  const present = Object.entries(datums).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ''
  )
  return {
    datums: present,
    salts: Object.fromEntries([
      ...present.map(([field]) => [field, freshSalt()]),
      ['contact', freshSalt()],
    ]),
  }
}

/** Everything a capture writes, prepared outside the transaction. */
const prepare = (evidence: CapturedSignatureEvidence) => {
  const { value } = evidence
  const requestId = value.evidenceId ?? crypto.randomUUID()
  const signerId = crypto.randomUUID()
  const signedAtMs = Date.parse(value.signedAt)
  const { datums, salts } = saltedDatums(evidence)
  const commitments = Object.fromEntries(
    datums.map(([field, datum]) => [field, subjectCommitment(field, datum, salts[field] ?? '')])
  )
  const contactCommitment = subjectCommitment(
    'contact',
    contactCommitmentValue({ email: evidence.subject.email }),
    salts['contact'] ?? ''
  )
  const events = chainEventsAfter(emptyChainHead(requestId), [
    {
      ...{ type: 'signed', at: value.signedAt, signer: RECORD_CAPTURE_SIGNER },
      data: {
        ...{ evidenceId: requestId, field: evidence.field, method: value.method },
        statementDigest: sha256Hex(value.statement),
        identity: value.identity.kind,
        ...(evidence.markSha256 === undefined
          ? {}
          : { markSha256: evidence.markSha256, markKey: value.image }),
        ...{ contactCommitment, commitments },
      },
    },
    { type: 'completed', at: value.signedAt, data: {} },
  ])
  return { requestId, signerId, signedAtMs, salts, events }
}

/** Insert the request and signer rows of a capture on a record. */
const insertRequestAndSigner = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  evidence: CapturedSignatureEvidence & { readonly recordId: string },
  prepared: ReturnType<typeof prepare>
): Promise<void> => {
  const at = evidenceInstant(dialect, prepared.signedAtMs)
  const { value } = evidence
  await executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_requests')}
          (id, flow_name, table_name, record_id, status, signing_order, statements, created_at, completed_at)
        VALUES (${prepared.requestId}, ${recordCaptureFlowName(evidence.field)}, ${evidence.tableName},
                ${evidence.recordId}, 'completed', 'parallel',
                ${dialect.sql.bindJsonb({ [RECORD_CAPTURE_SIGNER]: value.statement })}, ${at}, ${at})`
  )
  await executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_signers')}
          (id, request_id, signer_name, position, status, field_name, signed_at, identity_kind, user_id, created_at)
        VALUES (${prepared.signerId}, ${prepared.requestId}, ${RECORD_CAPTURE_SIGNER}, 0, 'signed',
                ${evidence.field}, ${at}, ${value.identity.kind}, ${value.identity.userId ?? null}, ${at})`
  )
}

/** The rows of `evidence`, written on the record write's transaction. */
const writeCaptureEvidence =
  (evidence: CapturedSignatureEvidence, prepared: ReturnType<typeof prepare>) =>
  async (runner: Readonly<RawSqlRunner>, dialect: Dialect, recordId: string): Promise<void> => {
    await insertRequestAndSigner(runner, dialect, { ...evidence, recordId }, prepared)
    await insertSubjectOn(runner, dialect, {
      ...{ requestId: prepared.requestId, signerId: prepared.signerId },
      subject: {
        ...{ name: evidence.value.signerName, email: evidence.subject.email },
        ...{ ipAddress: evidence.subject.ipAddress, userAgent: evidence.subject.userAgent },
        salts: prepared.salts,
      },
      createdAtMs: prepared.signedAtMs,
    })
    await prepared.events.reduce<Promise<void>>(async (previous, { event, canonicalBytes }) => {
      await previous
      await insertChainEventOn(runner, dialect, {
        ...{ requestId: prepared.requestId, event, canonicalBytes },
        createdAtMs: prepared.signedAtMs,
      })
    }, Promise.resolve())
  }

/** A pending capture, claimed by the first write of its record (or the one creating it). */
const pendingCapture = (
  evidence: CapturedSignatureEvidence
): PendingSignatureEvidence & { readonly claimed: () => boolean } => {
  const prepared = prepare(evidence)
  const state = { claimed: false }
  return {
    ...{ tableName: evidence.tableName, recordId: evidence.recordId },
    write: writeCaptureEvidence(evidence, prepared),
    claim: () => {
      if (state.claimed) return false

      state.claimed = true
      return true
    },
    claimed: () => state.claimed,
  }
}

export const SignatureEvidenceRecorderLive = Layer.succeed(
  SignatureEvidenceRecorder,
  SignatureEvidenceRecorder.of({
    recordWith: (evidence, write) =>
      Effect.gen(function* () {
        const pending = pendingCapture(evidence)
        const outer = yield* SignatureEvidenceScope
        const written = yield* write.pipe(
          Effect.provideService(SignatureEvidenceScope, [...outer, pending])
        )
        if (!pending.claimed()) {
          return yield* Effect.fail(
            new DatabaseError('The signature was stored without updating its record')
          )
        }
        return written
      }).pipe(
        Effect.withSpan('signatures.record-capture-evidence', {
          attributes: { tableName: evidence.tableName, field: evidence.field },
        })
      ),
  })
)
