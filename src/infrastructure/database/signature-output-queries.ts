/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a completed signing request keeps its signed document and proof file.
 *
 * Both columns are write-once (the table's update trigger refuses changing a
 * key already set), so the write keeps any key already there: a second
 * completion of the same request records nothing new and fails nothing.
 */

import { sql } from 'drizzle-orm'
import { evidenceTable } from './signature-evidence-queries'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

/** Record the signed document and proof keys of `requestId`, keeping any already set. */
export const recordRequestOutputsOn = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: {
    readonly requestId: string
    readonly signedDocumentKey: string
    readonly proofKey: string
  }
): Promise<ReadonlyArray<Record<string, unknown>>> =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_requests')}
        SET sealed_document_key = COALESCE(sealed_document_key, ${input.signedDocumentKey}),
            proof_key = COALESCE(proof_key, ${input.proofKey})
        WHERE id = ${input.requestId}`
  )

/** The completed requests whose proof key is not recorded yet. */
export const completedWithoutOutputsOn = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect
): Promise<readonly string[]> =>
  (
    await executeRawTypedOn<{ readonly id: unknown }>(
      dialect.kind,
      runner,
      sql`SELECT id FROM ${evidenceTable(dialect, 'signature_requests')}
          WHERE status = 'completed' AND proof_key IS NULL`
    )
  ).map((row) => String(row.id))
