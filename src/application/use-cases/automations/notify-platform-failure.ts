/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Platform failure notifications.
 *
 * When an automation fails after exhausting its retry budget, the platform
 * sends an email to every user with the `admin` role so failures are never
 * silently lost. Analogous to Zapier's built-in "Zap failed" email — no
 * configuration knob, always active when `app.auth` is configured.
 *
 * Contract assertions ([internal ref]..005):
 *   - Fires only AFTER all retries are exhausted (the engine calls this
 *     from `executeAutomationRun` once per run, at the same dispatch site
 *     as `dispatchFailureHandlers`).
 *   - Subject contains the automation name (search query `subject:<name>`).
 *   - Body contains the automation name, the error message, and a link
 *     matching `/api/automations/<name>/runs/<runId>` so operators can
 *     jump to the run detail via the runs API.
 *   - One email per admin per failed run (callers must dispatch once).
 *
 * Failures inside this helper are swallowed: a broken admin-email path
 * MUST NOT re-fail the already-failed run (that would mask the real
 * automation error in logs and tests).
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

/**
 * Build the run-detail URL embedded in the notification email.
 *
 * Tests assert `/api/automations/<name>/runs/<runId>` — a relative path
 * is sufficient (the regression matcher is `/\/api\/automations\/.*\/runs\//`).
 * Operators reading the email in a real deployment can prepend their own
 * host; encoding a server-side `BASE_URL` would couple the use-case to an
 * env var the test fixture doesn't set.
 */
const buildRunLink = (automationName: string, runId: string): string =>
  `/api/automations/${automationName}/runs/${runId}`

/**
 * Render the plain-text body of the failure notification.
 *
 * Subject is intentionally `"Automation failed: <name>"` so the Mailpit
 * search query `subject:<name>` (used by the spec fixture) matches.
 */
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

/**
 * Load every admin user's email via `AuthRepository.findAdminEmails`.
 *
 * `AuthRepositoryLive` is provided here rather than declared in this use case's
 * `R` channel because `notifyPlatformFailure` publishes an `R = never` contract
 * to its callers (the run loop's failure path must be dispatchable without the
 * caller assembling an auth layer). This is a composition seam, not a data reach.
 *
 * A lookup failure degrades to "no admins" — a broken admin-email path MUST NOT
 * re-fail the already-failed run and mask the real automation error.
 */
const loadAdminEmails = (): Effect.Effect<readonly string[], never> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findAdminEmails('admin')
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    Effect.catch((error) => {
      // Unwrap to the raw driver error, matching the payload this line logged
      // before the lookup moved behind the port.
      logError('[notify-platform-failure] admin email lookup failed', error.cause)
      return Effect.succeed([] as readonly string[])
    })
  )

/**
 * Send the failure notification email to a single admin. Failures are
 * swallowed (a broken SMTP must not re-fail the parent run) but logged so
 * operators can investigate.
 */
const sendOneNotification = (
  to: string,
  subject: string,
  body: string
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => sendEmail({ to, subject, text: body, html: body.replaceAll('\n', '<br>') }),
    catch: (cause) => new AdminEmailSendError({ cause }),
  }).pipe(
    Effect.catch((err) => {
      logError('[notify-platform-failure] sendEmail failed', err.cause, { to })
      return Effect.void
    }),
    Effect.asVoid
  )

/**
 * SMTP-send fan-out width for admin failure notifications. Not pool work —
 * these are outbound emails — but the recipient list is data-dependent (every
 * admin), so the width is stated rather than `'unbounded'`.
 */
const NOTIFICATION_SEND_CONCURRENCY = 2

/**
 * Dispatch the platform admin-notification email after a failed automation
 * run. No-op when `app.auth` is not configured (no users → no admins to
 * notify, and the test fixture's auth gate would have already rejected the
 * trigger request anyway).
 *
 * Intentionally exhausts both arms of the `app.auth` guard via early-return
 * so the happy path stays straight-line — keeps complexity below the cap.
 */
export const notifyPlatformFailure = (
  input: NotifyPlatformFailureInput
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (!input.app.auth) return
    const adminEmails = yield* loadAdminEmails()
    if (adminEmails.length === 0) return
    const { subject, body } = renderFailureEmail(input)
    yield* Effect.forEach(adminEmails, (email) => sendOneNotification(email, subject, body), {
      concurrency: NOTIFICATION_SEND_CONCURRENCY,
      discard: true,
    })
  })
