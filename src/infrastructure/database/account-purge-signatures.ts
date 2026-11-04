/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signatures half of an erasure: every `signature` cell the erased person
 * gave — found by its image, an object she uploaded, or by the account a
 * version 2 value names — loses her name, her account id and its image key, and keeps what she agreed to (`signature-erasure-service.ts`).
 *
 * Runs inside the erasure transaction, BEFORE her objects are removed, and
 * writes the cell directly: the write-once rule binds user writes, and this is
 * not one. An image she uploaded outside the evidence namespace goes with every
 * other object she uploaded (`account-purge-objects.ts`); one under it is
 * evidence, kept until its request's retention ends.
 *
 * Her side of every signing request she took part in goes too
 * ({@link eraseSignatureSubjectsOf}): her `signature_subjects` rows — name,
 * address, phone, network address, browser, a decline's reason and the salts
 * that open the chain's commitments to them — are deleted, and an `erased` event is
 * appended to each request's chain, while the account row still exists (the
 * signer row's account link is cleared by its FK when the account goes).
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { parseCanonicalEvent } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { erasedSignature } from '@/domain/models/app/tables/fields/field-types/media/signature-erasure-service'
import { deleteChallengesOfSignerOn } from '@/infrastructure/database/signature-challenge-queries'
import {
  appendChainEventOn,
  deleteSubjectsOfSignerOn,
  evidenceTable,
  readChainOn,
} from '@/infrastructure/database/signature-evidence-queries'
import { executeRawOn, executeRawTypedOn } from '@/infrastructure/database/sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import { isUniqueConstraintViolation } from './table-queries/mutation-helpers/create-record-helpers'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/** One app table and its `signature` columns. */
export interface SignatureColumns {
  readonly name: string
  readonly signatureColumns?: readonly string[]
}

/** The `signature` fields of one declared table. */
export const signatureFieldNames = (
  tables:
    | ReadonlyArray<{
        readonly name: string
        readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
      }>
    | undefined,
  tableName: string
): readonly string[] =>
  (tables?.find((table) => table.name === tableName)?.fields ?? [])
    .filter((field) => field.type === 'signature')
    .map((field) => field.name)

/** What identifies her signatures: the objects she uploaded, and her account. */
interface Signer {
  readonly uploadedKeys: ReadonlySet<string>
  readonly userId: string
}

/** Redact one column of one table: every cell that is hers. */
async function redactColumn(
  { tx, dialect }: TransactionOn,
  table: string,
  column: string,
  signer: Signer
): Promise<void> {
  const rows = await executeRawTypedOn<{ readonly id: unknown; readonly cell: unknown }>(
    dialect.kind,
    tx,
    sql`SELECT id, ${sql.identifier(column)} AS cell FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} IS NOT NULL`
  )
  for (const row of rows) {
    const erased = erasedSignature(row.cell, signer.uploadedKeys, signer.userId)
    if (erased === undefined) continue
    await executeRawOn(
      dialect.kind,
      tx,
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${dialect.sql.bindJsonb(erased)} WHERE id = ${row.id}`
    )
  }
}

/**
 * Strip the erased person from every signature she gave, across the app's
 * tables. A no-op when no table has a signature field.
 */
export async function redactErasedSignatures(
  { tx, dialect }: TransactionOn,
  tables: readonly SignatureColumns[],
  her: { readonly uploadedKeys: readonly string[]; readonly userId: string }
): Promise<void> {
  const signer = { uploadedKeys: new Set(her.uploadedKeys), userId: her.userId }
  for (const table of tables) {
    const name = sanitizeTableName(table.name)
    const columns = table.signatureColumns ?? []
    if (name.length === 0 || columns.length === 0) continue
    const existing = await getExistingColumnNames(dialect.kind, tx, name, columns)
    for (const column of columns.filter((c) => existing.has(c))) {
      await redactColumn({ tx, dialect }, name, column, signer)
    }
  }
}

/** How many times an erasure re-reads a chain head that moved before giving up. */
const APPEND_ATTEMPTS = 5

/** The savepoint one append attempt runs under, inside the erasure's transaction. */
const SAVEPOINT = {
  open: sql`SAVEPOINT signature_erasure_append`,
  release: sql`RELEASE SAVEPOINT signature_erasure_append`,
  rollback: sql`ROLLBACK TO SAVEPOINT signature_erasure_append`,
} as const

/** Whether the chain of `requestId` already records `signer` as erased. */
async function alreadyErased(
  { tx, dialect }: TransactionOn,
  requestId: string,
  signer: string
): Promise<boolean> {
  const chain = await readChainOn(tx, dialect, requestId)
  return chain
    .map((row) => parseCanonicalEvent(row.canonicalBytes))
    .some((event) => event?.type === 'erased' && event.signer === signer)
}

/**
 * Append one `erased` event for `signer`, unless the chain already has one.
 *
 * A compare-and-set inside the erasure's transaction: each attempt runs under
 * a savepoint, and an insert that loses `UNIQUE(request_id, seq)` to another
 * writer (a signer of the same request, an erasure on request) rolls back to
 * it, reads the head again and hashes again, so a concurrent append never
 * fails the whole erasure. An erasure that won first is found on the retry,
 * and none is appended twice.
 */
async function appendErasedOnce(
  on: TransactionOn,
  signer: { readonly requestId: string; readonly name: string },
  nowMs: number,
  attempt = 1
): Promise<void> {
  const { tx, dialect } = on
  await executeRawOn(dialect.kind, tx, SAVEPOINT.open)
  try {
    if (!(await alreadyErased(on, signer.requestId, signer.name))) {
      await appendChainEventOn(tx, dialect, {
        requestId: signer.requestId,
        body: {
          ...{ type: 'erased', at: new Date(nowMs).toISOString(), signer: signer.name },
          data: { reason: 'account-erasure' },
        },
        nowMs,
      })
    }
    await executeRawOn(dialect.kind, tx, SAVEPOINT.release)
  } catch (error) {
    await executeRawOn(dialect.kind, tx, SAVEPOINT.rollback)
    if (!isUniqueConstraintViolation(error) || attempt >= APPEND_ATTEMPTS) throw error
    await appendErasedOnce(on, signer, nowMs, attempt + 1)
  }
}

/**
 * Erase her from every signing request she signed with her account: her
 * subject rows deleted and one `erased` event appended per request, on the
 * erasure's own transaction. A signer already erased (no subject row left)
 * gains no second event, nor does one whose chain already records her
 * erasure.
 */
export async function eraseSignatureSubjectsOf(
  { tx, dialect }: TransactionOn,
  userId: string
): Promise<void> {
  const signers = await executeRawTypedOn<{
    readonly id: unknown
    readonly request_id: unknown
    readonly signer_name: unknown
  }>(
    dialect.kind,
    tx,
    sql`SELECT s.id, s.request_id, s.signer_name FROM ${evidenceTable(dialect, 'signature_signers')} AS s
        WHERE s.user_id = ${userId} AND EXISTS (
          SELECT 1 FROM ${evidenceTable(dialect, 'signature_subjects')} AS p WHERE p.signer_id = s.id
        )`
  )
  const now = Date.now()
  for (const signer of signers) {
    await deleteSubjectsOfSignerOn(tx, dialect, String(signer.id))
    await deleteChallengesOfSignerOn(tx, dialect, String(signer.id))
    await appendErasedOnce(
      { tx, dialect },
      { requestId: String(signer.request_id), name: String(signer.signer_name) },
      now
    )
  }
}

/**
 * Everything an account erasure does to the signatures she gave: her cells
 * redacted ({@link redactErasedSignatures}), then her side of every signing
 * request erased ({@link eraseSignatureSubjectsOf}), on the erasure's
 * transaction and before her account row goes.
 */
export async function settleErasedSignatures(
  on: TransactionOn,
  tables: readonly SignatureColumns[],
  her: { readonly uploadedKeys: readonly string[]; readonly userId: string }
): Promise<void> {
  await redactErasedSignatures(on, tables, her)
  await eraseSignatureSubjectsOf(on, her.userId)
}
