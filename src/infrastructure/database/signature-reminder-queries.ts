/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SQL of signing reminders (`signature-reminder-repository-live.ts`).
 *
 * A reminder moves `last_notified_at` and rotates `token_hash` on the
 * signer's row (both moves the evidence guard allows), conditioned on her
 * clock still being as old as the sweep read it: two overlapping ticks give
 * one reminder.
 */

import { sql } from 'drizzle-orm'
import { parseCanonicalEvent } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import { remindersSentTo } from '@/domain/models/app/signatures/signature-reminder-service'
import { evidenceInstant, evidenceTable, readChainOn } from './signature-evidence-queries'
import { OPEN_REQUEST_STATUSES } from './signature-request-queries'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

type Runner = Readonly<RawSqlRunner>
type Row = Readonly<Record<string, unknown>>

/** The signer statuses whose turn has come and who have not signed. */
const AWAITING = ['invited', 'verified'] as const

/** The most signers one sweep reminds per flow; the next tick takes the rest. */
const DUE_BATCH = 200

const listOf = (values: readonly string[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `
  )

/** The signers of `flowName` due a reminder: open request, before its deadline, quiet since `notifiedBeforeMs`. */
export const dueReminderRowsOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly flowName: string; readonly notifiedBeforeMs: number; readonly nowMs: number }
) =>
  executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT g.id AS signer_id, g.signer_name, g.request_id, r.record_id, r.expires_at
        FROM ${evidenceTable(dialect, 'signature_signers')} AS g
        JOIN ${evidenceTable(dialect, 'signature_requests')} AS r ON r.id = g.request_id
        WHERE r.flow_name = ${input.flowName}
          AND r.status IN (${listOf(OPEN_REQUEST_STATUSES)})
          AND g.status IN (${listOf(AWAITING)})
          AND g.last_notified_at IS NOT NULL
          AND g.last_notified_at <= ${evidenceInstant(dialect, input.notifiedBeforeMs)}
          AND (r.expires_at IS NULL OR r.expires_at > ${evidenceInstant(dialect, input.nowMs)})
        ORDER BY g.last_notified_at ASC LIMIT ${DUE_BATCH}`
  )

/** The reminders the chain of `requestId` records for `signer`. */
export const remindersSentOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly requestId: string; readonly signer: string }
): Promise<number> => {
  const chain = await readChainOn(runner, dialect, input.requestId)
  const events = chain.flatMap((row) => parseCanonicalEvent(row.canonicalBytes) ?? [])
  return remindersSentTo(events, input.signer)
}

/**
 * Rotate one signer's link and move her reminder clock, if she still awaits
 * her turn on an open request and no other tick reminded her since
 * `notifiedBeforeMs`; the rows it changed.
 */
export const rotateReminderLinkOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly signerId: string
    readonly requestId: string
    readonly tokenHash: string
    readonly notifiedBeforeMs: number
    readonly nowMs: number
  }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_signers')}
        SET token_hash = ${input.tokenHash},
            last_notified_at = ${evidenceInstant(dialect, input.nowMs)}
        WHERE id = ${input.signerId} AND status IN (${listOf(AWAITING)})
          AND last_notified_at <= ${evidenceInstant(dialect, input.notifiedBeforeMs)}
          AND EXISTS (SELECT 1 FROM ${evidenceTable(dialect, 'signature_requests')}
                      WHERE id = ${input.requestId}
                        AND status IN (${listOf(OPEN_REQUEST_STATUSES)}))
        RETURNING id`
  )
