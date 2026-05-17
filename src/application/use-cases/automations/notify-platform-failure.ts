/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Platform failure notifications (US-AUTOMATIONS-RETRY-AND-FAILURE-002).
 *
 * When an automation fails after exhausting its retry budget, the platform
 * sends an email to every user with the `admin` role so failures are never
 * silently lost. Analogous to Zapier's built-in "Zap failed" email — no
 * configuration knob, always active when `app.auth` is configured.
 *
 * Contract assertions (APP-AUTOMATION-RETRY-003..005):
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

import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
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
 * Load every admin user's email from `auth.users`.
 *
 * Direct `db.select` (not a port) is consistent with the run-automation
 * module's other infra reaches (StorageService, AiService) — the Phase 1
 * pragmatic layer rule permits use-cases to import infrastructure.
 */
const loadAdminEmails = (): Effect.Effect<readonly string[], never> =>
  Effect.tryPromise({
    try: async () => {
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
    Effect.catchAll((err) => {
      logDebug(`[notify-platform-failure] sendEmail to ${to} failed: ${String(err.cause)}`)
      return Effect.void
    }),
    Effect.asVoid
  )

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
      concurrency: 'unbounded',
      discard: true,
    })
  })
