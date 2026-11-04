/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The statements of one-time codes and of the per-address signing budgets,
 * on either engine, each over a runner the caller holds.
 *
 * A challenge's tries only count upwards and its consumption is written once,
 * conditionally (the evidence guards refuse every other update). The address
 * budgets are rows of the shared token store (`auth.verification`), keyed by
 * `signing-address:<event>:<digest of the address>` and expiring with the
 * hour they count in, the store the second sign-in step keeps its lock
 * notices in: durable across restarts, and never an address in clear.
 */

import { sql } from 'drizzle-orm'
import { evidenceInstant, evidenceTable } from './signature-evidence-queries'
import { executeRawOn, executeRawTypedOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'

type Runner = Readonly<RawSqlRunner>
type Row = Readonly<Record<string, unknown>>

/** The identifier prefix of every signing-address budget row. */
export const SIGNING_ADDRESS_PREFIX = 'signing-address:'

/** The budget identifier of one event kind from one address digest. */
export const signingAddressIdentifier = (event: string, addressDigest: string): string =>
  `${SIGNING_ADDRESS_PREFIX}${event}:${addressDigest}`

/**
 * The challenges of one signer and channel: how many she received, the newest
 * instant, the tries. A challenge expired at birth is a code whose delivery
 * failed (`expireChallengeAtBirthOn`): it dates her cooldown but is not one
 * she received.
 */
export const challengeStandingOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly signerId: string; readonly channel: string }
) =>
  executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT COALESCE(SUM(CASE WHEN expires_at > created_at THEN 1 ELSE 0 END), 0) AS issued,
               MAX(created_at) AS last_issued_at,
               COALESCE(SUM(attempts), 0) AS attempts
        FROM ${evidenceTable(dialect, 'signature_challenges')}
        WHERE signer_id = ${input.signerId} AND channel = ${input.channel}`
  )

/** Insert one challenge: the HMAC of its code, never the code. */
export const insertChallengeOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly id: string
    readonly signerId: string
    readonly channel: string
    readonly codeHmac: string
    readonly documentHash: string
    readonly nowMs: number
    readonly expiresAtMs: number
  }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${evidenceTable(dialect, 'signature_challenges')}
          (id, signer_id, channel, code_hmac, attempts, expires_at, document_hash, created_at)
        VALUES (${input.id}, ${input.signerId}, ${input.channel}, ${input.codeHmac}, 0,
                ${evidenceInstant(dialect, input.expiresAtMs)}, ${input.documentHash},
                ${evidenceInstant(dialect, input.nowMs)})`
  )

/**
 * Mark a challenge whose code could not be delivered expired at birth. The
 * evidence guard freezes `expires_at`, so the row is replaced by one equal
 * but for it, on the caller's transaction; a challenge already consumed (none
 * can be: nobody received its code) is left alone.
 */
export const expireChallengeAtBirthOn = async (
  runner: Runner,
  dialect: Dialect,
  challenge: {
    readonly id: string
    readonly signerId: string
    readonly channel: string
    readonly codeHmac: string
    readonly documentHash: string
    readonly nowMs: number
  }
): Promise<void> => {
  const removed = await executeRawOn(
    dialect.kind,
    runner,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_challenges')}
        WHERE id = ${challenge.id} AND consumed_at IS NULL
        RETURNING id`
  )
  if (removed.length === 0) return
  await insertChallengeOn(runner, dialect, { ...challenge, expiresAtMs: challenge.nowMs })
}

/** One challenge row, or none. */
export const challengeRowOn = async (
  runner: Runner,
  dialect: Dialect,
  challengeId: string
): Promise<Row | undefined> =>
  (
    await executeRawTypedOn<Row>(
      dialect.kind,
      runner,
      sql`SELECT id, signer_id, channel, code_hmac, expires_at, consumed_at, document_hash
          FROM ${evidenceTable(dialect, 'signature_challenges')} WHERE id = ${challengeId}`
    )
  )[0]

/** Count one more try on a challenge. */
export const countChallengeTryOn = (runner: Runner, dialect: Dialect, challengeId: string) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_challenges')}
        SET attempts = attempts + 1 WHERE id = ${challengeId}`
  )

/** Consume one challenge, once; the rows it changed (none when it was already consumed). */
export const consumeChallengeOn = (
  runner: Runner,
  dialect: Dialect,
  input: { readonly challengeId: string; readonly nowMs: number }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`UPDATE ${evidenceTable(dialect, 'signature_challenges')}
        SET consumed_at = ${evidenceInstant(dialect, input.nowMs)}
        WHERE id = ${input.challengeId} AND consumed_at IS NULL
        RETURNING id`
  )

/** How many budget rows one identifier holds at or after `sinceMs` and not yet expired. */
export const addressEventCountOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly identifier: string; readonly sinceMs: number; readonly nowMs: number }
): Promise<number> => {
  const rows = await executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT COUNT(*) AS events FROM ${dialect.sql.authTableRef('verification')}
        WHERE identifier = ${input.identifier}
          AND created_at >= ${evidenceInstant(dialect, input.sinceMs)}
          AND expires_at > ${evidenceInstant(dialect, input.nowMs)}`
  )
  return Number(rows[0]?.['events'] ?? 0)
}

/** Insert one budget row, expiring at `untilMs`. */
export const insertAddressEventOn = (
  runner: Runner,
  dialect: Dialect,
  input: {
    readonly id: string
    readonly identifier: string
    readonly nowMs: number
    readonly untilMs: number
  }
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${dialect.sql.authTableRef('verification')}
          (id, identifier, value, expires_at, created_at, updated_at)
        VALUES (${input.id}, ${input.identifier}, ${'1'},
                ${evidenceInstant(dialect, input.untilMs)},
                ${evidenceInstant(dialect, input.nowMs)}, ${evidenceInstant(dialect, input.nowMs)})`
  )

/** Delete the codes of one signer, with her erasure: their digests are tied to her alone. */
export const deleteChallengesOfSignerOn = (runner: Runner, dialect: Dialect, signerId: string) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`DELETE FROM ${evidenceTable(dialect, 'signature_challenges')} WHERE signer_id = ${signerId}`
  )

/** How many challenges of one signer and channel a verification consumed, for one document. */
export const verifiedChallengeCountOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly signerId: string; readonly channel: string; readonly documentHash: string }
): Promise<number> => {
  const rows = await executeRawTypedOn<Row>(
    dialect.kind,
    runner,
    sql`SELECT COUNT(*) AS verified FROM ${evidenceTable(dialect, 'signature_challenges')}
        WHERE signer_id = ${input.signerId} AND channel = ${input.channel}
          AND document_hash = ${input.documentHash} AND consumed_at IS NOT NULL`
  )
  return Number(rows[0]?.['verified'] ?? 0)
}
