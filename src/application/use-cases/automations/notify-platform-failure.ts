/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { sendEmail } from '@/infrastructure/email/email-service'
import { logDebug } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

class AdminLookupError extends Data.TaggedError('AdminLookupError')<{
  readonly cause: unknown
}> {}

class AdminEmailSendError extends Data.TaggedError('AdminEmailSendError')<{
  readonly cause: unknown
}> {}

interface NotifyPlatformFailureInput {
  readonly app: App
  readonly automationName: string
  readonly runId: string
  readonly error: string
  readonly failedAt: string
}

const buildRunLink = (automationName: string, runId: string): string =>
  `/api/automations/${automationName}/runs/${runId}`

const renderFailureEmail = (
  input: NotifyPlatformFailureInput
): { readonly subject: string; readonly body: string } => {
  const runLink = buildRunLink(input.automationName, input.runId)
  const subject = `Automation failed: ${input.automationName}`
  const body = [
    `Automation: ${input.automationName}`,
    `Error: ${input.error}`,
    `Failed at: ${input.failedAt}`,
    `Run details: ${runLink}`,
  ].join('\n')
  return { subject, body }
}

const loadAdminEmails = (): Effect.Effect<readonly string[], never> =>
  Effect.tryPromise({
    try: async () => {
      const users = authUsersTable()
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.role, 'admin'))
      return rows.map((r) => r.email).filter((e): e is string => typeof e === 'string' && e !== '')
    },
    catch: (cause) => new AdminLookupError({ cause }),
  }).pipe(
    Effect.catchAll((err) => {
      logDebug(`[notify-platform-failure] admin email lookup failed: ${String(err.cause)}`)
      return Effect.succeed([] as readonly string[])
    })
  )

const sendOneNotification = (
  to: string,
  subject: string,
  body: string
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => sendEmail({ to, subject, text: body, html: body.replaceAll('\n', '<br>') }),
    catch: (cause) => new AdminEmailSendError({ cause }),
  }).pipe(
    Effect.catchAll((err) => {
      logDebug(`[notify-platform-failure] sendEmail to ${to} failed: ${String(err.cause)}`)
      return Effect.void
    }),
    Effect.asVoid
  )

export const notifyPlatformFailure = (
  input: NotifyPlatformFailureInput
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!input.app.auth) return
    const adminEmails = yield* loadAdminEmails()
    if (adminEmails.length === 0) return
    const { subject, body } = renderFailureEmail(input)
    yield* Effect.forEach(adminEmails, (email) => sendOneNotification(email, subject, body), {
      concurrency: 'unbounded',
      discard: true,
    })
  })
