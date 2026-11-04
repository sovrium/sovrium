/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The webhook outbox: `system.webhook_outbox` (one row per delivery a
 * committed record write owes) and `system.webhook_outbox_subjects` (the users
 * each delivery names).
 *
 * Rows are written by {@link recordCommittedDeliveries} INSIDE the write's
 * transaction, and moved through their life by the delivery engine
 * (`record-webhook-dispatcher-live.ts`): claimed with a lease, attempted, then
 * `delivered`, parked until `next_attempt_at`, or `dead`.
 *
 * Every claim is a compare-and-set on `status = 'pending'`, a due
 * `next_attempt_at` and an expired (or absent) lease, so two processes — or
 * the minute sweep and a write's own attempt — never deliver the same row at
 * the same time, and a parked retry is never attempted before its backoff.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { WebhookOutboxScope } from '@/application/ports/services/record-webhook-dispatcher'
import { DatabaseError, type PortableTx } from '@/infrastructure/database'
import {
  recordPendingSignatureEvidence,
  SignatureEvidenceScope,
} from '@/infrastructure/database/signature-evidence-queries'
import { type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withPromiseTransaction, withTransaction } from '@/infrastructure/database/transaction'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type {
  PlannedDelivery,
  RecordWebhookEvent,
  WebhookOutboxScopeShape,
} from '@/application/ports/services/record-webhook-dispatcher'
import type { DatabaseService, Dialect } from '@/infrastructure/database/drizzle/layer'

/** An outbox row, as the delivery engine reads it. */
export interface OutboxRow {
  readonly id: string
  readonly tableName: string
  readonly webhookName: string
  readonly event: RecordWebhookEvent
  readonly recordId: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly attemptCount: number
}

export const outbox = (dialect: Dialect): SQL => dialect.sql.systemTableRef('webhook_outbox')
export const subjects = (dialect: Dialect): SQL =>
  dialect.sql.systemTableRef('webhook_outbox_subjects')

/**
 * An instant as `dialect` stores it: epoch milliseconds on SQLite
 * (`timestamp_ms`), an ISO 8601 string on PostgreSQL (`timestamptz`).
 */
export const instant = (dialect: Dialect, epochMs: number): number | string =>
  dialect.kind === 'sqlite' ? epochMs : new Date(epochMs).toISOString()

/** A payload as JSON. A driver value JSON cannot hold (a bigint) is written as its digits. */
const payloadJson = (payload: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(payload, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  )

const insertDelivery = (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  delivery: PlannedDelivery,
  now: number
) =>
  executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${outbox(dialect)}
          (id, table_name, webhook_name, event, record_id, payload, status, attempt_count,
           next_attempt_at, created_at)
        VALUES (${delivery.id}, ${delivery.tableName}, ${delivery.webhookName},
                ${delivery.event}, ${delivery.recordId}, ${payloadJson(delivery.payload)},
                'pending', 0, ${instant(dialect, now)}, ${instant(dialect, now)})`
  )

const insertSubjects = async (
  runner: Readonly<RawSqlRunner>,
  dialect: Dialect,
  delivery: PlannedDelivery
): Promise<void> => {
  if (delivery.subjects.length === 0) return
  const values = sql.join(
    delivery.subjects.map((userId) => sql`(${delivery.id}, ${userId})`),
    sql`, `
  )
  await executeRawOn(
    dialect.kind,
    runner,
    sql`INSERT INTO ${subjects(dialect)} (outbox_id, user_id) VALUES ${values}`
  )
}

/**
 * Record the deliveries `changes` owe, on the write's own transaction `tx`.
 * Resolves to the ids recorded — none outside an outbox scope, which is how a
 * seed, a backup restore and a silenced import record nothing.
 *
 * Run inside a table repository's transaction body by the two helpers below.
 */
const recordCommittedDeliveries = async (
  tx: Readonly<RawSqlRunner>,
  dialect: Dialect,
  scope: WebhookOutboxScopeShape,
  changes: readonly CommittedRowChange[]
): Promise<readonly string[]> => {
  if (!scope.active || changes.length === 0) return []
  const planned = scope.plan(changes)
  const now = Date.now()
  // One statement at a time: a transaction handle runs its statements in order.
  await planned.reduce<Promise<void>>(async (previous, delivery) => {
    await previous
    await insertDelivery(tx, dialect, delivery, now)
    await insertSubjects(tx, dialect, delivery)
  }, Promise.resolve())
  return planned.map((delivery) => delivery.id)
}

/**
 * `withPromiseTransaction` for a repository write whose body is a Promise: the
 * deliveries the rows it committed owe — `changesOf` names them, the same rows
 * the repository reports to the change stream — are recorded on the same
 * transaction, as the outbox scope in effect plans them, and handed to the
 * scope once it commits. The evidence of a signature the write stores is
 * written there too (`signature-evidence-queries.ts`): a signature is never
 * committed without its evidence.
 */
export const tryTransactionWithOutbox = <T, E>(input: {
  readonly database: DatabaseService
  readonly transaction: (tx: Readonly<PortableTx>) => Promise<T>
  readonly changesOf: (result: T) => readonly CommittedRowChange[]
  readonly catch: (error: unknown) => E
}): Effect.Effect<T, E> =>
  Effect.gen(function* () {
    const scope = yield* WebhookOutboxScope
    const evidence = yield* SignatureEvidenceScope
    const { client, dialect } = input.database
    const { result, recorded } = yield* withPromiseTransaction(
      client,
      async (tx) => {
        const written = await input.transaction(tx)
        const changes = input.changesOf(written)
        await recordPendingSignatureEvidence(tx, dialect, evidence, changes)
        const deliveryIds = await recordCommittedDeliveries(tx, dialect, scope, changes)
        return { result: written, recorded: { changes, deliveryIds } }
      },
      input.catch
    )
    yield* Effect.try({ try: () => scope.recorded(recorded), catch: input.catch })
    return result
  })

/**
 * `withTransaction(client, body, onFailure)` for a repository write whose body is
 * an Effect, with the deliveries its committed rows owe, and the evidence of a
 * signature it stores, recorded on the same transaction (see
 * {@link tryTransactionWithOutbox}). A failure to record is
 * the write's own failure: the transaction rolls back with it.
 */
export const withOutboxTransaction =
  <C>(database: DatabaseService, changesOf: (result: C) => readonly CommittedRowChange[]) =>
  <A extends C, E, R, E2>(
    body: (tx: Readonly<PortableTx>) => Effect.Effect<A, E, R>,
    onTransactionFailure: (error: unknown) => E2
  ): Effect.Effect<A, E2, R> =>
    Effect.gen(function* () {
      const scope = yield* WebhookOutboxScope
      const evidence = yield* SignatureEvidenceScope
      const { result, recorded } = yield* withTransaction(
        database.client,
        (tx) =>
          Effect.gen(function* () {
            const written = yield* body(tx)
            const changes = changesOf(written)
            // The batch roads write no signature today; one that ever does keeps its evidence here.
            yield* Effect.tryPromise({
              try: () => recordPendingSignatureEvidence(tx, database.dialect, evidence, changes),
              catch: (cause) =>
                new DatabaseError('Failed to record the signature evidence of a write', cause),
            })
            const deliveryIds = yield* Effect.tryPromise({
              try: () => recordCommittedDeliveries(tx, database.dialect, scope, changes),
              catch: (cause) =>
                new DatabaseError('Failed to record the webhook deliveries of a write', cause),
            })
            return { result: written, recorded: { changes, deliveryIds } }
          }),
        onTransactionFailure
      )
      scope.recorded(recorded)
      return result
    })

const asNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value))

const asPayload = (value: unknown): Readonly<Record<string, unknown>> => {
  if (typeof value === 'string') return JSON.parse(value) as Readonly<Record<string, unknown>>
  return (value ?? {}) as Readonly<Record<string, unknown>>
}

const toOutboxRow = (row: Readonly<Record<string, unknown>>): OutboxRow => ({
  id: String(row['id']),
  tableName: String(row['table_name']),
  webhookName: String(row['webhook_name']),
  event: String(row['event']) as RecordWebhookEvent,
  recordId: String(row['record_id']),
  payload: asPayload(row['payload']),
  attemptCount: asNumber(row['attempt_count'] ?? 0),
})

/**
 * The claim guard: still pending, due, and nobody holds a live lease on it. A
 * fresh delivery is due at once (`next_attempt_at` is its write's instant); a
 * parked one only once its backoff ran out.
 */
const claimable = (dialect: Dialect, now: number): SQL =>
  sql`status = 'pending' AND next_attempt_at <= ${instant(dialect, now)}
      AND (locked_until IS NULL OR locked_until < ${instant(dialect, now)})`

/** A delivery about to be claimed: enough to know whose in-flight bound it waits on. */
export interface OutboxCandidate {
  readonly id: string
  readonly tableName: string
  readonly webhookName: string
}

const toCandidate = (row: Readonly<Record<string, unknown>>): OutboxCandidate => ({
  id: String(row['id']),
  tableName: String(row['table_name']),
  webhookName: String(row['webhook_name']),
})

/**
 * The named deliveries that can be claimed now. Nothing is claimed here: a
 * delivery is claimed only once its webhook's in-flight bound admits it
 * ({@link claimDelivery}), so a lease never runs out while it waits its turn.
 */
export const listClaimableDeliveries = async (
  { client, dialect }: DatabaseService,
  ids: readonly string[]
): Promise<readonly OutboxCandidate[]> => {
  if (ids.length === 0) return []
  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )
  const rows = await executeRawOn(
    dialect.kind,
    client,
    sql`SELECT id, table_name, webhook_name FROM ${outbox(dialect)}
         WHERE id IN (${idList}) AND ${claimable(dialect, Date.now())}`
  )
  return rows.map(toCandidate)
}

/**
 * Up to `limit` deliveries that are due, at most `perWebhook` of any one
 * webhook. Each webhook's oldest come first, taken in turns (every webhook's
 * oldest, then every webhook's second, and so on), so one webhook's backlog
 * never fills the batch ahead of another's due delivery. Nothing is claimed here.
 */
export const listDueDeliveries = async (
  { client, dialect }: DatabaseService,
  limit: number,
  perWebhook: number
): Promise<readonly OutboxCandidate[]> => {
  const rows = await executeRawOn(
    dialect.kind,
    client,
    sql`SELECT id, table_name, webhook_name FROM (
          SELECT id, table_name, webhook_name, next_attempt_at,
                 ROW_NUMBER() OVER (
                   PARTITION BY table_name, webhook_name ORDER BY next_attempt_at, id
                 ) AS webhook_rank
            FROM ${outbox(dialect)}
           WHERE ${claimable(dialect, Date.now())}
        ) due
         WHERE webhook_rank <= ${perWebhook}
         ORDER BY webhook_rank, next_attempt_at
         LIMIT ${limit}`
  )
  return rows.map(toCandidate)
}

/**
 * Claim one delivery for `leaseMs`: a compare-and-set, so it resolves to the
 * row only for the one caller that took it — `undefined` when another process
 * holds it, it settled, or it is parked until later.
 */
export const claimDelivery = async (
  { client, dialect }: DatabaseService,
  id: string,
  leaseMs: number
): Promise<OutboxRow | undefined> => {
  const now = Date.now()
  const rows = await executeRawOn(
    dialect.kind,
    client,
    sql`UPDATE ${outbox(dialect)} SET locked_until = ${instant(dialect, now + leaseMs)}
         WHERE id = ${id} AND ${claimable(dialect, now)}
         RETURNING id, table_name, webhook_name, event, record_id, payload, attempt_count`
  )
  const row = rows[0]
  return row === undefined ? undefined : toOutboxRow(row)
}

/** Hold the lease on a delivery that is about to be retried in-process. */
export const extendLease = async (
  { client, dialect }: DatabaseService,
  id: string,
  untilMs: number
): Promise<void> => {
  await executeRawOn(
    dialect.kind,
    client,
    sql`UPDATE ${outbox(dialect)} SET locked_until = ${instant(dialect, untilMs)} WHERE id = ${id}`
  )
}

/** The outcome of the last attempt, kept on the row. */
export interface AttemptRecord {
  readonly attemptCount: number
  readonly httpStatus: number | undefined
  readonly error: string | undefined
}

/**
 * Settle a delivery as `delivered` or `dead`. SQL NULL is the JS `null`
 * literal in a Drizzle template (`undefined` binds nothing).
 */
export const settleDelivery = async (
  { client, dialect }: DatabaseService,
  id: string,
  status: 'delivered' | 'dead',
  attempt: AttemptRecord
): Promise<void> => {
  const now = Date.now()
  await executeRawOn(
    dialect.kind,
    client,
    sql`UPDATE ${outbox(dialect)}
           SET status = ${status}, attempt_count = ${attempt.attemptCount},
               last_http_status = ${attempt.httpStatus ?? null},
               last_error = ${attempt.error ?? null},
               settled_at = ${instant(dialect, now)}, locked_until = NULL
         WHERE id = ${id}`
  )
}

/** Park a delivery until `nextAttemptAtMs`, releasing its lease. */
export const parkDelivery = async (
  { client, dialect }: DatabaseService,
  id: string,
  nextAttemptAtMs: number,
  attempt: AttemptRecord
): Promise<void> => {
  await executeRawOn(
    dialect.kind,
    client,
    sql`UPDATE ${outbox(dialect)}
           SET attempt_count = ${attempt.attemptCount},
               last_http_status = ${attempt.httpStatus ?? null},
               last_error = ${attempt.error ?? null},
               next_attempt_at = ${instant(dialect, nextAttemptAtMs)}, locked_until = NULL
         WHERE id = ${id}`
  )
}
