/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { NotificationSubscriptionRepository } from '@/application/ports/repositories/notification-subscription-repository'
import { NotificationService } from '@/application/ports/services/notification-service'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { sendEmailWithOptions } from '@/infrastructure/email/email-service'
import type { App } from '@/domain/models/app'

/**
 * Resolve recipients for a `recordCreated` event and dispatch a
 * notification to each.
 *
 * Recipient set:
 *   - The creator (always; specs assert the creator sees a confirmation
 *     notification in their inbox even without an explicit subscription).
 *   - Table-wide subscribers (rows with `recordId IS NULL` for this
 *     `tableName`).
 *
 * Deduplicated by user id so the creator who is also a subscriber gets
 * exactly one notification, not two.
 *
 * No-op when no matching template is found in
 * `app.notifications.templates` — apps that don't define a template opt
 * out of automatic dispatch. Template lookup tries
 * `${tableNameSingular}Created` first (e.g. `taskCreated` for the
 * `tasks` table) then falls back to the generic `recordCreated` key.
 *
 * Errors are swallowed at the boundary: the upstream record-create
 * operation succeeds independently of notification delivery.
 *
 * Email channel: when `app.notifications.channels` declares an enabled
 * `email` channel with `digest.defaultFrequency === 'immediate'`, each
 * notification is also sent as a separate email via the configured SMTP
 * transport (Mailpit in dev/test). Hourly and daily digest frequencies
 * batch notifications instead and are not delivered via this synchronous
 * path; their schedulers live elsewhere. When the channel exists but no
 * digest config is present, no email is sent (conservative default).
 *
 * Replaces the previous infrastructure-layer
 * `triggerRecordCreatedNotifications` function (audit H6) so route
 * handlers no longer import directly from `infrastructure/notifications/`.
 */

interface NotificationTemplateLite {
  readonly title?: string
  readonly body?: string
  readonly channels?: ReadonlyArray<'inApp' | 'email'>
}

interface DigestConfigLite {
  readonly defaultFrequency?: 'immediate' | 'hourly' | 'daily'
  readonly dailyTime?: string
}

interface NotificationChannelLite {
  readonly type: 'inApp' | 'email'
  readonly enabled?: boolean
  readonly from?: string
  readonly replyTo?: string
  readonly digest?: DigestConfigLite
}

interface AppNotifications {
  readonly templates?: Readonly<Record<string, NotificationTemplateLite>>
  readonly channels?: ReadonlyArray<NotificationChannelLite>
}

export interface NotifyRecordCreatedInput {
  readonly app: App
  readonly creatorUserId: string
  readonly tableName: string
  readonly recordId: string
}

/**
 * Strip a single trailing `s` to get a naive singular form. Sufficient
 * for the spec test cases (`tasks` -> `task`, `orders` -> `order`).
 * Words shorter than 2 chars or not ending in `s` are returned as-is.
 */
const toSingular = (name: string): string =>
  name.length > 1 && name.endsWith('s') ? name.slice(0, -1) : name

/**
 * Lookup the template for a record-created event. Tries the table-name
 * singular variant first (`taskCreated` for `tasks`) so spec authors can
 * write entity-specific templates, then falls back to the generic
 * `recordCreated` key.
 */
const findRecordCreatedTemplate = (
  templates: Readonly<Record<string, NotificationTemplateLite>> | undefined,
  tableName: string
): NotificationTemplateLite | undefined => {
  if (templates === undefined) return undefined
  const singularKey = `${toSingular(tableName)}Created`
  return templates[singularKey] ?? templates['recordCreated']
}

/**
 * Substitute supported `{{variable}}` placeholders in a template string.
 * Unknown placeholders are left intact rather than blanking them out so
 * downstream readers can see which variable was missing.
 */
const substituteVariables = (template: string, vars: Readonly<Record<string, string>>): string =>
  Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(value), template)

/**
 * Resolve an enabled `email` channel from the app config. Returns
 * `undefined` when no email channel is configured or it is disabled.
 */
const findEmailChannel = (
  channels: ReadonlyArray<NotificationChannelLite> | undefined
): NotificationChannelLite | undefined => {
  if (channels === undefined) return undefined
  return channels.find((c) => c.type === 'email' && c.enabled !== false)
}

/**
 * Whether the email channel's digest config indicates immediate delivery.
 * Hourly/daily digests are batched by a separate scheduler and skipped
 * here; channels without an explicit digest also skip (conservative).
 */
const shouldSendImmediateEmail = (channel: NotificationChannelLite): boolean =>
  channel.digest?.defaultFrequency === 'immediate'

/**
 * Tagged error for the `lookupUserEmail` query. Preserves the underlying
 * cause for debugging without flattening the Effect error channel into a
 * generic `Error` (effect/globalErrorInEffectCatch).
 */
class LookupUserEmailError extends Data.TaggedError('LookupUserEmailError')<{
  readonly cause: unknown
}> {}

/**
 * Tagged error for the SMTP send call. Mirrors the
 * `EmailSendActionError` pattern used in the email automation handler so
 * the Effect error channel stays type-safe even though both the lookup
 * and the send failures are absorbed at the boundary.
 */
class NotificationEmailSendError extends Data.TaggedError('NotificationEmailSendError')<{
  readonly cause: unknown
}> {}

/**
 * Lookup a user's email + display name for the given user id. Returns
 * `undefined` when no row matches (deleted user, etc).
 */
const lookupUserEmail = Effect.fn('lookupUserEmail')(function* (userId: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      return rows[0]
    },
    catch: (cause) => new LookupUserEmailError({ cause }),
  })
})

/**
 * Send an immediate notification email to a single recipient using the
 * channel's `from` address. Errors are absorbed so a delivery failure
 * does not abort the in-app dispatch.
 */
const sendImmediateNotificationEmail = (input: {
  readonly channel: NotificationChannelLite
  readonly template: NotificationTemplateLite
  readonly recipientEmail: string
  readonly recipientName: string
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const { channel, template, recipientEmail, recipientName, tableName, recordId } = input
    const { from = 'noreply@sovrium.com', replyTo } = channel
    const vars = {
      tableName,
      userName: recipientName,
      recordTitle: recordId,
      recordId,
      taskTitle: recordId,
    }
    const subject = substituteVariables(template.title ?? 'Record created', vars)
    const body = substituteVariables(template.body ?? '', vars)
    const textBody = body.replaceAll(/<[^>]*>/g, '').trim()
    yield* Effect.tryPromise({
      try: () =>
        sendEmailWithOptions({
          from,
          to: recipientEmail,
          subject,
          html: body,
          text: textBody === '' ? body : textBody,
          ...(replyTo !== undefined && replyTo !== '' ? { replyTo } : {}),
        }),
      catch: (cause) => new NotificationEmailSendError({ cause }),
    })
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[notification] email dispatch failed', cause)
      })
    )
  )

/**
 * Resolve the recipient set for a record-created event: the creator
 * (always included) plus table-wide subscribers, deduplicated by user
 * id. Subscription lookup errors collapse to "no extra subscribers"
 * rather than aborting the dispatch.
 */
const resolveRecipients = (
  creatorUserId: string,
  tableName: string
): Effect.Effect<ReadonlySet<string>, never, NotificationSubscriptionRepository> =>
  Effect.gen(function* () {
    const subscriptionRepo = yield* NotificationSubscriptionRepository
    const subscribersResult = yield* Effect.either(
      subscriptionRepo.findByTableAndRecord({ tableName })
    )
    const subscriberIds =
      subscribersResult._tag === 'Right'
        ? subscribersResult.right.map((row) => String(row['userId'] ?? ''))
        : []
    return new Set<string>([creatorUserId, ...subscriberIds.filter((id) => id !== '')])
  })

/**
 * Dispatch the email side of a record-created notification to every
 * resolved recipient. No-ops when the channel is missing, disabled, set
 * to a non-immediate digest, or excluded by the template's `channels`
 * list. Per-recipient errors are absorbed inside
 * `sendImmediateNotificationEmail` itself.
 */
const dispatchEmailNotifications = (input: {
  readonly notifications: AppNotifications | undefined
  readonly template: NotificationTemplateLite
  readonly recipients: ReadonlySet<string>
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<void, never, never> => {
  const emailChannel = findEmailChannel(input.notifications?.channels)
  if (emailChannel === undefined) return Effect.void
  if (!shouldSendImmediateEmail(emailChannel)) return Effect.void
  const { channels: targetChannels } = input.template
  if (targetChannels !== undefined && !targetChannels.includes('email')) return Effect.void

  return Effect.forEach(
    Array.from(input.recipients),
    (userId) =>
      Effect.gen(function* () {
        const userResult = yield* Effect.either(lookupUserEmail(userId))
        if (userResult._tag === 'Left') return
        const user = userResult.right
        if (user === undefined || !user.email) return
        yield* sendImmediateNotificationEmail({
          channel: emailChannel,
          template: input.template,
          recipientEmail: user.email,
          recipientName: user.name ?? user.email,
          tableName: input.tableName,
          recordId: input.recordId,
        })
      }),
    { concurrency: 1, discard: true }
  )
}

export const notifyRecordCreated = (
  input: NotifyRecordCreatedInput
): Effect.Effect<void, never, NotificationService | NotificationSubscriptionRepository> =>
  Effect.gen(function* () {
    const { app, creatorUserId, tableName, recordId } = input
    const { notifications } = app as { readonly notifications?: AppNotifications }
    const template = findRecordCreatedTemplate(notifications?.templates, tableName)
    if (template === undefined) return

    const recipients = yield* resolveRecipients(creatorUserId, tableName)
    const { title = 'Record created', body = '' } = template

    const notificationService = yield* NotificationService

    // Sequential dispatch is fine for this scale; specs hit single-digit
    // recipient counts. Per-recipient errors are absorbed via Effect.either
    // so one failed delivery does not abort the rest.
    yield* Effect.forEach(
      Array.from(recipients),
      (userId) =>
        Effect.either(
          notificationService.send(userId, {
            type: 'recordCreated',
            title,
            message: body,
            data: { tableName, recordId },
          })
        ),
      { concurrency: 1, discard: true }
    )

    yield* dispatchEmailNotifications({
      notifications,
      template,
      recipients,
      tableName,
      recordId,
    })
  }).pipe(
    // Belt-and-braces: any unexpected error from the subscription lookup
    // or service composition collapses to a logged warning rather than
    // breaking the upstream record-create.
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[notification] notifyRecordCreated failed', cause)
      })
    )
  )
