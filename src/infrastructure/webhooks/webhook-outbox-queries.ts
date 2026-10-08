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
import { db, DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { systemTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { withTransaction } from '@/infrastructure/database/transaction'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type {
  PlannedDelivery,
  RecordWebhookEvent,
  WebhookOutboxScopeShape,
} from '@/application/ports/services/record-webhook-dispatcher'

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

const outbox = (): SQL => systemTableRef('webhook_outbox')
const subjects = (): SQL => systemTableRef('webhook_outbox_subjects')

/**
 * An instant as the active engine stores it: epoch milliseconds on SQLite
 * (`timestamp_ms`), an ISO 8601 string on PostgreSQL (`timestamptz`).
 */
const instant = (epochMs: number): number | string =>
  isSqliteRuntime() ? epochMs : new Date(epochMs).toISOString()

/** A payload as JSON. A driver value JSON cannot hold (a bigint) is written as its digits. */
const payloadJson = (payload: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(payload, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  )

const insertDelivery = (runner: Readonly<RawSqlRunner>, delivery: PlannedDelivery, now: number) =>
  executeRaw(
    runner,
    sql`INSERT INTO ${outbox()}
          (id, table_name, webhook_name, event, record_id, payload, status, attempt_count,
           next_attempt_at, created_at)
        VALUES (${delivery.id}, ${delivery.tableName}, ${delivery.webhookName},
                ${delivery.event}, ${delivery.recordId}, ${payloadJson(delivery.payload)},
                'pending', 0, ${instant(now)}, ${instant(now)})`
  )

const insertSubjects = async (
  runner: Readonly<RawSqlRunner>,
  delivery: PlannedDelivery
): Promise<void> => {
  if (delivery.subjects.length === 0) return
  const values = sql.join(
    delivery.subjects.map((userId) => sql`(${delivery.id}, ${userId})`),
    sql`, `
  )
  await executeRaw(runner, sql`INSERT INTO ${subjects()} (outbox_id, user_id) VALUES ${values}`)
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
  scope: WebhookOutboxScopeShape,
  changes: readonly CommittedRowChange[]
): Promise<readonly string[]> => {
  if (!scope.active || changes.length === 0) return []
  const planned = scope.plan(changes)
  const now = Date.now()
  // One statement at a time: a transaction handle runs its statements in order.
  await planned.reduce<Promise<void>>(async (previous, delivery) => {
    await previous
    await insertDelivery(tx, delivery, now)
    await insertSubjects(tx, delivery)
  }, Promise.resolve())
  return planned.map((delivery) => delivery.id)
}

/**
 * `db.transaction(body)` for a repository write whose body is a Promise: the
 * deliveries the rows it committed owe — `changesOf` names them, the same rows
 * the repository reports to the change stream — are recorded on the same
 * transaction, as the outbox scope in effect plans them, and handed to the
 * scope once it commits.
 */
export const tryTransactionWithOutbox = <T, E>(input: {
  readonly transaction: (tx: DrizzleTransaction) => Promise<T>
  readonly changesOf: (result: T) => readonly CommittedRowChange[]
  readonly catch: (error: unknown) => E
}): Effect.Effect<T, E> =>
  Effect.gen(function* () {
    const scope = yield* WebhookOutboxScope
    return yield* Effect.tryPromise({
      try: async () => {
        const { result, recorded } = await db.transaction(async (tx) => {
          const written = await input.transaction(tx)
          const changes = input.changesOf(written)
          const deliveryIds = await recordCommittedDeliveries(tx, scope, changes)
          return { result: written, recorded: { changes, deliveryIds } }
        })
        scope.recorded(recorded)
        return result
      },
      catch: input.catch,
    })
  })

/**
 * `withTransaction(db, body, onFailure)` for a repository write whose body is
 * an Effect, with the deliveries its committed rows owe recorded on the same
 * transaction (see {@link tryTransactionWithOutbox}). A failure to record is
 * the write's own failure: the transaction rolls back with it.
 */
export const withOutboxTransaction =
  <C>(changesOf: (result: C) => readonly CommittedRowChange[]) =>
  <A extends C, E, R, E2>(
    body: (tx: Readonly<DrizzleTransaction>) => Effect.Effect<A, E, R>,
    onTransactionFailure: (error: unknown) => E2
  ): Effect.Effect<A, E2, R> =>
    Effect.gen(function* () {
      const scope = yield* WebhookOutboxScope
      const { result, recorded } = yield* withTransaction(
        db,
        (tx) =>
          Effect.gen(function* () {
            const written = yield* body(tx)
            const changes = changesOf(written)
            const deliveryIds = yield* Effect.tryPromise({
              try: () => recordCommittedDeliveries(tx, scope, changes),
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
const claimable = (now: number): SQL =>
  sql`status = 'pending' AND next_attempt_at <= ${instant(now)}
      AND (locked_until IS NULL OR locked_until < ${instant(now)})`

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
  ids: readonly string[]
): Promise<readonly OutboxCandidate[]> => {
  if (ids.length === 0) return []
  const idList = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )
  const rows = await executeRaw(
    db,
    sql`SELECT id, table_name, webhook_name FROM ${outbox()}
         WHERE id IN (${idList}) AND ${claimable(Date.now())}`
  )
  return rows.map(toCandidate)
}

/** Up to `limit` deliveries that are due, oldest first. Nothing is claimed here. */
export const listDueDeliveries = async (limit: number): Promise<readonly OutboxCandidate[]> => {
  const rows = await executeRaw(
    db,
    sql`SELECT id, table_name, webhook_name FROM ${outbox()}
         WHERE ${claimable(Date.now())}
         ORDER BY next_attempt_at
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
  id: string,
  leaseMs: number
): Promise<OutboxRow | undefined> => {
  const now = Date.now()
  const rows = await executeRaw(
    db,
    sql`UPDATE ${outbox()} SET locked_until = ${instant(now + leaseMs)}
         WHERE id = ${id} AND ${claimable(now)}
         RETURNING id, table_name, webhook_name, event, record_id, payload, attempt_count`
  )
  const row = rows[0]
  return row === undefined ? undefined : toOutboxRow(row)
}

/** Hold the lease on a delivery that is about to be retried in-process. */
export const extendLease = async (id: string, untilMs: number): Promise<void> => {
  await executeRaw(
    db,
    sql`UPDATE ${outbox()} SET locked_until = ${instant(untilMs)} WHERE id = ${id}`
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
  id: string,
  status: 'delivered' | 'dead',
  attempt: AttemptRecord
): Promise<void> => {
  const now = Date.now()
  await executeRaw(
    db,
    sql`UPDATE ${outbox()}
           SET status = ${status}, attempt_count = ${attempt.attemptCount},
               last_http_status = ${attempt.httpStatus ?? null},
               last_error = ${attempt.error ?? null},
               settled_at = ${instant(now)}, locked_until = NULL
         WHERE id = ${id}`
  )
}

/** Park a delivery until `nextAttemptAtMs`, releasing its lease. */
export const parkDelivery = async (
  id: string,
  nextAttemptAtMs: number,
  attempt: AttemptRecord
): Promise<void> => {
  await executeRaw(
    db,
    sql`UPDATE ${outbox()}
           SET attempt_count = ${attempt.attemptCount},
               last_http_status = ${attempt.httpStatus ?? null},
               last_error = ${attempt.error ?? null},
               next_attempt_at = ${instant(nextAttemptAtMs)}, locked_until = NULL
         WHERE id = ${id}`
  )
}

/**
 * Delete the deliveries settled before `cutoffMs`, in one transaction: the
 * outbox rows, their subjects, and the delivery-log rows that settle them —
 * then the log rows written before `cutoffMs` that no outbox row stands behind
 * (a test send, a row older than the outbox, one whose delivery is gone). A
 * log row therefore never outlives its delivery, and erasure, which finds log
 * rows through their delivery, reaches every one of them. Resolves to how many
 * deliveries went.
 */
export const deleteSettledBefore = async (cutoffMs: number): Promise<number> =>
  db.transaction(async (tx) => {
    const settled = sql`SELECT id FROM ${outbox()}
                         WHERE status <> 'pending' AND settled_at < ${instant(cutoffMs)}`
    // The log exists only once some table declared webhooks.
    const logged = (await listTableColumns(tx, '_webhook_deliveries')).length > 0
    // One statement at a time: a transaction handle runs its statements in order.
    if (logged) {
      await executeRaw(tx, sql`DELETE FROM _webhook_deliveries WHERE delivery_id IN (${settled})`)
    }
    // The subjects before their outbox rows: SQLite enforces the cascade only with foreign keys on.
    await executeRaw(tx, sql`DELETE FROM ${subjects()} WHERE outbox_id IN (${settled})`)
    const rows = await executeRaw(
      tx,
      sql`DELETE FROM ${outbox()}
           WHERE status <> 'pending' AND settled_at < ${instant(cutoffMs)}
           RETURNING id`
    )
    if (!logged) return rows.length
    await executeRaw(
      tx,
      sql`DELETE FROM _webhook_deliveries
           WHERE created_at < ${instant(cutoffMs)}
             AND (delivery_id IS NULL
                  OR NOT EXISTS (SELECT 1 FROM ${outbox()} o
                                  WHERE o.id = _webhook_deliveries.delivery_id))`
    )
    return rows.length
  })
