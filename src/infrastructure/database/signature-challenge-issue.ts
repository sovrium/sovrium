/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A new one-time code, admitted and recorded in one transaction, before it is
 * sent.
 *
 * The cooldown and the budgets are a read followed by two writes; run apart,
 * N requests for a code arriving together all read the same standing, all
 * pass, and N codes go out. Here the read, the judgement and the writes share
 * one transaction, opened by the request's write lock (`lockRequestOn`) and,
 * on PostgreSQL, a transaction-scoped advisory lock on the address budget, so
 * a second request reads what the first one wrote and is refused by its
 * cooldown. SQLite needs neither: its transaction is `BEGIN IMMEDIATE`,
 * serialised against every other statement on the one connection
 * (`sqlite-serialized-client.ts`); the request lock is taken anyway, a no-op
 * there. The two locks are always taken in the same order, request then
 * address, so two requests sharing an address cannot deadlock.
 */

import { sql } from 'drizzle-orm'
import {
  addressEventCountOn,
  challengeStandingOn,
  insertAddressEventOn,
  insertChallengeOn,
} from './signature-challenge-queries'
import { lockRequestOn } from './signature-request-sign-with'
import { executeRawOn, type RawSqlRunner } from './sql/dialect-execute'
import type { Dialect } from './drizzle/layer'
import type { SignerCodeStanding } from '@/domain/models/app/signatures/signature-challenge-service'

type Runner = Readonly<RawSqlRunner>

/** A stored instant as epoch milliseconds: a `Date`, an ISO string or a number. */
export const epochOf = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) return value.getTime()
  const parsed = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(parsed)) return parsed
  const date = Date.parse(String(value))
  return Number.isNaN(date) ? undefined : date
}

/** Where a signer stands with her codes of one channel, read on `runner`. */
const standingOn = async (
  runner: Runner,
  dialect: Dialect,
  input: { readonly signerId: string; readonly channel: string }
): Promise<SignerCodeStanding> => {
  const [row] = await challengeStandingOn(runner, dialect, input)
  return {
    issued: Number(row?.['issued'] ?? 0),
    lastIssuedAtMs: epochOf(row?.['last_issued_at']),
    attempts: Number(row?.['attempts'] ?? 0),
  }
}

/** Hold one address budget until the transaction ends; PostgreSQL only (see the module note). */
const lockAddressBudgetOn = async (
  runner: Runner,
  dialect: Dialect,
  identifier: string
): Promise<void> => {
  if (dialect.kind === 'sqlite') return
  await executeRawOn(
    dialect.kind,
    runner,
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${identifier}, 0))`
  )
}

/** A code to admit: the challenge it records, and the budget it counts against. */
export interface ChallengeIssueOnInput<R> {
  readonly requestId: string
  /** The address budget's identifier (`signingAddressIdentifier`). */
  readonly addressIdentifier: string
  readonly challenge: {
    readonly id: string
    readonly signerId: string
    readonly channel: string
    readonly codeHmac: string
    readonly documentHash: string
    readonly expiresAtMs: number
  }
  readonly nowMs: number
  /** The instant the address budget counts from. */
  readonly sinceMs: number
  /** When the address event recorded now stops counting. */
  readonly untilMs: number
  /** Why the code is refused, judged on what the locks settled; `undefined` admits it. */
  readonly refuse: (facts: {
    readonly standing: SignerCodeStanding
    readonly sentFromAddress: number
  }) => R | undefined
}

/**
 * Admit a code and record it, on the transaction `tx`: the request and the
 * address locked, the signer's standing and the address budget read, then,
 * unless `refuse` names a refusal, the address event and the challenge
 * inserted. Resolves to the refusal, or `undefined` once recorded.
 */
export const issueChallengeWithinBudgetsOn = async <R>(
  tx: Runner,
  dialect: Dialect,
  input: ChallengeIssueOnInput<R>
): Promise<R | undefined> => {
  const { challenge, nowMs } = input
  await lockRequestOn(tx, dialect, input.requestId)
  await lockAddressBudgetOn(tx, dialect, input.addressIdentifier)
  const standing = await standingOn(tx, dialect, challenge)
  const sentFromAddress = await addressEventCountOn(tx, dialect, {
    ...{ identifier: input.addressIdentifier, sinceMs: input.sinceMs, nowMs },
  })
  const refused = input.refuse({ standing, sentFromAddress })
  if (refused !== undefined) return refused
  await insertAddressEventOn(tx, dialect, {
    ...{ id: crypto.randomUUID(), identifier: input.addressIdentifier },
    ...{ nowMs, untilMs: input.untilMs },
  })
  await insertChallengeOn(tx, dialect, { ...challenge, nowMs })
  return undefined
}
