/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reads behind the operator's list of signing requests, on either engine:
 * the newest requests, then the signers of all of them in one statement. The
 * signers read also serves one request's detail, with a one-id list.
 *
 * Neither reads a column the list never shows: no token digest, no document
 * fingerprint, and of the subject rows only the display name the send kept.
 */

import { sql } from 'drizzle-orm'
import { evidenceTable } from './signature-evidence-queries'
import { executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

type Runner = Readonly<RawSqlRunner>
type Row = Readonly<Record<string, unknown>>

/** The newest `limit` requests, newest first. */
export const recentRequestRowsOn = (runner: Runner, dialect: Dialect, limit: number) =>
  executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT id, flow_name, table_name, record_id, status, signing_order, seal_level,
               created_at, expires_at, completed_at, keep_until
        FROM ${evidenceTable(dialect, 'signature_requests')}
        ORDER BY created_at DESC, id DESC LIMIT ${limit}`
  )

/**
 * The signers of `requestIds`, each request's in order, each with the name the
 * send kept for her (the first subject row that carries one).
 */
export const signersOfRequestsOn = async (
  runner: Runner,
  dialect: Dialect,
  requestIds: readonly string[]
): Promise<readonly Row[]> =>
  requestIds.length === 0
    ? []
    : executeRawTypedOn<Row>(
        dialect.kind,
        runner,
        sql`SELECT g.id, g.request_id, g.signer_name, g.position, g.status, g.field_name,
                   g.signed_at,
                   (SELECT s.name FROM ${evidenceTable(dialect, 'signature_subjects')} AS s
                    WHERE s.signer_id = g.id AND s.name IS NOT NULL
                    ORDER BY s.created_at ASC LIMIT 1) AS display_name
            FROM ${evidenceTable(dialect, 'signature_signers')} AS g
            WHERE g.request_id IN (${sql.join(
              requestIds.map((id) => sql`${id}`),
              sql`, `
            )})
            ORDER BY g.request_id ASC, g.position ASC`
      )
