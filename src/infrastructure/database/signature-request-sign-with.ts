/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A signer's signature, recorded in the transaction of the record write that
 * stores it (`SignatureRequestRepository.signWith`).
 *
 * The record write holds the record row's lock; inside it the signer is
 * claimed (only while invited), the request moved on (only while open), her
 * network data kept apart, the `signed` event appended after the head the
 * locks now settle, the next signer of a sequence invited and the status cell
 * written. A claim or a move that finds the row already changed throws, and
 * the whole write rolls back.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  SigningSessionClosed,
  type FlowSignatureInput,
  type FlowSignatureOutcome,
  type InvitedSigner,
  type SigningSession,
} from '@/application/ports/repositories/signatures/signature-request-repository'
import { DatabaseError } from '@/domain/errors'
import { subjectCommitment } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { requestStatusOf } from '@/domain/models/app/signatures/signature-request-service'
import { type Dialect } from '@/infrastructure/database/drizzle/layer'
import { consumeChallengeOn } from '@/infrastructure/database/signature-challenge-queries'
import {
  appendChainEventOn,
  evidenceTable,
  insertSubjectOn,
  SignatureEvidenceScope,
  type PendingSignatureEvidence,
} from '@/infrastructure/database/signature-evidence-queries'
import {
  advanceOpenRequestOn,
  claimSignerOn,
  inviteSignerOn,
  subjectsOfSignerOn,
  unsignedCountOn,
  writeStatusCellOn,
} from '@/infrastructure/database/signature-request-queries'
import {
  contactCommitmentsOf,
  freshSalt,
  sentContactOf,
  type SentContact,
} from '@/infrastructure/database/signature-request-rows'
import { executeRawOn, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { issueAccessToken } from '@/infrastructure/forms/access-token'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

const runner = (db: PortableDb | unknown): Readonly<RawSqlRunner> => db as Readonly<RawSqlRunner>

const databaseError = (message: string) => (cause: unknown) => new DatabaseError(message, cause)

/** The next signer of a sequential request, invited in the signature's transaction. */
const inviteNext = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  session: SigningSession,
  nowMs: number
): Promise<InvitedSigner | undefined> => {
  const issued = issueAccessToken()
  const expiresAtMs = Date.parse(session.request.expiresAt ?? new Date(nowMs).toISOString())
  const next = await inviteSignerOn(tx, dialect, {
    ...{ requestId: session.request.id, position: session.position + 1 },
    ...{ tokenHash: issued.hash, tokenExpiresAtMs: expiresAtMs, nowMs },
  })
  if (next === undefined) return undefined
  const contact = sentContactOf(await subjectsOfSignerOn(tx, dialect, String(next['id'])))
  return {
    name: String(next['signer_name']),
    email: contact.email ?? '',
    displayName: contact.name ?? contact.email ?? '',
    token: issued.token,
  }
}

/** The challenge that verified the signer, consumed once, with its event; nothing when none did. */
const appendVerifiedChallenge = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: FlowSignatureInput
): Promise<void> => {
  const verified = input.verifiedChallenge
  if (verified === undefined) return
  const consumed = await consumeChallengeOn(tx, dialect, {
    ...{ challengeId: verified.challengeId, nowMs: input.nowMs },
  })
  // A code consumed by a racing post of the same signature: that post signed.
  if (consumed.length === 0) throw new SigningSessionClosed({ reason: 'already-signed' })
  await appendChainEventOn(tx, dialect, {
    ...{ requestId: input.session.request.id, body: verified.event, nowMs: input.nowMs },
  })
}

/**
 * Take the write lock of request `requestId` for the rest of the transaction,
 * changing nothing: a no-op update, which the evidence guard admits, on both
 * engines (SQLite has no `FOR UPDATE`; its `BEGIN IMMEDIATE` already holds
 * the database). On PostgreSQL it is what lets two signers of a parallel
 * request, signing at the same instant, read each other's signature: the
 * second waits here for the first to commit, and every statement after reads
 * what it committed, so exactly one of them finds no signer left and moves the
 * request on to `sealing`.
 */
export const lockRequestOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')} SET status = status
        WHERE id = ${requestId}`
  )

/**
 * Claim the session's signer under her request's lock, taken first so that a
 * racing signer of the same request commits before the count that follows,
 * or waits for this one to (`lockRequestOn`).
 */
const claimSignerUnderRequestLock = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  session: SigningSession,
  nowMs: number
): Promise<void> => {
  await lockRequestOn(tx, dialect, session.request.id)
  if ((await claimSignerOn(tx, dialect, { signerId: session.signerId, nowMs })).length === 0) {
    throw new SigningSessionClosed({ reason: 'already-signed' })
  }
}

/** What a signature's transaction writes, once the record write committed its update. */
const signatureWrite =
  (input: FlowSignatureInput, contact: SentContact, settle: (o: FlowSignatureOutcome) => void) =>
  async (tx: Readonly<RawSqlRunner>, dialect: Dialect): Promise<void> => {
    const { session, nowMs } = input
    const requestId = session.request.id
    await claimSignerUnderRequestLock(tx, dialect, session, nowMs)
    const status = (await unsignedCountOn(tx, dialect, requestId)) === 0 ? 'sealing' : 'signing'
    if ((await advanceOpenRequestOn(tx, dialect, { requestId, status })).length === 0) {
      throw new SigningSessionClosed({ reason: 'ended' })
    }
    const network = Object.entries(input.network).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''
    )
    const salts = Object.fromEntries(network.map(([field]) => [field, freshSalt()]))
    if (network.length > 0) {
      await insertSubjectOn(tx, dialect, {
        ...{ requestId, signerId: session.signerId },
        subject: { ...Object.fromEntries(network), salts },
        createdAtMs: nowMs,
      })
    }
    const { contactCommitment, ...named } = contactCommitmentsOf(contact)
    const commitments = {
      ...named,
      ...Object.fromEntries(
        network.map(([field, value]) => [
          field,
          subjectCommitment(field, value, salts[field] ?? ''),
        ])
      ),
    }
    await appendVerifiedChallenge(tx, dialect, input)
    const event = await appendChainEventOn(tx, dialect, {
      requestId,
      body: { ...input.event, data: { ...input.event.data, contactCommitment, commitments } },
      nowMs,
    })
    const invited =
      status === 'signing' && session.request.order === 'sequential'
        ? await inviteNext(tx, dialect, session, nowMs)
        : undefined
    if (input.statusField !== undefined) {
      await writeStatusCellOn(tx, dialect, {
        ...{ tableName: session.request.tableName, recordId: session.request.recordId },
        ...{ field: input.statusField, value: requestStatusOf(status) },
      })
    }
    settle({ event, status, invited })
  }

/** Run `write` with the signature's evidence attached to its transaction. */
export const signWithOn =
  (db: PortableDb, dialect: Dialect) =>
  <A, E, R>(input: FlowSignatureInput, write: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const contact = sentContactOf(
        yield* Effect.tryPromise({
          try: () => subjectsOfSignerOn(runner(db), dialect, input.session.signerId),
          catch: databaseError('Failed to read the contact of a signer'),
        })
      )
      const state: { claimed: boolean; outcome?: FlowSignatureOutcome; closed?: unknown } = {
        claimed: false,
      }
      const body = signatureWrite(input, contact, (outcome) => {
        state.outcome = outcome
      })
      const pending: PendingSignatureEvidence = {
        ...{ tableName: input.session.request.tableName, recordId: input.session.request.recordId },
        write: async (tx, txDialect) => {
          try {
            await body(tx, txDialect)
          } catch (error) {
            state.closed = error instanceof SigningSessionClosed ? error : undefined
            throw error
          }
        },
        claim: () => {
          if (state.claimed) return false

          state.claimed = true
          return true
        },
      }
      const outer = yield* SignatureEvidenceScope
      const result = yield* write.pipe(
        Effect.provideService(SignatureEvidenceScope, [...outer, pending]),
        Effect.result
      )
      if (state.closed instanceof SigningSessionClosed) return yield* state.closed
      if (result._tag === 'Failure') return yield* Effect.fail(result.failure)
      if (state.outcome === undefined) {
        return yield* Effect.fail(
          new DatabaseError('The signature was stored without updating its record')
        )
      }
      return { written: result.success, outcome: state.outcome }
    }).pipe(Effect.withSpan('signatures.sign-with'))
