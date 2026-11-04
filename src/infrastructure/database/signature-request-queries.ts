/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The statements a signing request moves with, on either engine, each over a
 * runner the caller holds: the database client, or an open transaction.
 *
 * Every transition is a conditional update answering the rows it changed
 * (`RETURNING id`): a request moves from an open status only while it is
 * still open, and a signer from invited only while she is still invited, so
 * two writers racing (two signers, a signer and a cancel, the sweep and a
 * signer) settle on the row lock and the loser changes nothing. The evidence
 * guards (the migration's triggers) refuse everything these never write.
 */

import { sql, type SQL } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { evidenceInstant, evidenceTable } from './signature-evidence-queries'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

type Runner = Readonly<RawSqlRunner>
type Row = Readonly<Record<string, unknown>>

/** `values` as a parenthesised SQL list of bound parameters. */
const listOf = (values: readonly string[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )

/** The statuses of a request still taking signatures, declines, a cancel or an expiry. */
const OPEN = ['pending', 'signing'] as const

/** The statuses of a request that has not ended. */
const UNENDED = ['pending', 'signing', 'sealing'] as const

/** Insert one request row, `pending`, with its frozen statements and document. */
export const insertRequestOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly id: string
    readonly flowName: string
    readonly tableName: string
    readonly recordId: string
    readonly signingOrder: string
    readonly statements: Readonly<Record<string, string>>
    readonly documentHash: string
    readonly documentKey: string
    readonly createdAtMs: number
    readonly expiresAtMs: number
  }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_requests')}
          (id, flow_name, table_name, record_id, status, signing_order, statements,
           document_hash, document_key, created_at, expires_at)
        VALUES (${input.id}, ${input.flowName}, ${input.tableName}, ${input.recordId}, 'pending',
                ${input.signingOrder}, ${dialect.sql.bindJsonb(input.statements)},
                ${input.documentHash}, ${input.documentKey},
                ${evidenceInstant(dialect, input.createdAtMs)},
                ${evidenceInstant(dialect, input.expiresAtMs)})`
  )

/** Insert one signer row: waiting, or invited with her token's digest. */
export const insertSignerOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly id: string
    readonly requestId: string
    readonly signerName: string
    readonly position: number
    readonly fieldName: string
    readonly identityKind: string
    readonly tokenHash?: string | undefined
    readonly tokenExpiresAtMs: number
    readonly createdAtMs: number
  }
) => {
  const at = evidenceInstant(dialect, input.createdAtMs)
  const invited = input.tokenHash !== undefined
  return executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_signers')}
          (id, request_id, signer_name, position, status, token_hash, token_expires_at,
           field_name, delivered_at, last_notified_at, identity_kind, created_at)
        VALUES (${input.id}, ${input.requestId}, ${input.signerName}, ${input.position},
                ${invited ? 'invited' : 'waiting'}, ${input.tokenHash ?? null},
                ${invited ? evidenceInstant(dialect, input.tokenExpiresAtMs) : null},
                ${input.fieldName}, ${invited ? at : null}, ${invited ? at : null},
                ${input.identityKind}, ${at})`
  )
}

/** The id and status of the request of `flowName` on one record that has not ended, if any. */
export const unendedRequestOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly flowName: string; readonly tableName: string; readonly recordId: string }
): Promise<Row | undefined> =>
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT id, status FROM ${evidenceTable(dialect, 'signature_requests')}
          WHERE flow_name = ${input.flowName} AND table_name = ${input.tableName}
            AND record_id = ${input.recordId} AND status IN (${listOf(UNENDED)})
          ORDER BY created_at DESC LIMIT 1`
    )
  )[0]

/** Whether a record has a request of one of `flowNames` that has not ended. */
export const hasUnendedRequestOn = async (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly tableName: string
    readonly recordId: string
    readonly flowNames: readonly string[]
  }
): Promise<boolean> =>
  input.flowNames.length > 0 &&
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
          WHERE table_name = ${input.tableName} AND record_id = ${input.recordId}
            AND flow_name IN (${listOf(input.flowNames)}) AND status IN (${listOf(UNENDED)})
          LIMIT 1`
    )
  ).length > 0

/** The signer a token digest names, with her request: everything a signing session reads. */
export const signingSessionOn = async (
  runner: Runner,
  dialect: Dialect,
  tokenHash: string
): Promise<Row | undefined> =>
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT g.id AS signer_id, g.signer_name, g.position, g.status AS signer_status,
                 g.field_name, g.identity_kind, g.token_expires_at,
                 r.id AS request_id, r.flow_name, r.table_name, r.record_id, r.status,
                 r.statements, r.document_hash, r.document_key, r.signing_order, r.expires_at
          FROM ${evidenceTable(dialect, 'signature_signers')} AS g
          JOIN ${evidenceTable(dialect, 'signature_requests')} AS r ON r.id = g.request_id
          WHERE g.token_hash = ${tokenHash} LIMIT 1`
    )
  )[0]

/** The signer `signerId` with her request, as a signing session the page cookie names reads it. */
export const signingSessionBySignerOn = async (
  runner: Runner,
  dialect: Dialect,
  signerId: string
): Promise<Row | undefined> =>
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT g.id AS signer_id, g.signer_name, g.position, g.status AS signer_status,
                 g.field_name, g.identity_kind, g.token_expires_at,
                 r.id AS request_id, r.flow_name, r.table_name, r.record_id, r.status,
                 r.statements, r.document_hash, r.document_key, r.signing_order, r.expires_at
          FROM ${evidenceTable(dialect, 'signature_signers')} AS g
          JOIN ${evidenceTable(dialect, 'signature_requests')} AS r ON r.id = g.request_id
          WHERE g.id = ${signerId} LIMIT 1`
    )
  )[0]

/** The subject rows of one signer, oldest first: the one the send wrote, then the ones signing wrote. */
export const subjectsOfSignerOn = (runner: Runner, dialect: Dialect, signerId: string) =>
  executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT name, email, phone, salts FROM ${evidenceTable(dialect, 'signature_subjects')}
        WHERE signer_id = ${signerId} ORDER BY created_at ASC`
  )

/** Mark one invited signer signed, her signing link cleared; the rows it changed (none when she was not invited). */
export const claimSignerOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly signerId: string; readonly nowMs: number }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')}
        SET status = 'signed', signed_at = ${evidenceInstant(dialect, input.nowMs)},
            token_hash = NULL, token_expires_at = NULL
        WHERE id = ${input.signerId} AND status IN ('invited', 'verified')
        RETURNING id`
  )

/** Mark one invited signer declined, her signing link cleared; the rows it changed. */
export const declineSignerOn = (runner: Runner, dialect: Dialect, signerId: string) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')}
        SET status = 'declined', token_hash = NULL, token_expires_at = NULL
        WHERE id = ${signerId} AND status IN ('invited', 'verified')
        RETURNING id`
  )

/** Move an open request to `status`, still open or sealing; the rows it changed. */
export const advanceOpenRequestOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly requestId: string; readonly status: 'signing' | 'sealing' }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')} SET status = ${input.status}
        WHERE id = ${input.requestId} AND status IN (${listOf(OPEN)})
        RETURNING id`
  )

/**
 * End a request that stands in one of `from`: its status, `completed_at` for a
 * completed one, the level its seal reached, and the date its evidence may
 * go. The rows it changed.
 */
export const endRequestFromOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly from: readonly string[]
    readonly status: 'completed' | 'declined' | 'cancelled' | 'expired'
    readonly endedAtMs: number
    readonly keepUntilMs: number
    /** The level a completion's seal reached; the column is left as it stands when absent. */
    readonly sealLevel?: 'none' | 'b-b' | 'b-t' | undefined
  }
) => {
  const ended = evidenceInstant(dialect, input.endedAtMs)
  const completedAt = input.status === 'completed' ? sql`${ended}` : sql`completed_at`
  const sealLevel = input.sealLevel === undefined ? sql`seal_level` : sql`${input.sealLevel}`
  return executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')}
        SET status = ${input.status}, completed_at = ${completedAt}, seal_level = ${sealLevel},
            keep_until = ${evidenceInstant(dialect, input.keepUntilMs)}
        WHERE id = ${input.requestId} AND status IN (${listOf(input.from)})
          AND keep_until IS NULL
        RETURNING id`
  )
}

/** The open statuses, for a caller ending an open request. */
export const OPEN_REQUEST_STATUSES: readonly string[] = OPEN

/** How many signers of a request have not signed. */
export const unsignedCountOn = async (
  runner: Runner,
  dialect: Dialect,
  requestId: string
): Promise<number> => {
  const rows = await executeRawTypedOn<{ readonly n: unknown }>(
    dialect.kind,
    runner,
    sql`SELECT COUNT(*) AS n FROM ${evidenceTable(dialect, 'signature_signers')}
        WHERE request_id = ${requestId} AND status <> 'signed'`
  )
  return Number(rows[0]?.n ?? 0)
}

/** Invite the waiting signer at `position`; her name when she was waiting, else none. */
export const inviteSignerOn = async (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly position: number
    readonly tokenHash: string
    readonly tokenExpiresAtMs: number
    readonly nowMs: number
  }
): Promise<Row | undefined> => {
  const now = evidenceInstant(dialect, input.nowMs)
  return (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`UPDATE ${evidenceTable(dialect, 'signature_signers')}
          SET status = 'invited', token_hash = ${input.tokenHash},
              token_expires_at = ${evidenceInstant(dialect, input.tokenExpiresAtMs)},
              delivered_at = ${now}, last_notified_at = ${now}
          WHERE request_id = ${input.requestId} AND position = ${input.position}
            AND status = 'waiting'
          RETURNING id, signer_name`
    )
  )[0]
}

/** The ids of the open requests whose deadline passed before `nowMs`. */
export const overdueRequestIdsOn = async (
  runner: Runner,
  dialect: Dialect,
  nowMs: number
): Promise<readonly string[]> =>
  (
    await executeRawTypedOn<{ readonly id: unknown }>(
      dialect.kind,
      runner,
      sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
          WHERE status IN (${listOf(OPEN)}) AND expires_at IS NOT NULL
            AND expires_at < ${evidenceInstant(dialect, nowMs)}
          ORDER BY expires_at ASC LIMIT 500`
    )
  ).map((row) => String(row.id))

/** The ids of the requests every signer has signed, still to be completed. */
export const sealingRequestIdsOn = async (
  runner: Runner,
  dialect: Dialect
): Promise<readonly string[]> =>
  (
    await executeRawTypedOn<{ readonly id: unknown }>(
      dialect.kind,
      runner,
      sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
          WHERE status = 'sealing' ORDER BY created_at ASC LIMIT 500`
    )
  ).map((row) => String(row.id))

/** The request `requestId` with its order, raw. */
export const requestRowOn = async (
  runner: Runner,
  dialect: Dialect,
  requestId: string
): Promise<Row | undefined> =>
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT id, flow_name, table_name, record_id, status, signing_order, statements,
                 document_hash, document_key, sealed_document_key, proof_key, seal_level,
                 created_at, expires_at, completed_at, keep_until
          FROM ${evidenceTable(dialect, 'signature_requests')} WHERE id = ${requestId}`
    )
  )[0]

/**
 * Write one text cell of a record directly, inside the transaction of the
 * signature that moves its request: the status a flow writes back. A table or
 * column that no longer exists is left alone.
 */
export const writeStatusCellOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly tableName: string
    readonly recordId: string
    readonly field: string
    readonly value: string
  }
) => {
  const table = sanitizeTableName(input.tableName)
  if (table.length === 0) return Promise.resolve([])
  return executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(input.field)} = ${input.value}
        WHERE id = ${input.recordId}`
  )
}
