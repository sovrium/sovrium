/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The statements the evidence chain is read and written with, on either
 * engine, each over a runner the caller holds: the database client, or an
 * open transaction.
 *
 * A chain row is appended by compare-and-set: the next event is hashed from
 * the head read BEFORE the transaction, and the insert of `seq = head + 1`
 * fails on `UNIQUE(request_id, seq)` when another writer got there first,
 * after which the caller re-reads the head and hashes again. So no hashing
 * runs inside a transaction, which on SQLite holds the write lock.
 *
 * Bytes are written as bytes on both engines and read back as hex
 * (`encode(…, 'hex')`, `hex(…)`), which both drivers return as a string.
 *
 * {@link SignatureEvidenceScope} is how a signature captured on a record has
 * its evidence written INSIDE the record write's own transaction: the
 * repositories' transaction door (`webhook-outbox-queries.ts`) hands the rows
 * a write committed to {@link recordPendingSignatureEvidence}, which writes
 * the evidence of each pending capture whose record the write updated, once.
 * A failure there fails the write, and the transaction rolls back with it.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Context } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { chainEventAfter } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import type { Dialect } from './drizzle/layer'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type {
  ChainHead,
  ChainedSignatureEvent,
  SignatureEventBody,
} from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** A `system` evidence table, as `dialect` names it. */
export const evidenceTable = (dialect: Dialect, name: string): SQL =>
  dialect.sql.systemTableRef(name)

/** An instant as `dialect` stores it: epoch milliseconds on SQLite, ISO 8601 on PostgreSQL. */
export const evidenceInstant = (dialect: Dialect, epochMs: number): number | string =>
  dialect.kind === 'sqlite' ? epochMs : new Date(epochMs).toISOString()

/** A stored instant, as ISO 8601: a `Date`, an ISO string or epoch milliseconds. */
export const isoOfStoredInstant = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value.toISOString()
  const asNumber = typeof value === 'number' ? value : Number.NaN
  const date = Number.isFinite(asNumber) ? new Date(asNumber) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** The SQL that reads a bytes column as hex. */
const hexOf = (dialect: Dialect, column: string): SQL =>
  dialect.kind === 'sqlite'
    ? sql`hex(${sql.identifier(column)})`
    : sql`encode(${sql.identifier(column)}, 'hex')`

/** The head of a request's chain: its last event, or the empty head. */
export const readChainHeadOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<ChainHead> => {
  const rows = await executeRawTypedOn<{ readonly seq: unknown; readonly hash: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT seq, hash FROM ${evidenceTable(dialect, 'signature_evidence')}
        WHERE request_id = ${requestId} ORDER BY seq DESC LIMIT 1`
  )
  const [last] = rows
  return last === undefined
    ? { requestId, seq: 0, hash: '0'.repeat(64) }
    : { requestId, seq: Number(last.seq), hash: String(last.hash) }
}

/** One chain row as stored: its canonical bytes, decoded from hex. */
export interface StoredChainRow {
  readonly seq: number
  readonly canonicalBytes: Uint8Array
  readonly hash: string
}

/** Every event of a request's chain, in order. */
export const readChainOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<readonly StoredChainRow[]> => {
  const rows = await executeRawTypedOn<{
    readonly seq: unknown
    readonly bytes: unknown
    readonly hash: unknown
  }>(
    dialect.kind,
    runner,
    sql`SELECT seq, ${hexOf(dialect, 'canonical_bytes')} AS bytes, hash
        FROM ${evidenceTable(dialect, 'signature_evidence')}
        WHERE request_id = ${requestId} ORDER BY seq ASC`
  )
  return rows.map((row) => ({
    seq: Number(row.seq),
    canonicalBytes: Uint8Array.from(Buffer.from(String(row.bytes), 'hex')),
    hash: String(row.hash),
  }))
}

/**
 * Insert `event` into its request's chain. Fails on `UNIQUE(request_id, seq)`
 * when the head moved since it was read: the compare-and-set lost.
 */
export const insertChainEventOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly event: ChainedSignatureEvent
    readonly canonicalBytes: Uint8Array
    readonly createdAtMs: number
  }
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const { event } = input
  const previousHash = event.seq === 1 ? null : event.prevHash
  return executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_evidence')}
          (id, request_id, seq, event_type, canonical_bytes, previous_hash, hash, created_at)
        VALUES (${crypto.randomUUID()}, ${input.requestId}, ${event.seq}, ${event.type},
                ${Buffer.from(input.canonicalBytes)}, ${previousHash}, ${event.hash},
                ${evidenceInstant(dialect, input.createdAtMs)})`
  )
}

/** Delete the subject rows of one signer: her name, address, device and the salts. */
export const deleteSubjectsOfSignerOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  signerId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_subjects')} WHERE signer_id = ${signerId}`
  )

/** The salts and plaintext of one subject row, as a capture records them. */
export interface SubjectRow {
  readonly name?: string | undefined
  readonly email?: string | undefined
  readonly phone?: string | undefined
  readonly ipAddress?: string | undefined
  readonly userAgent?: string | undefined
  /** The reason she gave when she declined. */
  readonly reason?: string | undefined
  /** The salt of each committed field, by field name. */
  readonly salts: Readonly<Record<string, string>>
}

/** Insert one subject row for `signerId` of `requestId`. */
export const insertSubjectOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly signerId: string
    readonly subject: SubjectRow
    readonly createdAtMs: number
  }
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const { subject } = input
  return executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_subjects')}
          (id, request_id, signer_id, name, email, phone, ip_address, user_agent, reason, salts,
           created_at)
        VALUES (${crypto.randomUUID()}, ${input.requestId}, ${input.signerId},
                ${subject.name ?? null}, ${subject.email ?? null}, ${subject.phone ?? null},
                ${subject.ipAddress ?? null}, ${subject.userAgent ?? null}, ${subject.reason ?? null},
                ${dialect.sql.bindJsonb(subject.salts)}, ${evidenceInstant(dialect, input.createdAtMs)})`
  )
}

/** One capture awaiting the transaction of the record write that stores it. */
export interface PendingSignatureEvidence {
  readonly tableName: string
  /** The record the write updates; `undefined` for the record it inserts into `tableName`. */
  readonly recordId: string | undefined
  /** Write the evidence rows on the write's own transaction, for the record `recordId`. */
  readonly write: (
    runner: Readonly<RawSqlRunner>,
    dialect: Dialect,
    recordId: string
  ) => Promise<void>
  /** `true` the first time only: the evidence is written once, by the first write of its record. */
  readonly claim: () => boolean
}

/**
 * The captures whose evidence the current record write owes. Empty outside a
 * capture, which is how every other write records no evidence.
 */
export const SignatureEvidenceScope = Context.Reference<readonly PendingSignatureEvidence[]>(
  'sovrium/SignatureEvidenceScope',
  { defaultValue: () => [] }
)

/** The change that stores `capture`: the update of its record, or the insert into its table. */
const changeStoring = (
  capture: PendingSignatureEvidence,
  changes: readonly CommittedRowChange[]
): CommittedRowChange | undefined =>
  changes.find((change) =>
    capture.recordId === undefined
      ? change.event === 'insert' && change.tableName === capture.tableName
      : change.event === 'update' &&
        change.tableName === capture.tableName &&
        change.recordId === capture.recordId
  )

/**
 * Write, on `runner`, the evidence of each pending capture whose record
 * `changes` updated, or, for a capture naming no record, created.
 */
export const recordPendingSignatureEvidence = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  pending: readonly PendingSignatureEvidence[],
  changes: readonly CommittedRowChange[]
): Promise<void> => {
  const owed = pending.flatMap((capture) => {
    const change = changeStoring(capture, changes)
    return change === undefined ? [] : [{ capture, recordId: change.recordId }]
  })
  // One statement at a time: a transaction handle runs its statements in order.
  await owed.reduce<Promise<void>>(async (previous, { capture, recordId }) => {
    await previous
    if (capture.claim()) await capture.write(runner, dialect, recordId)
  }, Promise.resolve())
}

/**
 * Append `body` to a request's chain on `runner`, reading the head on the same
 * runner: for a caller already inside a transaction (an account erasure),
 * where the compare-and-set's retry is the transaction's own retry.
 */
export const appendChainEventOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly body: Omit<SignatureEventBody, 'seq'>
    readonly nowMs: number
  }
): Promise<ChainedSignatureEvent> => {
  const head = await readChainHeadOn(runner, dialect, input.requestId)
  const { event, canonicalBytes } = chainEventAfter(head, input.body)
  await insertChainEventOn(runner, dialect, {
    ...{ requestId: input.requestId, event, canonicalBytes },
    createdAtMs: input.nowMs,
  })
  return event
}

/** One request row, raw. */
export type RawRequestRow = Readonly<Record<string, unknown>>

/** The request `requestId`, raw, or `undefined`. */
export const readRequestOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<RawRequestRow | undefined> => {
  const rows = await executeRawTypedOn<RawRequestRow>(
    dialect.kind,
    runner,
    sql`SELECT id, flow_name, table_name, record_id, status, statements, document_hash,
               document_key, sealed_document_key, proof_key, created_at, expires_at,
               completed_at, keep_until
        FROM ${evidenceTable(dialect, 'signature_requests')} WHERE id = ${requestId}`
  )
  return rows[0]
}

/** The signers of `requestId`, raw, in signing order. */
export const readSignersOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawTypedOn<Record<string, unknown>>(
    dialect.kind,
    runner,
    sql`SELECT id, signer_name, position, status, field_name, identity_kind, signed_at
        FROM ${evidenceTable(dialect, 'signature_signers')}
        WHERE request_id = ${requestId} ORDER BY position ASC`
  )

/**
 * Rewrite one signature cell as `redact` leaves it, directly: the write-once
 * rule binds the writes people make, and an erasure is not one. A table or a
 * column that no longer exists is left alone.
 */
export const redactSignatureCellOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  cell: {
    readonly tableName: string
    readonly recordId: string
    readonly field: string
    readonly redact: (cell: unknown) => Readonly<Record<string, unknown>> | undefined
  }
): Promise<void> => {
  const table = sanitizeTableName(cell.tableName)
  if (table.length === 0) return
  const existing = await getExistingColumnNames(dialect.kind, runner, table, [cell.field])
  if (!existing.has(cell.field)) return
  const rows = await executeRawTypedOn<{ readonly cell: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT ${sql.identifier(cell.field)} AS cell FROM ${sql.identifier(table)}
        WHERE id = ${cell.recordId}`
  )
  const redacted = rows[0] === undefined ? undefined : cell.redact(rows[0].cell)
  if (redacted === undefined) return
  await executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(cell.field)} = ${dialect.sql.bindJsonb(redacted)}
        WHERE id = ${cell.recordId}`
  )
}

/**
 * Move a request to `status` and set `keep_until`, once: a request that has
 * one already keeps it, and the guard refuses any status after a terminal one.
 */
export const endRequestOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly status: string
    readonly endedAtMs: number
    readonly keepUntilMs: number
  }
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const ended = evidenceInstant(dialect, input.endedAtMs)
  const completedAt =
    input.status === 'completed' ? sql`COALESCE(completed_at, ${ended})` : sql`completed_at`
  return executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')}
        SET status = ${input.status}, completed_at = ${completedAt},
            keep_until = ${evidenceInstant(dialect, input.keepUntilMs)}
        WHERE id = ${input.requestId} AND keep_until IS NULL`
  )
}
