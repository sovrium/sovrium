/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SignatureEvidenceRepository` over the evidence tables, on either engine.
 *
 * An append hashes its event from the head read outside any transaction, then
 * inserts it; an insert that loses `UNIQUE(request_id, seq)` to a concurrent
 * writer reads the head again and hashes again, a bounded number of times.
 * An erasure does the same around its transaction: the redaction, the subject
 * delete, the account link's clearing and the insert commit together, or the
 * attempt rolls back whole. Each erasure attempt first reads the chain and
 * stops at an `erased` event the signer already has, so two erasures racing
 * record one: the loser's retry finds the winner's event.
 *
 * Retention: a request's rows go in one transaction, in key order
 * (`signature-evidence-retention-queries.ts`), and the database refuses the
 * chain's delete until the request's `keep_until` has passed.
 */

import { Data, Effect, Schedule } from 'effect'
import {
  SignatureEvidenceRepository,
  type AccountSignatureRow,
  type SignatureEventToAppend,
  type StoredSignatureRequest,
  type StoredSignatureSigner,
} from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { DatabaseError } from '@/domain/errors'
import {
  chainEventAfter,
  emptyChainHead,
  parseCanonicalEvent,
  type ChainedSignatureEvent,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { layerOverDatabase, type Dialect } from '@/infrastructure/database/drizzle/layer'
import { deleteChallengesOfSignerOn } from '@/infrastructure/database/signature-challenge-queries'
import {
  deleteSubjectsOfSignerOn,
  endRequestOn,
  insertChainEventOn,
  isoOfStoredInstant,
  readChainHeadOn,
  readChainOn,
  readRequestOn,
  readSignersOn,
  redactSignatureCellOn,
} from '@/infrastructure/database/signature-evidence-queries'
import {
  accountSignerRowsOn,
  clearSignerAccountOn,
  closeRecordCaptureOn,
  deleteRequestRowsOn,
  dueForDeletionOn,
  linkSignerAccountOn,
  recordCaptureRequestsOn,
  signerContactRowsOn,
} from '@/infrastructure/database/signature-evidence-retention-queries'
import {
  completedWithoutOutputsOn,
  recordRequestOutputsOn,
} from '@/infrastructure/database/signature-output-queries'
import { isUniqueConstraintViolation } from '@/infrastructure/database/table-queries/mutation-helpers/create-record-helpers'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import type { SignatureIdentity } from '@/domain/models/api/signatures/common'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

/** How many times an append re-reads a head that moved before giving up. */
const APPEND_ATTEMPTS = 5

/** An append lost the compare-and-set: another event took its `seq`. */
class ChainHeadMoved extends Data.TaggedError('ChainHeadMoved')<{ readonly cause: unknown }> {}

const databaseError = (message: string) => (cause: unknown) => new DatabaseError(message, cause)

/** The failure of an attempt: a lost compare-and-set, or any other database error. */
const attemptFailure = (message: string) => (cause: unknown) =>
  isUniqueConstraintViolation(cause)
    ? new ChainHeadMoved({ cause })
    : new DatabaseError(message, cause)

/** Retry `attempt` while its head moved; then the lost race is a database error. */
const withCompareAndSet = <A>(
  message: string,
  attempt: Effect.Effect<A, ChainHeadMoved | DatabaseError>
): Effect.Effect<A, DatabaseError> =>
  attempt.pipe(
    Effect.retry({
      while: (error) => error instanceof ChainHeadMoved,
      schedule: Schedule.recurs(APPEND_ATTEMPTS - 1),
    }),
    Effect.mapError((error) =>
      error instanceof ChainHeadMoved ? new DatabaseError(message, error.cause) : error
    )
  )

/** The next event after the head as it stands, hashed outside any transaction. */
const nextEvent = (
  db: PortableDb,
  dialect: Dialect,
  requestId: string,
  body: SignatureEventToAppend
) =>
  Effect.tryPromise({
    try: () => readChainHeadOn(db as Readonly<RawSqlRunner>, dialect, requestId),
    catch: databaseError('Failed to read the head of a signature chain'),
  }).pipe(Effect.map((head) => chainEventAfter(head, body)))

const optionalString = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value)

/** A jsonb cell on PostgreSQL, JSON text on SQLite. */
const statementsOf = (value: unknown): Readonly<Record<string, string>> => {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  return typeof parsed === 'object' && parsed !== null
    ? (Object.fromEntries(
        Object.entries(parsed as Readonly<Record<string, unknown>>).map(([key, text]) => [
          key,
          String(text),
        ])
      ) as Readonly<Record<string, string>>)
    : {}
}

const requestOf = (row: Readonly<Record<string, unknown>>): StoredSignatureRequest => ({
  ...{ id: String(row['id']), flowName: String(row['flow_name']) },
  ...{ tableName: String(row['table_name']), recordId: String(row['record_id']) },
  ...{ status: String(row['status']), statements: statementsOf(row['statements']) },
  documentHash: optionalString(row['document_hash']),
  documentKey: optionalString(row['document_key']),
  sealedDocumentKey: optionalString(row['sealed_document_key']),
  proofKey: optionalString(row['proof_key']),
  createdAt: isoOfStoredInstant(row['created_at']) ?? '',
  expiresAt: isoOfStoredInstant(row['expires_at']),
  completedAt: isoOfStoredInstant(row['completed_at']),
  keepUntil: isoOfStoredInstant(row['keep_until']),
})

const signerOf = (row: Readonly<Record<string, unknown>>): StoredSignatureSigner => ({
  ...{ id: String(row['id']), signerName: String(row['signer_name']) },
  ...{ position: Number(row['position']), status: String(row['status']) },
  fieldName: optionalString(row['field_name']),
  identityKind: String(row['identity_kind']) as SignatureIdentity['kind'],
  signedAt: isoOfStoredInstant(row['signed_at']),
})

/** The chain read back from its canonical bytes; a row that does not parse fails the read. */
const chainOf = (
  rows: Awaited<ReturnType<typeof readChainOn>>
): Effect.Effect<readonly ChainedSignatureEvent[], DatabaseError> =>
  Effect.forEach(rows, (row) => {
    const parsed = parseCanonicalEvent(row.canonicalBytes)
    return parsed === undefined
      ? Effect.fail(new DatabaseError(`Signature chain row ${row.seq} is not a canonical event`))
      : Effect.succeed({ ...parsed, hash: row.hash })
  })

const runner = (db: PortableDb): Readonly<RawSqlRunner> => db as Readonly<RawSqlRunner>

/** The first non-empty value of `column` across subject rows. */
const firstOf = (
  rows: ReadonlyArray<Record<string, unknown>>,
  column: string
): string | undefined =>
  rows
    .map((row) => optionalString(row[column]))
    .find((value) => value !== undefined && value !== '')

/** How `signer` signed, as the chain's `signed` event of hers recorded it. */
const methodOf = (chain: readonly ChainedSignatureEvent[], signer: string): string | undefined => {
  const method = chain.find((event) => event.type === 'signed' && event.signer === signer)?.data[
    'method'
  ]
  return typeof method === 'string' ? method : undefined
}

/** Every signature account `userId` gave, with her contact details and how she signed. */
const readAccountSignaturesOn = async (
  on: Readonly<RawSqlRunner>,
  dialect: Dialect,
  userId: string
): Promise<readonly AccountSignatureRow[]> => {
  const signers = await accountSignerRowsOn(on, dialect, userId)
  return signers.reduce<Promise<readonly AccountSignatureRow[]>>(async (previous, row) => {
    const done = await previous
    const signerName = String(row['signer_name'])
    const contacts = await signerContactRowsOn(on, dialect, String(row['signer_id']))
    const chain = (await readChainOn(on, dialect, String(row['request_id'])))
      .map((stored) => parseCanonicalEvent(stored.canonicalBytes))
      .filter((event): event is ChainedSignatureEvent => event !== undefined)
    return [
      ...done,
      {
        ...{ requestId: String(row['request_id']), flowName: String(row['flow_name']) },
        ...{ signerName, tableName: String(row['table_name']) },
        ...{ recordId: String(row['record_id']), fieldName: optionalString(row['field_name']) },
        signedAt: isoOfStoredInstant(row['signed_at']),
        identityKind: String(row['identity_kind']) as SignatureIdentity['kind'],
        statements: statementsOf(row['statements']),
        method: methodOf(chain, signerName),
        contact: {
          ...{ name: firstOf(contacts, 'name'), email: firstOf(contacts, 'email') },
          phone: firstOf(contacts, 'phone'),
        },
      },
    ]
  }, Promise.resolve([]))
}

export const SignatureEvidenceRepositoryLive = layerOverDatabase(SignatureEvidenceRepository, {
  readRequest: (db, dialect) => (requestId) =>
    Effect.tryPromise({
      try: () => readRequestOn(runner(db), dialect, requestId),
      catch: databaseError('Failed to read a signature request'),
    }).pipe(
      Effect.map((row) => (row === undefined ? undefined : requestOf(row))),
      Effect.withSpan('signatures.read-request')
    ),

  readSigners: (db, dialect) => (requestId) =>
    Effect.tryPromise({
      try: () => readSignersOn(runner(db), dialect, requestId),
      catch: databaseError('Failed to read the signers of a signature request'),
    }).pipe(
      Effect.map((rows) => rows.map(signerOf)),
      Effect.withSpan('signatures.read-signers')
    ),

  readChain: (db, dialect) => (requestId) =>
    Effect.tryPromise({
      try: () => readChainOn(runner(db), dialect, requestId),
      catch: databaseError('Failed to read a signature chain'),
    }).pipe(Effect.flatMap(chainOf), Effect.withSpan('signatures.read-chain')),

  appendEvent: (db, dialect) => (requestId, body) =>
    withCompareAndSet(
      'A signature chain kept moving while an event was appended',
      Effect.gen(function* () {
        const { event, canonicalBytes } = yield* nextEvent(db, dialect, requestId, body)
        yield* Effect.tryPromise({
          try: () =>
            insertChainEventOn(runner(db), dialect, {
              ...{ requestId, event, canonicalBytes },
              createdAtMs: Date.now(),
            }),
          catch: attemptFailure('Failed to append to a signature chain'),
        })
        return event
      })
    ).pipe(Effect.withSpan('signatures.append-event', { attributes: { type: body.type } })),

  eraseSigner: (db, dialect) => (input) =>
    withCompareAndSet(
      'A signature chain kept moving while a signer was erased',
      Effect.gen(function* () {
        const chain = yield* Effect.tryPromise({
          try: () => readChainOn(runner(db), dialect, input.requestId),
          catch: databaseError('Failed to read a signature chain'),
        }).pipe(Effect.flatMap(chainOf))
        const already = chain.find(
          (event) => event.type === 'erased' && event.signer === input.event.signer
        )
        if (already !== undefined) return already
        const last = chain.at(-1)
        const { event, canonicalBytes } = chainEventAfter(
          last === undefined
            ? emptyChainHead(input.requestId)
            : { requestId: input.requestId, seq: last.seq, hash: last.hash },
          input.event
        )
        yield* withPromiseTransaction(
          db,
          async (tx) => {
            const on = tx as Readonly<RawSqlRunner>
            // The cell first: the subject rows are what tells whose it was.
            if (input.cell !== undefined) await redactSignatureCellOn(on, dialect, input.cell)
            await deleteSubjectsOfSignerOn(on, dialect, input.signerId)
            await deleteChallengesOfSignerOn(on, dialect, input.signerId)
            await clearSignerAccountOn(on, dialect, input.signerId)
            await insertChainEventOn(on, dialect, {
              ...{ requestId: input.requestId, event, canonicalBytes },
              createdAtMs: Date.now(),
            })
          },
          attemptFailure('Failed to erase a signer')
        )
        return event
      })
    ).pipe(Effect.withSpan('signatures.erase-signer')),

  recordOutputs: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => recordRequestOutputsOn(runner(db), dialect, input),
      catch: databaseError('Failed to record the outputs of a signature request'),
    }).pipe(Effect.asVoid, Effect.withSpan('signatures.record-outputs')),

  completedWithoutOutputs: (db, dialect) =>
    Effect.tryPromise({
      try: () => completedWithoutOutputsOn(runner(db), dialect),
      catch: databaseError('Failed to read the completed requests without outputs'),
    }).pipe(Effect.withSpan('signatures.completed-without-outputs')),

  endRequest: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => endRequestOn(runner(db), dialect, input),
      catch: databaseError('Failed to end a signature request'),
    }).pipe(
      Effect.asVoid,
      Effect.withSpan('signatures.end-request', { attributes: { status: input.status } })
    ),

  dueForDeletion: (db, dialect) => (nowMs) =>
    Effect.tryPromise({
      try: () => dueForDeletionOn(runner(db), dialect, nowMs),
      catch: databaseError('Failed to list the signature requests past their retention'),
    }).pipe(Effect.withSpan('signatures.due-for-deletion')),

  deleteRequest: (db, dialect) => (requestId) =>
    withPromiseTransaction(
      db,
      (tx) => deleteRequestRowsOn(tx as Readonly<RawSqlRunner>, dialect, requestId),
      databaseError('Failed to delete a signature request past its retention')
    ).pipe(Effect.withSpan('signatures.delete-request')),

  deleteRecordCaptures: (db, dialect) => (record) =>
    withPromiseTransaction(
      db,
      async (tx) => {
        const on = tx as Readonly<RawSqlRunner>
        const requestIds = await recordCaptureRequestsOn(on, dialect, record)
        return requestIds.reduce<Promise<readonly string[]>>(async (previous, requestId) => {
          const marks = await previous
          // The marks its `signed` events name: a typed signature stored none.
          const named = (await readChainOn(on, dialect, requestId))
            .map((row) => parseCanonicalEvent(row.canonicalBytes)?.data['markKey'])
            .filter((key): key is string => typeof key === 'string' && key !== '')
          await closeRecordCaptureOn(on, dialect, requestId)
          await deleteRequestRowsOn(on, dialect, requestId)
          return [...marks, ...named]
        }, Promise.resolve([]))
      },
      databaseError('Failed to delete the signature evidence of a record')
    ).pipe(Effect.withSpan('signatures.delete-record-captures')),

  linkSignerAccount: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => linkSignerAccountOn(runner(db), dialect, input),
      catch: databaseError('Failed to link a signer to her account'),
    }).pipe(Effect.asVoid, Effect.withSpan('signatures.link-signer-account')),

  readAccountSignatures: (db, dialect) => (userId) =>
    Effect.tryPromise({
      try: () => readAccountSignaturesOn(runner(db), dialect, userId),
      catch: databaseError('Failed to read the signatures of an account'),
    }).pipe(Effect.withSpan('signatures.read-account-signatures')),
})
