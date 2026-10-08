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
 *    A retry due within {@link IN_PROCESS_RETRY_MS} is slept here, holding the
 *    lease; a later one is PARKED — `next_attempt_at` set, the lease released —
 *    and the sweep ({@link sweepDueDeliveries}) attempts it when it falls due.
 *
 * At most {@link IN_FLIGHT_PER_WEBHOOK} attempts of one webhook run at a time
 * in this process, a write's own and the sweep's alike. A background delivery
 * is a tracked background run, so a stopping server waits for it or
 * interrupts it; an interrupted one keeps its lease until it expires and is
 * then due again — delivery survives a crash or a restart, at least once.
 */

import { Data, Effect, Layer, Semaphore } from 'effect'
import {
  RecordWebhookDispatcher,
  WebhookOutboxScope,
  type OutboxedWrite,
  type OutboxPlanner,
  type OutboxSweepReport,
  type RecordedDeliveries,
} from '@/application/ports/services/record-webhook-dispatcher'
import { computeRetryDelay, resolveRetryPolicy } from '@/domain/models/app/tables/webhooks'
import { trackBackgroundRun } from '@/infrastructure/automations/background-runs'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import {
  attemptDelivery,
  envLookupFor,
  logDelivery,
  type DeliveryOutcomeFields,
  type TableWebhookPayload,
} from './table-webhook-dispatch'
import {
  claimDelivery,
  deleteSettledBefore,
  extendLease,
  listClaimableDeliveries,
  listDueDeliveries,
  parkDelivery,
  settleDelivery,
  type OutboxCandidate,
  type OutboxRow,
} from './webhook-outbox-queries'
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** Write the one delivery-log row of a settled series. */
const logSettled = async (input: {
  readonly webhook: Webhook
  readonly row: OutboxRow
  readonly outcome: DeliveryOutcomeFields
  readonly attempts: number
  readonly requestedAt: string
}): Promise<void> => {
  const { webhook, row, outcome, attempts } = input
  const policy = resolveRetryPolicy(webhook.retry)
  await logDelivery({
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

/** Attempt a claimed delivery until it settles or parks. */
const runSeries = async (app: App, row: OutboxRow): Promise<SeriesOutcome> => {
  const webhook = currentWebhook(app, row)
  if (webhook === undefined) {
    await settleDelivery(row.id, 'dead', {
      attemptCount: row.attemptCount,
      httpStatus: undefined,
      error: 'The webhook is no longer declared, or is disabled',
    })
    return 'dead'
  }
  const policy = resolveRetryPolicy(webhook.retry)
  const envLookup = envLookupFor(app.env)
  const requestedAt = new Date().toISOString()
  const attemptFrom = async (attemptsBefore: number): Promise<SeriesOutcome> => {
    const outcome = await attemptDelivery(
      webhook,
      row.payload as TableWebhookPayload,
      envLookup,
      row.id
    )
    const attempts = attemptsBefore + 1
    const record = { attemptCount: attempts, httpStatus: outcome.httpStatus, error: outcome.error }
    if (outcome.status === 'success' || attempts >= 1 + policy.maxAttempts) {
      const settled = outcome.status === 'success' ? 'delivered' : 'dead'
      await settleDelivery(row.id, settled, record)
      await logSettled({ webhook, row, outcome, attempts, requestedAt })
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
      await parkDelivery(row.id, Date.now() + delay, record)
      return 'retrying'
    }
    await extendLease(row.id, Date.now() + delay + LEASE_MS)
    await sleep(delay)
    return attemptFrom(attempts)
  }
  return attemptFrom(row.attemptCount)
}

/**
 * One series, bounded per webhook, its failure logged and absorbed. The row is
 * claimed only once the bound admits it; a row another claimant took, or that
 * settled or parked meanwhile, is left alone (`undefined`).
 */
const seriesEffect = (
  app: App,
  candidate: OutboxCandidate
): Effect.Effect<SeriesOutcome | undefined> =>
  Effect.tryPromise({
    try: async () => {
      const row = await claimDelivery(candidate.id, LEASE_MS)
      return row === undefined ? undefined : runSeries(app, row)
    },
    catch: (cause) => new WebhookOutboxError({ cause }),
  }).pipe(
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
  app: App,
  candidates: readonly OutboxCandidate[]
): Effect.Effect<readonly { readonly id: string; readonly outcome: SeriesOutcome | undefined }[]> =>
  Effect.forEach(
    candidates,
    (candidate) =>
      Effect.map(seriesEffect(app, candidate), (outcome) => ({ id: candidate.id, outcome })),
    { concurrency: 'unbounded' }
  )

/** Attempt the rows a write recorded, each claimed when its turn comes. */
const deliverRecorded = (app: App, deliveryIds: readonly string[]): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () => listClaimableDeliveries(deliveryIds),
    catch: (cause) => new WebhookOutboxError({ cause }),
  }).pipe(
    Effect.flatMap((rows) => attemptRows(app, rows)),
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
const purgeSettled = (retention: 'every-call' | 'hourly'): Effect.Effect<void> =>
  retention === 'hourly' && Date.now() - lastRetention.at < RETENTION_EVERY_MS
    ? Effect.void
    : Effect.tryPromise({
        try: async () => {
          lastRetention.at = Date.now()
          return deleteSettledBefore(Date.now() - RETENTION_MS)
        },
        catch: (cause) => new WebhookOutboxError({ cause }),
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[webhooks] could not delete settled deliveries', cause))
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

/** Attempt every due delivery, at most {@link SWEEP_BATCH} of them. */
export const sweepDueDeliveries = (
  app: App,
  options?: { readonly retention?: 'every-call' | 'hourly' }
): Effect.Effect<OutboxSweepReport> =>
  Effect.gen(function* () {
    yield* purgeSettled(options?.retention ?? 'every-call')
    const rows = yield* Effect.tryPromise({
      try: () => listDueDeliveries(SWEEP_BATCH),
      catch: (cause) => new WebhookOutboxError({ cause }),
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[webhooks] could not read the due deliveries', cause))
      ),
      // effect-swallow: logged above; the next sweep reads them again.
      Effect.orElseSucceed((): readonly OutboxCandidate[] => [])
    )
    return reportOf(yield* attemptRows(app, rows))
  }).pipe(Effect.withSpan('webhooks.sweep-due-deliveries'))

/** Run `write` with an outbox scope installed, and collect the ids its transactions recorded. */
const enqueue = <A, E, R>(plan: OutboxPlanner, write: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const outer = yield* WebhookOutboxScope
    // A nested scope records into the outer one, which delivers once.
    if (outer.active) {
      const nested: OutboxedWrite<A> = { value: yield* write, changes: [], deliveryIds: [] }
      return nested
    }
    // The scope's own buffer: the repositories hand it what they committed.
    const recorded: { list: readonly RecordedDeliveries[] } = { list: [] }
    const value = yield* write.pipe(
      Effect.provideService(WebhookOutboxScope, {
        active: true,
        plan,
        recorded: (committed) => {
          recorded.list = [...recorded.list, committed]
        },
      })
    )
    const outcome: OutboxedWrite<A> = {
      value,
      changes: recorded.list.flatMap((committed) => committed.changes),
      deliveryIds: recorded.list.flatMap((committed) => committed.deliveryIds),
    }
    return outcome
  })

/** The live dispatcher. Part of `TableLive`. */
export const RecordWebhookDispatcherLive = Layer.succeed(RecordWebhookDispatcher, {
  enqueue,
  deliver: ({ app, deliveryIds, mode }) =>
    mode === 'await'
      ? deliverRecorded(app, deliveryIds)
      : Effect.asVoid(Effect.forkDetach(trackBackgroundRun(deliverRecorded(app, deliveryIds)))),
  deliverDue: sweepDueDeliveries,
})
