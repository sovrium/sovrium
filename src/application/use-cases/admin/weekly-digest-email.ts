/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the weekly summary email says, rendered from the computed document.
 *
 * PURE: every value it prints arrives in the `WeeklyDigest` — counts,
 * automation and table names, audit action names, the first line of a failing
 * automation's last error — so nothing here can reach a record value, an
 * account's email or name. The frame (subject with the app name, escaping
 * of every interpolation, the footer) is the one every operator email shares,
 * `renderSystemNotification`.
 *
 * Every date is written on the OPERATOR's calendar (`period.timezone`), never
 * on UTC's: a period starting at 23:30 UTC on a Sunday starts on Monday for an
 * operator in Paris, and the email says Monday.
 */

import { consoleBase, type NoticeEnv } from '@/application/use-cases/automations/automation-notice'
import { formatAppIdentity } from '@/domain/kernel/format/app-identity'
import { formatByteCount } from '@/domain/kernel/format/byte-format'
import { zonedIsoDate } from '@/domain/kernel/time/zoned-calendar'
import {
  renderSystemNotification,
  type SystemNotificationEmail,
  type SystemNotificationSection,
} from '@/infrastructure/email/system-notification-template'
import type { WeeklyDigest } from '@/domain/models/api/admin/notifications/weekly-digest'
import type { App } from '@/domain/models/app'

/** An instant as `YYYY-MM-DD` in the digest's operator zone. */
const day = (digest: WeeklyDigest, iso: string): string =>
  zonedIsoDate(new Date(iso), digest.period.timezone)

/** `n noun` with the plural when it applies. */
const plural = (count: number, noun: string, nouns = `${noun}s`): string =>
  `${count} ${count === 1 ? noun : nouns}`

/** A signed change of a count: `+3`, `-2`, or `no change`, with an optional suffix. */
const countChange = (delta: number | null, suffix = ''): string => {
  if (delta === null) return ''
  if (delta === 0) return ' (no change)'
  return ` (${delta > 0 ? '+' : ''}${delta}${suffix})`
}

/** A signed change of a size: `+12 KB`, `-3 MB`, or `no change`. */
const byteChange = (delta: number | null): string => {
  if (delta === null) return ''
  if (delta === 0) return ' (no change)'
  return ` (${delta > 0 ? '+' : '-'}${formatByteCount(Math.abs(delta))})`
}

/**
 * The things that need the operator, each with its count, zeros dropped: the
 * automations the instance paused on its own, then the attention counts. One
 * list feeds both the headline and the "Waiting on you" section, so the two
 * can never disagree.
 */
interface AttentionItem {
  readonly count: number
  readonly label: string
  /** The automatic pauses, which the section lists by name instead. */
  readonly paused?: true
}

const attentionItems = (digest: WeeklyDigest): readonly AttentionItem[] => {
  const autoPaused = digest.automations.paused.filter((entry) => entry.automatic).length
  const { attention } = digest
  return [
    {
      count: autoPaused,
      paused: true as const,
      label: plural(
        autoPaused,
        'automation paused after repeated failures',
        'automations paused after repeated failures'
      ),
    },
    {
      count: attention.unsetVariables,
      label: plural(attention.unsetVariables, 'unset environment variable'),
    },
    {
      count: attention.expiredTokens,
      label: plural(attention.expiredTokens, 'expired connection token'),
    },
    {
      count: attention.pendingInvitations,
      label: plural(attention.pendingInvitations, 'pending invitation'),
    },
  ].filter((item) => item.count > 0)
}

/** The one line under the title: how many things need the operator, and which. */
const headline = (digest: WeeklyDigest): string => {
  const items = attentionItems(digest)
  if (items.length === 0) return 'Nothing needs you this week.'
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const verb = total === 1 ? 'thing needs' : 'things need'
  return `${total} ${verb} you: ${items.map((item) => item.label).join(', ')}.`
}

const attentionSection = (digest: WeeklyDigest): SystemNotificationSection => {
  const paused = digest.automations.paused.map((entry) =>
    entry.automatic
      ? `- ${entry.name}: paused automatically on ${day(digest, entry.since)} after repeated failures. Resume it from the console.`
      : `- ${entry.name}: paused by an operator on ${day(digest, entry.since)}.`
  )
  const counts = attentionItems(digest)
    .filter((item) => item.paused !== true)
    .map((item) => `- ${item.label}`)
  const lines = [...paused, ...counts]
  return {
    heading: 'Waiting on you',
    lines: lines.length === 0 ? ['Nothing is waiting on you.'] : lines,
  }
}

const automationsSection = (digest: WeeklyDigest): SystemNotificationSection => {
  const { automations } = digest
  const outcomes =
    automations.timedOut > 0 || automations.interrupted > 0
      ? ` (${automations.timedOut} timed out, ${automations.interrupted} interrupted)`
      : ''
  const summary =
    automations.successRate === null
      ? 'No runs'
      : `${plural(automations.runs, 'run')}, ${automations.failures} failed (${Math.round(automations.successRate * 100)}% succeeded)${outcomes}`
  const failing = automations.topFailing.map(
    (entry) =>
      `- ${entry.name}: ${plural(entry.failures, 'failure')}${entry.lastError === null ? '' : ` — ${entry.lastError}`}`
  )
  return {
    heading: 'Automations',
    lines: [summary, ...(failing.length === 0 ? [] : ['Failing most:', ...failing])],
  }
}

const dataSection = (digest: WeeklyDigest): SystemNotificationSection => {
  const { data } = digest
  const tables = data.tables.map(
    (table) =>
      `- ${table.name}: ${plural(table.rows, 'row')}${countChange(table.rowsDelta, ' this week')}, ${table.written} added or edited`
  )
  return {
    heading: 'Data',
    lines: [
      ...(tables.length === 0 ? ['Tables: none declared'] : ['Tables:', ...tables]),
      `New accounts: ${data.newUsers}`,
      `Accounts that signed in: ${data.activeUsers}`,
      `Form submissions: ${data.submissions}`,
      data.uploads.files === 0
        ? 'Uploads: none'
        : `Uploads: ${plural(data.uploads.files, 'file')}, ${formatByteCount(data.uploads.bytes)}`,
    ],
  }
}

const systemSection = (digest: WeeklyDigest): SystemNotificationSection => {
  const { system } = digest
  // The heading already says whose version moved; the line carries no brand,
  // since the app's own name is the only one the email speaks under.
  const versions = system.versionChanges.map(
    (change) => `- ${change.from} to ${change.to} on ${day(digest, change.at)}`
  )
  const errors = system.errors.map((entry) => `- ${entry.action}: ${entry.count}`)
  return {
    heading: 'Instance',
    lines: [
      `Database: ${formatByteCount(system.databaseBytes)}${byteChange(system.databaseBytesDelta)}`,
      `File storage: ${formatByteCount(system.storageBytes)}${byteChange(system.storageBytesDelta)}`,
      system.connections.total === 0
        ? 'Connections: none declared'
        : `Connections: ${system.connections.healthy} of ${system.connections.total} healthy`,
      ...(versions.length === 0 ? [] : ['Engine updates:', ...versions]),
      ...(errors.length === 0
        ? ['Errors: none recorded']
        : ['Errors and critical events by action:', ...errors]),
    ],
  }
}

/** The paragraph under the title: the headline, then what the brackets mean. */
const intro = (digest: WeeklyDigest): string => {
  const compared =
    digest.previous === null
      ? 'This is the first summary, so there are no week-on-week changes yet.'
      : "Figures in brackets are the change since last week's summary."
  return `${headline(digest)} ${compared}`
}

/**
 * Render the weekly summary email. The action opens the console and the footer
 * the reader's own profile, where each operator switches the summary off —
 * both absolute, built from `BASE_URL`, and both omitted when it is unset.
 */
export const renderWeeklyDigestEmail = (
  app: App,
  digest: WeeklyDigest,
  env: NoticeEnv
): SystemNotificationEmail => {
  const base = consoleBase(env)
  const start = day(digest, digest.period.start)
  const end = day(digest, digest.period.end)
  return renderSystemNotification({
    appName: app.name,
    appIdentity: formatAppIdentity({
      name: app.name,
      version: app.version,
      engineVersion: digest.app.engineVersion,
    }),
    // The period is said ONCE, here: the title is both the subject and the
    // heading, so it reaches the inbox list as well as the body.
    title: `Weekly summary, ${start} to ${end}, ${digest.period.timezone}`,
    intro: intro(digest),
    sections: [
      attentionSection(digest),
      automationsSection(digest),
      dataSection(digest),
      systemSection(digest),
    ],
    ...(base === undefined ? {} : { action: { label: 'Open the console', href: base } }),
    footerLinks:
      base === undefined ? [] : [{ label: 'Stop or change these emails', href: `${base}/profile` }],
  })
}
