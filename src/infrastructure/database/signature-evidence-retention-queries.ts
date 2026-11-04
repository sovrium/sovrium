/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The statements the evidence of a signing request is let go with, on either
 * engine, each over a runner the caller holds.
 *
 * Every request's rows go in the one order the foreign keys allow: the chain,
 * the subjects, the challenges, the signers, then the request. The database
 * itself decides whether the chain may go (its delete guard admits a chain row
 * only once its request's `keep_until` has passed), so nothing here can delete
 * evidence before its time: a refused chain delete fails the transaction, and
 * every row of the request stays.
 *
 * A signature captured on a record keeps no retention of its own. When its
 * record goes for good, its request's `keep_until` (write-once, still empty)
 * is set to the epoch, the one write the request guard allows on an ended
 * request, and its rows then go in the same order, in the same transaction.
 */

import { sql } from 'drizzle-orm'
import { RECORD_CAPTURE_FLOW_PREFIX } from '@/domain/models/app/signatures/signature-capture-service'
import { evidenceInstant, evidenceTable } from './signature-evidence-queries'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

/** The most requests one sweep pass lets go; the next pass takes the rest. */
export const RETENTION_SWEEP_BATCH = 100

/** The requests whose `keep_until` is before `nowMs`, oldest first. */
export const dueForDeletionOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  nowMs: number
): Promise<readonly string[]> => {
  const rows = await executeRawTypedOn<{ readonly id: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
        WHERE keep_until IS NOT NULL AND keep_until < ${evidenceInstant(dialect, nowMs)}
        ORDER BY keep_until ASC LIMIT ${RETENTION_SWEEP_BATCH}`
  )
  return rows.map((row) => String(row.id))
}

/** Delete every row of request `requestId`, in key order. */
export const deleteRequestRowsOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<void> => {
  const signers = sql`SELECT id FROM ${evidenceTable(dialect, 'signature_signers')} WHERE request_id = ${requestId}`
  const statements = [
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_evidence')} WHERE request_id = ${requestId}`,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_subjects')} WHERE request_id = ${requestId}`,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_challenges')} WHERE signer_id IN (${signers})`,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_signers')} WHERE request_id = ${requestId}`,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_requests')} WHERE id = ${requestId}`,
  ]
  // One statement at a time: a transaction handle runs its statements in order.
  await statements.reduce<Promise<unknown>>(async (previous, statement) => {
    await previous
    return executeRawOn(dialect.kind, runner, statement)
  }, Promise.resolve(undefined))
}

/** The requests of the signatures captured on one record: those that belong to no flow. */
export const recordCaptureRequestsOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  record: { readonly tableName: string; readonly recordId: string }
): Promise<readonly string[]> => {
  const rows = await executeRawTypedOn<{ readonly id: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
        WHERE table_name = ${record.tableName} AND record_id = ${record.recordId}
          AND flow_name LIKE ${`${RECORD_CAPTURE_FLOW_PREFIX}%`}`
  )
  return rows.map((row) => String(row.id))
}

/**
 * End the retention of a signature captured on a record, whose record is
 * going: its `keep_until`, empty until now, set to the epoch, so the chain's
 * delete guard admits its rows on whatever clock the database reads.
 */
export const closeRecordCaptureOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  requestId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')}
        SET keep_until = ${evidenceInstant(dialect, 0)}
        WHERE id = ${requestId} AND keep_until IS NULL
          AND flow_name LIKE ${`${RECORD_CAPTURE_FLOW_PREFIX}%`}`
  )

/** Whether any request has a retention date: what the sweep has to look after. */
export const anyRetainedRequestOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect
): Promise<boolean> => {
  const rows = await executeRawTypedOn<{ readonly id: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
        WHERE keep_until IS NOT NULL LIMIT 1`
  )
  return rows.length > 0
}

/** The signer rows the account `userId` signed with, and their requests, raw. */
export const accountSignerRowsOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  userId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawTypedOn<Record<string, unknown>>(
    dialect.kind,
    runner,
    sql`SELECT s.id AS signer_id, s.request_id, s.signer_name, s.field_name, s.signed_at,
               s.identity_kind, r.flow_name, r.table_name, r.record_id, r.statements
        FROM ${evidenceTable(dialect, 'signature_signers')} AS s
        JOIN ${evidenceTable(dialect, 'signature_requests')} AS r ON r.id = s.request_id
        WHERE s.user_id = ${userId} AND s.status = 'signed'
        ORDER BY s.signed_at ASC`
  )

/** The contact details the subject rows of one signer keep. */
export const signerContactRowsOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  signerId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawTypedOn<Record<string, unknown>>(
    dialect.kind,
    runner,
    sql`SELECT name, email, phone FROM ${evidenceTable(dialect, 'signature_subjects')}
        WHERE signer_id = ${signerId} ORDER BY created_at ASC`
  )

/** Clear one signer's account link: the one rewrite of her row an erasure makes. */
export const clearSignerAccountOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  signerId: string
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')} SET user_id = NULL
        WHERE id = ${signerId} AND user_id IS NOT NULL`
  )

/** Link one signer of a request to an account, once: a linked signer keeps her link. */
export const linkSignerAccountOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: { readonly requestId: string; readonly signerName: string; readonly userId: string }
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')} SET user_id = ${input.userId}
        WHERE request_id = ${input.requestId} AND signer_name = ${input.signerName}
          AND user_id IS NULL`
  )
