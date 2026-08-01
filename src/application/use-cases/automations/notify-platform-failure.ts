/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { sendEmail } from '@/infrastructure/email/email-service'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

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
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findAdminEmails('admin')
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    Effect.catchAll((error) => {
      logError('[notify-platform-failure] admin email lookup failed', error.cause)
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
      logError('[notify-platform-failure] sendEmail failed', err.cause, { to })
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
