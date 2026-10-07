/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Rendering and delivering the operator emails an automation sends: the
 * failure alert, the interrupted-run alert, the hourly roll-up, and the pause
 * and resume notices.
 *
 * Every one of them goes to the same audience — the recipients of the
 * "Automation alerts" email (`resolveNotificationRecipients`, kind
 * `automationAlerts`) — and every one of them is silenced by
 * `SOVRIUM_NOTIFY_AUTOMATIONS=off`. Keeping the audience and the kill switch in
 * one place is what stops one of the five from paging somebody the other four
 * would not.
 *
 * Delivery never fails its caller. Each notice follows something that already
 * happened — a failed run, a pause that is already recorded — and a broken
 * mail path must not turn that event into an error. Failures are logged with
 * their cause.
 */

import { Effect } from 'effect'
import { EmailSender } from '@/application/ports/services/email-sender'
import { resolveNotificationRecipients } from '@/application/use-cases/admin/resolve-notification-recipients'
import { formatAppIdentity } from '@/domain/kernel/format/app-identity'
import { parseSovriumNotifyAutomations } from '@/domain/models/process-env/notifications'
import {
  renderSystemNotification,
  type SystemNotificationEmail,
  type SystemNotificationLink,
  type SystemNotificationSection,
} from '@/infrastructure/email/system-notification-template'
import { logError } from '@/infrastructure/logging/logger'
import { getSovriumVersion } from '@/infrastructure/process/version'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/** An environment to read, the process environment by default. */
export type NoticeEnv = Readonly<Record<string, string | undefined>>

/** The console base built from `BASE_URL`, or `undefined` when it is not set. */
export const consoleBase = (env: NoticeEnv): string | undefined => {
  const baseUrl = env['BASE_URL']?.trim()
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}/_admin` : undefined
}

/** What one notice says; the frame around it is the same for all of them. */
export interface AutomationNoticeContent {
  readonly title: string
  readonly intro: string
  readonly sections: readonly SystemNotificationSection[]
  /**
   * Printed when `BASE_URL` is unset and no link can be built, so the reader
   * still has something to search the console for (a run id).
   */
  readonly fallbackLines?: readonly string[]
}

/**
 * Render one notice. Pure: every value it prints arrives as a parameter. The
 * action opens the console's automations page and the footer the reader's own
 * profile, where each operator switches these emails off — both absolute,
 * built from `BASE_URL`, and both omitted when it is unset.
 */
export const renderAutomationNotice = (
  app: App,
  engineVersion: string,
  env: NoticeEnv,
  content: AutomationNoticeContent
): SystemNotificationEmail => {
  const base = consoleBase(env)
  const action: SystemNotificationLink | undefined =
    base === undefined
      ? undefined
      : { label: 'Open automations', href: `${base}/automations?tab=automations` }
  const fallback =
    base === undefined && content.fallbackLines !== undefined
      ? [{ lines: content.fallbackLines }]
      : []
  return renderSystemNotification({
    appName: app.name,
    appIdentity: formatAppIdentity({ name: app.name, version: app.version, engineVersion }),
    title: content.title,
    intro: content.intro,
    sections: [...content.sections, ...fallback],
    ...(action === undefined ? {} : { action }),
    footerLinks:
      base === undefined
        ? []
        : [{ label: 'Manage your notification emails', href: `${base}/profile` }],
  })
}

/** Send to one recipient; a failure is logged and swallowed. */
const sendOne = (
  to: string,
  email: SystemNotificationEmail,
  fromName: string
): Effect.Effect<void, never, EmailSender> =>
  Effect.gen(function* () {
    return yield* (yield* EmailSender).send({
      to,
      fromName,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[automation-notice] send failed', cause, { to }))
    ),
    // effect-swallow: the notice follows an event that already happened; a
    // broken mail path is logged above and must not fail that event.
    Effect.catch(() => Effect.void),
    Effect.asVoid
  )

/**
 * SMTP-send fan-out width. The recipient list is data-dependent, so the width
 * is stated rather than `'unbounded'`.
 */
const NOTICE_SEND_CONCURRENCY = 2

/**
 * Send one notice to the automation-alert recipients, minus `exclude` (the
 * operator whose own action it reports), and answer how many it went to — `0`
 * when alerts are off or nobody is left to tell.
 */
export const deliverAutomationNotice = (input: {
  readonly app: App
  readonly content: AutomationNoticeContent
  readonly exclude?: string | undefined
  readonly env?: NoticeEnv | undefined
}): Effect.Effect<number, never, AuthRepository | EmailSender> =>
  Effect.gen(function* () {
    const env = input.env ?? process.env
    if (parseSovriumNotifyAutomations(env) === 'off') return 0
    const excluded = input.exclude?.toLowerCase()
    const recipients = (yield* resolveNotificationRecipients(
      input.app,
      'automationAlerts',
      env
    )).filter((address) => address.toLowerCase() !== excluded)
    if (recipients.length === 0) return 0
    // effect-promise: total -- getSovriumVersion never rejects; it degrades to '0.0.0'
    const engineVersion = yield* Effect.promise(() => getSovriumVersion())
    const email = renderAutomationNotice(input.app, engineVersion, env, input.content)
    yield* Effect.forEach(recipients, (to) => sendOne(to, email, input.app.name), {
      concurrency: NOTICE_SEND_CONCURRENCY,
      discard: true,
    })
    return recipients.length
  }).pipe(Effect.withSpan('automations.deliver-automation-notice'))
