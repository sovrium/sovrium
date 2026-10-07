/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Send the weekly summary of the instance.
 *
 * ─── THE PERIOD ─────────────────────────────────────────────────────────────
 *
 * A summary covers `[start, now)`, where `start` is where the LAST stored
 * summary ended — so consecutive summaries tile time with no gap and no
 * overlap, however late a tick fires. The first summary an instance ever
 * sends covers the seven days that end now, and is a baseline week.
 *
 * ─── THE STORE ──────────────────────────────────────────────────────────────
 *
 * Every summary computed while the email is switched on is stored in
 * `system.admin_digest_snapshots` — even one with nobody to send it to, since
 * the next week compares against it. It is written BEFORE delivery with
 * `sent_at` NULL and marked sent after, so a process that dies mid-send leaves
 * a row the boot catch-up retries. With `SOVRIUM_NOTIFY_DIGEST=off` nothing is
 * stored and nothing is sent; the token-gated trigger route still computes and
 * answers the figures.
 *
 * ─── THE BOOT CATCH-UP ──────────────────────────────────────────────────────
 *
 * {@link catchUpWeeklyDigest} runs once per boot. A week missed while the
 * server was down is caught up with ONE summary covering the whole stretch;
 * a recent summary whose delivery failed is sent again; an instance that has
 * never sent one waits for its first scheduled tick. Single-instance by
 * design: two servers on one database would each catch up.
 */

import { Effect, type Context } from 'effect'
import { AdminDigestSnapshotRepository } from '@/application/ports/repositories/admin/admin-digest-snapshot-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { resolveNotificationRecipients } from '@/application/use-cases/admin/resolve-notification-recipients'
import {
  buildWeeklyDigest,
  type WeeklyDigestServices,
} from '@/application/use-cases/admin/weekly-digest-build'
import { renderWeeklyDigestEmail } from '@/application/use-cases/admin/weekly-digest-email'
import { DAY_MS, HOUR_MS } from '@/domain/kernel/time/time-series-bucketing'
import { parseSovriumNotifyDigest } from '@/domain/models/process-env/notifications'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { getSovriumVersion } from '@/infrastructure/process/version'
import type {
  AdminDigestSnapshot,
  AdminDigestSnapshotDatabaseError,
} from '@/application/ports/repositories/admin/admin-digest-snapshot-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { NoticeEnv } from '@/application/use-cases/automations/automation-notice'
import type {
  WeeklyDigest,
  WeeklyDigestTriggerResponse,
} from '@/domain/models/api/admin/notifications/weekly-digest'
import type { App } from '@/domain/models/app'
import type { SystemNotificationEmail } from '@/infrastructure/email/system-notification-template'

/** Every port sending a summary reads. */
export type WeeklyDigestSendServices =
  WeeklyDigestServices | AdminDigestSnapshotRepository | AuthRepository | EmailSender

/** The length of the first summary's period, and the rhythm the catch-up measures against. */
const WEEK_MS = 7 * DAY_MS

/**
 * How late a week may run before the boot treats it as missed. An hour of
 * slack, so a server restarted a few minutes before its own tick does not
 * send a catch-up AND the tick.
 */
const CATCH_UP_SLACK_MS = HOUR_MS

/** SMTP fan-out width — the recipient list is data-dependent, so it is stated. */
const SEND_CONCURRENCY = 2

/** Send to one address; answer whether it was delivered. A failure is logged. */
const sendOne = (
  to: string,
  email: SystemNotificationEmail,
  fromName: string
): Effect.Effect<boolean, never, EmailSender> =>
  Effect.gen(function* () {
    return yield* (yield* EmailSender).send({
      to,
      fromName,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
  }).pipe(
    Effect.as(true),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[weekly-digest] send failed', cause, { to }))
    ),
    // effect-swallow: logged above; an undelivered address leaves `sent_at` NULL
    // when it was the only one, which is what the boot catch-up retries.
    Effect.orElseSucceed(() => false)
  )

/** Send `digest` to every address, and answer how many were delivered. */
const deliver = (
  app: App,
  digest: WeeklyDigest,
  recipients: readonly string[],
  env: NoticeEnv
): Effect.Effect<number, never, EmailSender> =>
  Effect.gen(function* () {
    const email = renderWeeklyDigestEmail(app, digest, env)
    const outcomes = yield* Effect.forEach(recipients, (to) => sendOne(to, email, app.name), {
      concurrency: SEND_CONCURRENCY,
    })
    return outcomes.filter(Boolean).length
  })

/** A date that holds an instant, as opposed to an Invalid Date. */
const isReadableInstant = (value: Readonly<Date> | undefined): value is Readonly<Date> =>
  value !== undefined && Number.isFinite(value.getTime())

/**
 * Where the next period starts: the last summary's end, or seven days ago when
 * there is none — or when the one there is does not hold a readable instant,
 * so an unreadable row degrades to a baseline week instead of a NaN period.
 */
export const resolveDigestPeriod = (
  latest: Pick<AdminDigestSnapshot, 'periodEnd'> | undefined,
  now: Readonly<Date>
): { readonly from: Date; readonly to: Date } => {
  const nowMs = isReadableInstant(now) ? now.getTime() : Date.now()
  const previousEnd = latest?.periodEnd
  return {
    from: isReadableInstant(previousEnd)
      ? new Date(Math.min(previousEnd.getTime(), nowMs))
      : new Date(nowMs - WEEK_MS),
    to: new Date(nowMs),
  }
}

/**
 * Store the summary, deliver it, and mark it sent. Answers the delivered count
 * and whether anything was delivered.
 */
const storeAndDeliver = (
  app: App,
  digest: WeeklyDigest,
  now: Readonly<Date>,
  env: NoticeEnv
): Effect.Effect<
  { readonly sent: boolean; readonly recipients: number },
  AdminDigestSnapshotDatabaseError,
  AdminDigestSnapshotRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    const repository = yield* AdminDigestSnapshotRepository
    const recipients = yield* resolveNotificationRecipients(app, 'weeklyDigest', env)
    const id = yield* repository.insert({
      periodStart: new Date(digest.period.start),
      periodEnd: new Date(digest.period.end),
      // Nobody to tell is not a failed delivery: nothing is left to retry.
      sentAt: recipients.length === 0 ? new Date(now.getTime()) : undefined,
      recipientCount: 0,
      metrics: digest,
    })
    if (recipients.length === 0) return { sent: false, recipients: 0 }
    const delivered = yield* deliver(app, digest, recipients, env)
    if (delivered > 0) {
      yield* repository.markSent({ id, sentAt: new Date(), recipientCount: delivered })
    }
    return { sent: delivered > 0, recipients: delivered }
  })

/** Now, on whichever of the process and database clocks is later — see `clock` on the port. */
const periodEndNow = (
  repository: Context.Service.Shape<typeof AdminDigestSnapshotRepository>
): Effect.Effect<Date, AdminDigestSnapshotDatabaseError> =>
  repository.clock.pipe(
    Effect.map((database) => {
      const processNow = Date.now()
      const databaseNow = database.getTime()
      // An unreadable database clock never turns the period end into NaN.
      return new Date(Number.isFinite(databaseNow) ? Math.max(databaseNow, processNow) : processNow)
    })
  )

/**
 * Compute the summary of `[last summary's end, now)` and, unless the email is
 * switched off, store and send it. Answers the trigger route's body.
 */
export const sendWeeklyDigest = (
  app: App,
  options: { readonly now?: Date | undefined; readonly env?: NoticeEnv | undefined } = {}
): Effect.Effect<
  WeeklyDigestTriggerResponse,
  AdminDigestSnapshotDatabaseError,
  WeeklyDigestSendServices
> =>
  Effect.gen(function* () {
    const repository = yield* AdminDigestSnapshotRepository
    const now = options.now ?? (yield* periodEndNow(repository))
    const env = options.env ?? process.env
    const latest = yield* repository.latest
    const period = resolveDigestPeriod(latest, now)
    // effect-promise: total -- getSovriumVersion never rejects; it degrades to '0.0.0'
    const engineVersion = yield* Effect.promise(() => getSovriumVersion())
    const digest = yield* buildWeeklyDigest(app, {
      ...period,
      previous:
        latest === undefined || !isReadableInstant(latest.periodEnd)
          ? undefined
          : { periodEnd: latest.periodEnd, metrics: latest.metrics },
      timezone: resolveOperatorTimezone(env),
      engineVersion,
    })
    if (parseSovriumNotifyDigest(env) === 'off') return { sent: false, recipients: 0, digest }
    const outcome = yield* storeAndDeliver(app, digest, now, env)
    return { ...outcome, digest }
  }).pipe(Effect.withSpan('notifications.send-weekly-digest'))

/** Send a stored summary whose delivery failed, and mark it sent once delivered. */
const resendStored = (
  app: App,
  snapshot: AdminDigestSnapshot,
  env: NoticeEnv
): Effect.Effect<
  boolean,
  AdminDigestSnapshotDatabaseError,
  AdminDigestSnapshotRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    if (snapshot.metrics === undefined) return false
    const recipients = yield* resolveNotificationRecipients(app, 'weeklyDigest', env)
    const delivered =
      recipients.length === 0 ? 0 : yield* deliver(app, snapshot.metrics, recipients, env)
    if (recipients.length > 0 && delivered === 0) return false
    yield* (yield* AdminDigestSnapshotRepository).markSent({
      id: snapshot.id,
      sentAt: new Date(),
      recipientCount: delivered,
    })
    return delivered > 0
  })

/** What the boot catch-up did. */
export type WeeklyDigestCatchUp = 'disabled' | 'no-history' | 'up-to-date' | 'caught-up' | 'retried'

/**
 * The boot catch-up — see the module comment. Runs only while the email is
 * switched on.
 */
export const catchUpWeeklyDigest = (
  app: App,
  options: { readonly now?: Date | undefined; readonly env?: NoticeEnv | undefined } = {}
): Effect.Effect<WeeklyDigestCatchUp, AdminDigestSnapshotDatabaseError, WeeklyDigestSendServices> =>
  Effect.gen(function* () {
    const now = options.now ?? new Date()
    const env = options.env ?? process.env
    if (parseSovriumNotifyDigest(env) === 'off') return 'disabled'
    const latest = yield* (yield* AdminDigestSnapshotRepository).latest
    if (latest === undefined) return 'no-history'
    if (latest.periodEnd.getTime() < now.getTime() - WEEK_MS - CATCH_UP_SLACK_MS) {
      yield* sendWeeklyDigest(app, { now: options.now, env })
      return 'caught-up'
    }
    if (latest.sentAt === undefined) {
      yield* resendStored(app, latest, env)
      return 'retried'
    }
    return 'up-to-date'
  }).pipe(Effect.withSpan('notifications.catch-up-weekly-digest'))

/**
 * The scheduled tick. Skips when a summary ended within the last hour — the
 * boot catch-up just sent one — so a restart shortly before the tick does not
 * send two.
 */
export const runScheduledWeeklyDigest = (
  app: App,
  options: { readonly now?: Date | undefined; readonly env?: NoticeEnv | undefined } = {}
): Effect.Effect<boolean, AdminDigestSnapshotDatabaseError, WeeklyDigestSendServices> =>
  Effect.gen(function* () {
    const now = options.now ?? new Date()
    const env = options.env ?? process.env
    if (parseSovriumNotifyDigest(env) === 'off') return false
    const latest = yield* (yield* AdminDigestSnapshotRepository).latest
    if (latest !== undefined && latest.periodEnd.getTime() > now.getTime() - CATCH_UP_SLACK_MS) {
      return false
    }
    const result = yield* sendWeeklyDigest(app, { now: options.now, env })
    return result.sent
  }).pipe(Effect.withSpan('notifications.run-scheduled-weekly-digest'))
