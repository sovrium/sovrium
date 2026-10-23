/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The notification store's programs: write one notification per recipient on
 * the channels each chose for its kind, and let a person list hers, mark them
 * read and choose her channels. Every read and mark names its recipient — the
 * caller herself — so nobody reads, counts or marks another's.
 */

import { Effect } from 'effect'
import {
  NotificationRepository,
  type ChosenChannels,
  type NotificationDatabaseError,
  type StoredNotification,
} from '@/application/ports/repositories/automations/notification-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { findUserEmailsByIds } from '@/application/use-cases/auth/find-user-email'
import {
  changeChannels,
  channelsFor,
  declaredKind,
  kindLabelOf,
  type NotificationChannels,
} from '@/domain/models/app/notifications/notifications-service'
import { logError } from '@/infrastructure/logging/logger'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/** The most notifications a list answers: the newest ones. */
const LIST_LIMIT = 100

/** One declared kind with the channels she receives it on. */
interface KindPreference {
  readonly kind: string
  readonly label: string
  readonly channels: NotificationChannels
}

/** What a `notification` step asks to send. */
export interface NotificationRequest {
  readonly kind: string
  readonly recipientIds: readonly string[]
  readonly title: string
  readonly body: string | undefined
  readonly source: { readonly table: string; readonly recordId: string } | undefined
}

/**
 * Recipients per lookup: a broadcast reads its people's addresses and choices
 * in batches, well under both engines' bound-parameter ceilings.
 */
const RECIPIENT_BATCH = 500

/** Emails in flight at once for one step. */
const EMAIL_CONCURRENCY = 4

/** `items` in consecutive batches of at most `size`. */
const batchesOf = <T>(items: readonly T[], size: number): readonly (readonly T[])[] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  )

/** Each person's chosen channels per kind, keyed `user\u0000kind`. */
const chosenByPerson = (chosen: readonly ChosenChannels[]) =>
  new Map(chosen.map((row) => [`${row.userId}\u0000${row.kind}`, row] as const))

/** Send one notification by email; a failed send is logged and leaves the others going. */
const emailOne = (app: App, to: string, request: NotificationRequest) =>
  Effect.gen(function* () {
    const mailer = yield* EmailSender
    yield* mailer.send({
      to,
      subject: request.title,
      text: request.body ?? request.title,
      fromName: app.name,
    })
    return 1
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[notifications] email to a recipient failed', cause))
    ),
    // effect-swallow: one recipient's mail failing must not withhold the others' notifications.
    Effect.orElseSucceed(() => 0)
  )

/**
 * Write one notification per recipient who exists, on the channels she chose
 * for the kind (its defaults where she chose none): a row she lists in the app
 * or a digest collects, and an email to her account address. An id that names
 * nobody is skipped. Answers how many were notified, and how many by email.
 */
export const sendNotificationsProgram = (
  app: App,
  request: NotificationRequest
): Effect.Effect<
  { readonly notified: number; readonly emailed: number },
  NotificationDatabaseError,
  NotificationRepository | AuthRepository | EmailSender
> =>
  Effect.gen(function* () {
    const kind = declaredKind(app.notifications, request.kind)
    if (kind === undefined) return { notified: 0, emailed: 0 }
    const recipients = batchesOf([...new Set(request.recipientIds)], RECIPIENT_BATCH)
    const addresses = new Map(
      (yield* Effect.forEach(recipients, (batch) => findUserEmailsByIds(batch))).flatMap(
        (batch) => [...batch]
      )
    )
    const people = [...addresses.keys()]
    const repo = yield* NotificationRepository
    const chosen = chosenByPerson(
      (yield* Effect.forEach(batchesOf(people, RECIPIENT_BATCH), (batch) =>
        repo.preferencesOf(batch)
      )).flat()
    )
    const reached = people.map((userId) => ({
      userId,
      channels: channelsFor(kind, chosen.get(`${userId}\u0000${kind.name}`)),
    }))
    yield* repo.insertMany(
      reached
        .filter(({ channels }) => channels.inApp || channels.digest)
        .map(({ userId, channels }) => ({
          recipientId: userId,
          kind: kind.name,
          title: request.title,
          body: request.body ?? null,
          sourceTable: request.source?.table ?? null,
          sourceRecordId: request.source?.recordId ?? null,
          inApp: channels.inApp,
          digest: channels.digest,
        }))
    )
    const sent = yield* Effect.forEach(
      reached.filter(({ channels }) => channels.email),
      ({ userId }) => emailOne(app, addresses.get(userId)!, request),
      { concurrency: EMAIL_CONCURRENCY }
    )
    return { notified: reached.length, emailed: sent.reduce((sum, n) => sum + n, 0) }
  }).pipe(Effect.withSpan('automations.send-notifications'))

/** Her listed notifications, newest first, and how many are unread. */
export const listMyNotificationsProgram = (
  userId: string
): Effect.Effect<
  { readonly notifications: readonly StoredNotification[]; readonly unreadCount: number },
  NotificationDatabaseError,
  NotificationRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    return {
      notifications: yield* repo.listFor(userId, LIST_LIMIT),
      unreadCount: yield* repo.unreadCountFor(userId),
    }
  }).pipe(Effect.withSpan('automations.list-my-notifications'))

/** Mark one of her notifications read; nothing when she has no such notification. */
export const markMyNotificationReadProgram = (
  userId: string,
  id: string
): Effect.Effect<
  { readonly notification: StoredNotification; readonly unreadCount: number } | undefined,
  NotificationDatabaseError,
  NotificationRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const [marked] = yield* repo.markRead({ userId, id })
    if (marked === undefined) return undefined
    return { notification: marked, unreadCount: yield* repo.unreadCountFor(userId) }
  }).pipe(Effect.withSpan('automations.mark-my-notification-read'))

/** Mark every unread notification of hers read. */
export const markAllMyNotificationsReadProgram = (
  userId: string
): Effect.Effect<
  { readonly marked: number; readonly unreadCount: number },
  NotificationDatabaseError,
  NotificationRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const marked = yield* repo.markAllRead(userId)
    return { marked, unreadCount: yield* repo.unreadCountFor(userId) }
  }).pipe(Effect.withSpan('automations.mark-all-my-notifications-read'))

/** Her channels for every declared kind, in declaration order. */
export const myNotificationPreferencesProgram = (
  app: App,
  userId: string
): Effect.Effect<readonly KindPreference[], NotificationDatabaseError, NotificationRepository> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    const chosen = chosenByPerson(yield* repo.preferencesOf([userId]))
    return (app.notifications?.kinds ?? []).map((kind) => ({
      kind: kind.name,
      label: kindLabelOf(kind),
      channels: channelsFor(kind, chosen.get(`${userId}\u0000${kind.name}`)),
    }))
  }).pipe(Effect.withSpan('automations.my-notification-preferences'))

/**
 * Change her channels for some kinds; a channel a change leaves out keeps its
 * value. Answers the kinds the app does not declare, and changes nothing when
 * there is one.
 */
export const changeMyNotificationPreferencesProgram = (
  app: App,
  userId: string,
  changes: readonly { readonly kind: string; readonly channels: Partial<NotificationChannels> }[]
): Effect.Effect<
  | { readonly _tag: 'Undeclared'; readonly undeclared: readonly string[] }
  | { readonly _tag: 'Changed'; readonly preferences: readonly KindPreference[] },
  NotificationDatabaseError,
  NotificationRepository
> =>
  Effect.gen(function* () {
    const undeclared = changes
      .map((change) => change.kind)
      .filter((kind) => declaredKind(app.notifications, kind) === undefined)
    if (undeclared.length > 0) return { _tag: 'Undeclared', undeclared } as const
    const current = new Map(
      (yield* myNotificationPreferencesProgram(app, userId)).map((entry) => [
        entry.kind,
        entry.channels,
      ])
    )
    const repo = yield* NotificationRepository
    yield* repo.savePreferences(
      changes.map((change) => ({
        userId,
        kind: change.kind,
        ...changeChannels(current.get(change.kind)!, change.channels),
      }))
    )
    return {
      _tag: 'Changed',
      preferences: yield* myNotificationPreferencesProgram(app, userId),
    } as const
  }).pipe(Effect.withSpan('automations.change-my-notification-preferences'))

/** Every notification and changed preference of hers, for her account export. */
export const exportMyNotificationsProgram = (
  userId: string
): Effect.Effect<
  {
    readonly notifications: readonly StoredNotification[]
    readonly preferences: readonly ChosenChannels[]
  },
  NotificationDatabaseError,
  NotificationRepository
> =>
  Effect.gen(function* () {
    const repo = yield* NotificationRepository
    return {
      notifications: yield* repo.everyFor(userId),
      preferences: yield* repo.preferencesOf([userId]),
    }
  }).pipe(Effect.withSpan('automations.export-my-notifications'))

/** One stored notification as its recipient reads it. */
export const toNotificationView = (stored: StoredNotification) => ({
  id: stored.id,
  kind: stored.kind,
  title: stored.title,
  body: stored.body,
  source:
    stored.sourceTable !== null && stored.sourceRecordId !== null
      ? { table: stored.sourceTable, recordId: stored.sourceRecordId }
      : null,
  read: stored.readAt !== null,
  createdAt: stored.createdAt.toISOString(),
  readAt: stored.readAt?.toISOString() ?? null,
})
