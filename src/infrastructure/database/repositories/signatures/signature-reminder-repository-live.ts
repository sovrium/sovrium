/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `SignatureReminderRepository` port over the signature tables. A
 * reminder's count, link rotation, clock and `reminded` event are written in
 * one transaction, so a reminder is either wholly given or not at all.
 */

import { Effect } from 'effect'
import {
  SignatureReminderRepository,
  type ReminderCandidate,
} from '@/application/ports/repositories/signatures/signature-reminder-repository'
import { DatabaseError } from '@/domain/errors'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
import {
  appendChainEventOn,
  isoOfStoredInstant,
} from '@/infrastructure/database/signature-evidence-queries'
import {
  dueReminderRowsOn,
  remindersSentOn,
  rotateReminderLinkOn,
} from '@/infrastructure/database/signature-reminder-queries'
import { subjectsOfSignerOn } from '@/infrastructure/database/signature-request-queries'
import { sentContactOf } from '@/infrastructure/database/signature-request-rows'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'
import { issueAccessToken } from '@/infrastructure/forms/access-token'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'
import type { RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'

const runner = (db: PortableDb | unknown): Readonly<RawSqlRunner> => db as Readonly<RawSqlRunner>

/** A stored instant as epoch milliseconds, or `undefined`. */
const epochOf = (value: unknown): number | undefined => {
  const iso = isoOfStoredInstant(value)
  return iso === undefined ? undefined : Date.parse(iso)
}

/** Each due row, with the contact the send froze for its signer. */
const candidatesOn = async (
  db: Readonly<RawSqlRunner>,
  dialect: Dialect,
  input: { readonly flowName: string; readonly notifiedBeforeMs: number; readonly nowMs: number }
): Promise<readonly ReminderCandidate[]> => {
  const rows = await dueReminderRowsOn(db, dialect, input)
  // One signer at a time: a batch never holds more than one pooled connection.
  return rows.reduce<Promise<readonly ReminderCandidate[]>>(async (previous, row) => {
    const done = await previous
    const signerId = String(row['signer_id'])
    const contact = sentContactOf(await subjectsOfSignerOn(db, dialect, signerId))
    return [
      ...done,
      {
        ...{ signerId, signerName: String(row['signer_name']) },
        ...{ requestId: String(row['request_id']), recordId: String(row['record_id']) },
        ...{ email: contact.email, displayName: contact.name },
        expiresAtMs: epochOf(row['expires_at']),
      },
    ]
  }, Promise.resolve([]))
}

export const SignatureReminderRepositoryLive = layerOverDatabase(SignatureReminderRepository, {
  due: (db, dialect) => (input) =>
    Effect.tryPromise({
      try: () => candidatesOn(runner(db), dialect, input),
      catch: (cause) => new DatabaseError('Failed to read the signers due a reminder', cause),
    }).pipe(
      Effect.withSpan('signatures.read-due-reminders', { attributes: { flow: input.flowName } })
    ),

  remind: (db, dialect) => (input) =>
    withPromiseTransaction(
      db,
      async (tx) => {
        const { candidate } = input
        const sent = await remindersSentOn(runner(tx), dialect, {
          ...{ requestId: candidate.requestId, signer: candidate.signerName },
        })
        if (sent >= input.max) return undefined
        const issued = issueAccessToken()
        const rotated = await rotateReminderLinkOn(runner(tx), dialect, {
          ...{ signerId: candidate.signerId, requestId: candidate.requestId },
          ...{ tokenHash: issued.hash, notifiedBeforeMs: input.notifiedBeforeMs },
          nowMs: input.nowMs,
        })
        if (rotated.length === 0) return undefined
        await appendChainEventOn(runner(tx), dialect, {
          ...{ requestId: candidate.requestId, body: input.event(sent + 1) },
          nowMs: input.nowMs,
        })
        return { token: issued.token, reminder: sent + 1 }
      },
      (cause) => new DatabaseError('Failed to give a signing reminder', cause)
    ).pipe(Effect.withSpan('signatures.give-reminder')),
})
