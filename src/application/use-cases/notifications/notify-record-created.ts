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
import { sanitizeRichTextHTML, stripHtmlToText } from '@/domain/utils/html-sanitization'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { sendEmailWithOptions } from '@/infrastructure/email/email-service'
import type { App } from '@/domain/models/app'


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

const toSingular = (name: string): string =>
  name.length > 1 && name.endsWith('s') ? name.slice(0, -1) : name

const findRecordCreatedTemplate = (
  templates: Readonly<Record<string, NotificationTemplateLite>> | undefined,
  tableName: string
): NotificationTemplateLite | undefined => {
  if (templates === undefined) return undefined
  const singularKey = `${toSingular(tableName)}Created`
  return templates[singularKey] ?? templates['recordCreated']
}

const substituteVariables = (template: string, vars: Readonly<Record<string, string>>): string =>
  Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{{${key}}}`).join(value), template)

const findEmailChannel = (
  channels: ReadonlyArray<NotificationChannelLite> | undefined
): NotificationChannelLite | undefined => {
  if (channels === undefined) return undefined
  return channels.find((c) => c.type === 'email' && c.enabled !== false)
}

const shouldSendImmediateEmail = (channel: NotificationChannelLite): boolean =>
  channel.digest?.defaultFrequency === 'immediate'

class LookupUserEmailError extends Data.TaggedError('LookupUserEmailError')<{
  readonly cause: unknown
}> {}

class NotificationEmailSendError extends Data.TaggedError('NotificationEmailSendError')<{
  readonly cause: unknown
}> {}

const lookupUserEmail = Effect.fn('lookupUserEmail')(function* (userId: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const users = authUsersTable()
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
    const textBody = stripHtmlToText(body).trim()
    yield* Effect.tryPromise({
      try: () =>
        sendEmailWithOptions({
          from,
          to: recipientEmail,
          subject,
          html: sanitizeRichTextHTML(body),
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
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[notification] notifyRecordCreated failed', cause)
      })
    )
  )
