/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The live record-webhook dispatcher: the outbox scope a write's repositories
 * record into, and the delivery engine that empties the outbox.
 *
 * One delivery is a SERIES of attempts under one id:
 *
 *  - wait for the webhook's in-flight bound, THEN claim the row (a lease, a
 *    compare-and-set — see `webhook-outbox-queries.ts`): a row is never held
 *    while it waits its turn, so its lease cannot run out before its first
 *    attempt and let a second claimant deliver it at the same time;
 *  - attempt it against the webhook as the CURRENT config declares it: a
 *    webhook renamed, removed or disabled since the write ends the row `dead`;
 *  - a 2xx settles it `delivered`; after `1 + retry.maxAttempts` failed
 *    attempts it is `dead`. Either way one row lands in the delivery log;
 *  - otherwise the next retry's delay comes from the webhook's `retry` policy.
 *    A retry due within {@link IN_PROCESS_RETRY_MS} is waited for here, holding
 *    the lease — an `Effect.retry` on a schedule, so a stopping server
 *    interrupts the wait instead of sitting it out; a later one is PARKED —
 *    `next_attempt_at` set, the lease released — and the sweep
 *    ({@link sweepDueDeliveries}) attempts it when it falls due.
 *
 * At most {@link IN_FLIGHT_PER_WEBHOOK} attempts of one webhook run at a time
 * in this process, a write's own and the sweep's alike. A write's deliveries
 * always run in the background, the write answering once it committed (or,
 * when it asked to wait, once they settled or a bounded wait ran out). A
 * background delivery is a tracked background run, so a stopping server waits for it or
 * interrupts it; an interrupted one keeps its lease until it expires and is
 * then due again — delivery survives a crash or a restart, at least once.
 */

import { Cause, Data, Duration, Effect, Fiber, Layer, Ref, Schedule, Semaphore } from 'effect'
import {
  RecordWebhookDispatcher,
  type OutboxSweepReport,
} from '@/application/ports/services/record-webhook-dispatcher'
import { computeRetryDelay, resolveRetryPolicy } from '@/domain/models/app/tables/webhooks'
import { trackBackgroundRun } from '@/infrastructure/automations/background-runs'
import { Database, type DatabaseService } from '@/infrastructure/database/drizzle/layer'
import { describeSweepFailure } from '@/infrastructure/database/read-write-sweep'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import {
  DELIVERY_TIMEOUT_MS,
  attemptDelivery,
  envLookupFor,
  logDelivery,
  type DeliveryOutcomeFields,
  type TableWebhookPayload,
} from './table-webhook-dispatch'
import { enqueue } from './webhook-outbox-enqueue'
import {
  claimDelivery,
  extendLease,
  listClaimableDeliveries,
  listDueDeliveries,
  parkDelivery,
  settleDelivery,
  type OutboxCandidate,
  type OutboxRow,
} from './webhook-outbox-queries'
import { deleteSettledBefore } from './webhook-outbox-retention'
import type { App } from '@/domain/models/app'
import type { Webhook } from '@/domain/models/app/tables/webhooks'

/** A retry due within this many milliseconds is slept in-process; a later one is parked. */
const IN_PROCESS_RETRY_MS = 10_000

/** How long a claim holds a delivery before another process may take it. */
const LEASE_MS = 30_000

/** Attempts of one webhook in flight at once in this process. */
const IN_FLIGHT_PER_WEBHOOK = 4

/** Deliveries one sweep claims at most. */
const SWEEP_BATCH = 100

/** Deliveries of one webhook one sweep claims at most, so a backlog leaves room for the others. */
const SWEEP_SHARE_PER_WEBHOOK = 25

/** A settled delivery is kept this long, then deleted. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/** The retention delete runs at most this often. */
const RETENTION_EVERY_MS = 60 * 60 * 1000

/** A delivery-engine step that failed: an outbox query, or a series that threw. */
class WebhookOutboxError extends Data.TaggedError('WebhookOutboxError')<{
  readonly cause: unknown
}> {}

/** How one series ended. */
type SeriesOutcome = 'delivered' | 'retrying' | 'dead'

/** Process-wide: one bound per webhook, whichever write or sweep attempts it. */
const permits = new Map<string, Semaphore.Semaphore>()

const permitFor = (row: OutboxCandidate): Semaphore.Semaphore => {
  const key = `${row.tableName}\u0000${row.webhookName}`
  const existing = permits.get(key)
  if (existing !== undefined) return existing
  const created = Semaphore.makeUnsafe(IN_FLIGHT_PER_WEBHOOK)
  permits.set(key, created)
  return created
}

/** The webhook a delivery is owed to, as the config declares it now. */
const currentWebhook = (app: App, row: OutboxRow): Webhook | undefined => {
  const webhook = app.tables
    ?.find((table) => table.name === row.tableName)
    ?.webhooks?.find((candidate) => candidate.name === row.webhookName)
  return webhook === undefined || webhook.enabled === false ? undefined : webhook
}

/** Write the one delivery-log row of a settled series. */
const logSettled = async (input: {
  readonly database: DatabaseService
  readonly webhook: Webhook
  readonly row: OutboxRow
  readonly outcome: DeliveryOutcomeFields
  readonly attempts: number
  readonly requestedAt: string
}): Promise<void> => {
  const { database, webhook, row, outcome, attempts } = input
  const policy = resolveRetryPolicy(webhook.retry)
  await logDelivery(database, {
    webhookName: webhook.name,
    tableName: row.tableName,
    event: `record.${row.event}`,
    url: webhook.url,
    payload: row.payload as TableWebhookPayload,
    requestedAt: input.requestedAt,
    completedAt: new Date().toISOString(),
    attemptCount: attempts,
    // `retry_strategy` names the backoff only when retries are enabled.
    retryStrategy: policy.maxAttempts > 0 ? policy.backoff : undefined,
    deliveryId: row.id,
    ...outcome,
  })
}

/** A step of the engine's own: an outbox query, the delivery log, one attempt over the wire. */
const outboxStep = <A>(step: () => Promise<A>): Effect.Effect<A, WebhookOutboxError> =>
  Effect.tryPromise({ try: step, catch: (cause) => new WebhookOutboxError({ cause }) })

/** An attempt that failed with a retry due soon enough to wait for in-process. */
class RetryAfter extends Data.TaggedError('RetryAfter')<{ readonly delayMs: number }> {}

/**
 * The wait between two in-process attempts: the delay the failed attempt
 * computed from the webhook's policy, and nothing else. How many attempts a
 * series makes is the attempt's own decision (it settles `dead` when the
 * policy is spent), so the schedule itself never stops.
 */
const everyAttempt: Schedule.Schedule<number, RetryAfter | WebhookOutboxError> = Schedule.forever

const afterComputedDelay = Schedule.addDelay(everyAttempt, ({ input }) =>
  Effect.succeed(Duration.millis(input._tag === 'RetryAfter' ? input.delayMs : 0))
)

/** One attempt of a claimed delivery, from the attempt count `attempts` holds. */
const attemptOnce = (input: {
  readonly database: DatabaseService
  readonly app: App
  readonly row: OutboxRow
  readonly webhook: Webhook
  readonly attempts: Ref.Ref<number>
  readonly requestedAt: string
}): Effect.Effect<SeriesOutcome, RetryAfter | WebhookOutboxError> =>
  Effect.gen(function* () {
    const { database, app, row, webhook, requestedAt } = input
    const policy = resolveRetryPolicy(webhook.retry)
    const outcome = yield* outboxStep(() =>
      attemptDelivery(webhook, row.payload as TableWebhookPayload, envLookupFor(app.env), row.id)
    )
    const attempts = yield* Ref.updateAndGet(input.attempts, (before) => before + 1)
    const record = { attemptCount: attempts, httpStatus: outcome.httpStatus, error: outcome.error }
    if (outcome.status === 'success' || attempts >= 1 + policy.maxAttempts) {
      const settled = outcome.status === 'success' ? 'delivered' : 'dead'
      yield* outboxStep(() => settleDelivery(database, row.id, settled, record))
      yield* outboxStep(() =>
        logSettled({ database, webhook, row, outcome, attempts, requestedAt })
      )
      if (settled === 'dead') {
        logInfo(
          `[webhooks] delivery ${row.id} to '${webhook.name}' is dead after ${String(attempts)} attempts`
        )
      }
      return settled
    }
    // The retry index is the number of retries made so far, plus this one.
    const delay = computeRetryDelay(policy, attempts)
    if (delay > IN_PROCESS_RETRY_MS) {
      yield* outboxStep(() => parkDelivery(database, row.id, Date.now() + delay, record))
      return 'retrying'
    }
    yield* outboxStep(() => extendLease(database, row.id, Date.now() + delay + LEASE_MS))
    return yield* new RetryAfter({ delayMs: delay })
  })

/** Attempt a claimed delivery until it settles or parks. */
const runSeries = (
  database: DatabaseService,
  app: App,
  row: OutboxRow
): Effect.Effect<SeriesOutcome, RetryAfter | WebhookOutboxError> =>
  Effect.gen(function* () {
    const webhook = currentWebhook(app, row)
    if (webhook === undefined) {
      yield* outboxStep(() =>
        settleDelivery(database, row.id, 'dead', {
          attemptCount: row.attemptCount,
          httpStatus: undefined,
          error: 'The webhook is no longer declared, or is disabled',
        })
      )
      return 'dead' as const
    }
    const attempts = yield* Ref.make(row.attemptCount)
    const requestedAt = new Date().toISOString()
    // Only a `RetryAfter` is waited out and attempted again; an engine fault
    // ends the series here, and the row keeps its lease until it expires.
    return yield* attemptOnce({ database, app, row, webhook, attempts, requestedAt }).pipe(
      Effect.retry({
        schedule: afterComputedDelay,
        while: (error) => error._tag === 'RetryAfter',
      })
    )
  })

/**
 * One series, bounded per webhook, its failure logged and absorbed. The row is
 * claimed only once the bound admits it; a row another claimant took, or that
 * settled or parked meanwhile, is left alone (`undefined`).
 */
const seriesEffect = (
  database: DatabaseService,
  app: App,
  candidate: OutboxCandidate
): Effect.Effect<SeriesOutcome | undefined> =>
  outboxStep(() => claimDelivery(database, candidate.id, LEASE_MS)).pipe(
    Effect.flatMap((row) => (row === undefined ? Effect.undefined : runSeries(database, app, row))),
    permitFor(candidate).withPermit,
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[webhooks] a delivery attempt failed to run', cause, {
          deliveryId: candidate.id,
        })
      )
    ),
    // effect-swallow: logged above; the row keeps its lease until it expires, then the sweep attempts it again.
    Effect.orElseSucceed(() => undefined)
  )

/** Attempt the candidates, each one's series at once (bounded per webhook). */
const attemptRows = (
  database: DatabaseService,
  app: App,
  candidates: readonly OutboxCandidate[]
): Effect.Effect<readonly { readonly id: string; readonly outcome: SeriesOutcome | undefined }[]> =>
  Effect.forEach(
    candidates,
    (candidate) =>
      Effect.map(seriesEffect(database, app, candidate), (outcome) => ({
        id: candidate.id,
        outcome,
      })),
    { concurrency: 'unbounded' }
  )

/** Attempt the rows a write recorded, each claimed when its turn comes. */
const deliverRecorded = (
  database: DatabaseService,
  app: App,
  deliveryIds: readonly string[]
): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => listClaimableDeliveries(database, deliveryIds),
    catch: (cause) => new WebhookOutboxError({ cause }),
  }).pipe(
    Effect.flatMap((rows) => attemptRows(database, app, rows)),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[webhooks] could not read the deliveries of a write', cause))
    ),
    // effect-swallow: logged above; the rows stay pending and due, so the minute sweep delivers them.
    Effect.ignoreCause,
    Effect.withSpan('webhooks.deliver-recorded', { attributes: { count: deliveryIds.length } })
  )

const lastRetention = { at: 0 }

/**
 * Delete the deliveries settled more than seven days ago, with their log rows
 * and the log rows older than that no delivery stands behind. `'hourly'` (the
 * minute tick) deletes at most once an hour; every other caller, each time.
 */
const purgeSettled = (
  database: DatabaseService,
  retention: 'every-call' | 'hourly'
): Effect.Effect<void> =>
  retention === 'hourly' && Date.now() - lastRetention.at < RETENTION_EVERY_MS
    ? Effect.void
    : Effect.tryPromise({
        try: async () => {
          lastRetention.at = Date.now()
          return deleteSettledBefore(database, Date.now() - RETENTION_MS)
        },
        catch: (cause) => new WebhookOutboxError({ cause }),
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError(
              describeSweepFailure(
                '[webhooks] could not delete settled deliveries',
                Cause.squash(cause)
              ),
              cause
            )
          )
        ),
        // effect-swallow: logged above; retention is housekeeping, retried within the hour.
        Effect.ignoreCause
      )

const reportOf = (
  results: readonly { readonly id: string; readonly outcome: SeriesOutcome | undefined }[]
): OutboxSweepReport => {
  const idsWith = (outcome: SeriesOutcome) =>
    results.filter((result) => result.outcome === outcome).map((result) => result.id)
  return { delivered: idsWith('delivered'), retrying: idsWith('retrying'), dead: idsWith('dead') }
}

/**
 * Attempt the due deliveries, at most {@link SWEEP_BATCH} of them and
 * {@link SWEEP_SHARE_PER_WEBHOOK} of any one webhook.
 */
const sweepDueDeliveries = (
  database: DatabaseService,
  app: App,
  options?: { readonly retention?: 'every-call' | 'hourly' }
): Effect.Effect<OutboxSweepReport> =>
  Effect.gen(function* () {
    yield* purgeSettled(database, options?.retention ?? 'every-call')
    const rows = yield* Effect.tryPromise({
      try: () => listDueDeliveries(database, SWEEP_BATCH, SWEEP_SHARE_PER_WEBHOOK),
      catch: (cause) => new WebhookOutboxError({ cause }),
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[webhooks] could not read the due deliveries', cause))
      ),
      // effect-swallow: logged above; the next sweep reads them again.
      Effect.orElseSucceed((): readonly OutboxCandidate[] => [])
    )
    return reportOf(yield* attemptRows(database, app, rows))
  }).pipe(Effect.withSpan('webhooks.sweep-due-deliveries'))

/**
 * Attempt a write's deliveries in a tracked background fiber. `await` then
 * waits for them, at most {@link DELIVERY_TIMEOUT_MS}: past it the write
 * answers and the deliveries go on, a receiver that is down never holding a
 * write's answer longer than one attempt's timeout.
 */
const deliverInBackground = (
  database: DatabaseService,
  app: App,
  deliveryIds: readonly string[],
  mode: 'await' | 'background'
): Effect.Effect<void> =>
  Effect.forkDetach(trackBackgroundRun(deliverRecorded(database, app, deliveryIds))).pipe(
    Effect.flatMap((fiber) =>
      mode === 'await'
        ? Effect.asVoid(Fiber.await(fiber).pipe(Effect.timeoutOption(DELIVERY_TIMEOUT_MS)))
        : Effect.void
    )
  )

/** The live dispatcher, over the `Database` service its outbox reads. Part of `TableLive`. */
export const RecordWebhookDispatcherLive = Layer.effect(
  RecordWebhookDispatcher,
  Effect.map(Database, (database) =>
    RecordWebhookDispatcher.of({
      enqueue,
      deliver: ({ app, deliveryIds, mode }) =>
        deliverInBackground(database, app, deliveryIds, mode),
      deliverDue: (app, options) => sweepDueDeliveries(database, app, options),
    })
  )
)
