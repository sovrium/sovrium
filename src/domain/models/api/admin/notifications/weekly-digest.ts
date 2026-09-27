/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The weekly summary an instance emails its operators.
 *
 * One document, two jobs:
 *
 *   - the `metrics` JSON of a row in `system.admin_digest_snapshots`, which is
 *     what the next week's summary compares itself against;
 *   - the body of `POST /api/internal/notifications/weekly-digest`, the
 *     token-gated trigger route that computes and sends a summary on demand.
 *
 * The document is VERSIONED (`v: 1`). It is persisted, so a later shape reads
 * rows written by an earlier binary: the version says which decoder applies,
 * and a new version is a new literal, never a silent change to this one.
 *
 * COUNTS ONLY. Nothing here carries a record value, a user's email or name, or
 * a secret. The one free-text field is the first line of a failing
 * automation's last error, which the run store has already redacted, capped at
 * 200 characters. Adding any field that carries a stored value or an identity
 * breaks the promise the email makes to the people who receive it.
 *
 * Every period boundary is an ISO 8601 instant; `period.timezone` names the
 * operator zone (`SOVRIUM_TIMEZONE`) the email renders those instants in.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

/** A count: a non-negative integer. */
const count = (description: string) =>
  Schema.Finite.annotate({ description }).pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  )

/** A signed change against the previous week, or null when there is none. */
const delta = (description: string) =>
  Schema.NullOr(
    Schema.Finite.annotate({ description }).pipe(Schema.check(Schema.isInt()))
  ).annotate({ description })

/** Free text capped at `max` characters. */
const boundedText = (description: string, max: number) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isMaxLength(max)))

// ─── app + period ─────────────────────────────────────────────────────────────

const digestAppSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The app name, as its config declares it' }),
  version: Schema.NullOr(
    Schema.String.annotate({ description: 'The app version, when its config declares one' })
  ).annotate({ description: 'The app version, or null when its config declares none' }),
  engineVersion: Schema.String.annotate({
    description: 'The version of the Sovrium engine that computed this summary',
  }),
}).annotate({ description: 'Which app and which engine the summary describes' })

const digestPeriodSchema = Schema.Struct({
  start: looseIsoDateTime({ description: 'Start of the period, inclusive (ISO 8601 instant)' }),
  end: looseIsoDateTime({ description: 'End of the period, exclusive (ISO 8601 instant)' }),
  timezone: Schema.String.annotate({
    description: 'The operator timezone (IANA name) the email renders the period in',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  baseline: Schema.Boolean.annotate({
    description:
      'True when no earlier summary exists to compare against: every change figure is then null',
  }),
}).annotate({ description: 'The half-open period [start, end) the figures cover' })

// ─── automations ──────────────────────────────────────────────────────────────

const failingAutomationSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The config automation name' }),
  failures: count('How many runs of this automation failed in the period'),
  lastError: Schema.NullOr(
    boundedText(
      'First line of the last failed run error, already redacted by the run store, at most 200 characters',
      200
    )
  ).annotate({ description: 'First line of the last error, or null when it recorded none' }),
}).annotate({ description: 'One of the automations that failed most in the period' })

const pausedAutomationSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The config automation name' }),
  automatic: Schema.Boolean.annotate({
    description:
      'True when the platform paused it after consecutive failures, false when an operator did',
  }),
  since: looseIsoDateTime({ description: 'When the pause began (ISO 8601 instant)' }),
}).annotate({ description: 'An automation paused at the end of the period' })

const digestAutomationsSchema = Schema.Struct({
  runs: count('Runs started in the period'),
  failures: count('Runs in the period that ended failed, including timed-out and interrupted ones'),
  timedOut: count('Runs in the period that ended by exceeding their timeout'),
  interrupted: count('Runs in the period that a server stop cut short'),
  successRate: Schema.NullOr(
    Schema.Finite.annotate({
      description: 'Share of the period runs that did not fail, between 0 and 1',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)))
  ).annotate({ description: 'Share of runs that did not fail, or null when nothing ran' }),
  topFailing: Schema.Array(failingAutomationSchema)
    .annotate({ description: 'The automations with the most failures, most first, at most 5' })
    .pipe(Schema.check(Schema.isMaxLength(5))),
  paused: Schema.Array(pausedAutomationSchema).annotate({
    description: 'Every automation paused at the end of the period',
  }),
}).annotate({ description: 'What the automations did in the period' })

// ─── data ─────────────────────────────────────────────────────────────────────

const digestTableSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The table name, as its config declares it' }),
  rows: count('Rows in the table at the end of the period'),
  rowsDelta: delta('Change in row count against the previous summary; null on a baseline week'),
  written: count('Rows created or updated in the period'),
}).annotate({ description: 'One table of the app' })

const digestDataSchema = Schema.Struct({
  tables: Schema.Array(digestTableSchema).annotate({
    description: 'Every table the app declares, by name',
  }),
  newUsers: count('Accounts created in the period'),
  activeUsers: count('Distinct accounts that held a session in the period'),
  submissions: count('Form submissions received in the period'),
  uploads: Schema.Struct({
    files: count('Files stored in the period'),
    bytes: count('Bytes stored in the period'),
  }).annotate({ description: 'Files uploaded to buckets in the period' }),
}).annotate({ description: 'What the app data did in the period — counts only, never values' })

// ─── system ───────────────────────────────────────────────────────────────────

const versionChangeSchema = Schema.Struct({
  at: looseIsoDateTime({ description: 'When the instance first booted on the new version' }),
  from: Schema.String.annotate({ description: 'The engine version before the change' }),
  to: Schema.String.annotate({ description: 'The engine version after the change' }),
}).annotate({ description: 'One engine version change in the period' })

const auditErrorGroupSchema = Schema.Struct({
  action: Schema.String.annotate({ description: 'The audit action, e.g. automation.run.failed' }),
  count: count('Error and critical audit entries of this action in the period'),
}).annotate({ description: 'Error and critical audit entries of one action' })

const digestSystemSchema = Schema.Struct({
  databaseBytes: count('Size of the database at the end of the period, in bytes'),
  databaseBytesDelta: delta(
    'Change in database size against the previous summary; null on a baseline week'
  ),
  storageBytes: count('Bytes held in file storage at the end of the period'),
  storageBytesDelta: delta(
    'Change in stored bytes against the previous summary; null on a baseline week'
  ),
  connections: Schema.Struct({
    healthy: count('Connections currently reporting a healthy status'),
    total: count('Connections the app declares'),
  }).annotate({ description: 'Health of the declared connections at the end of the period' }),
  versionChanges: Schema.Array(versionChangeSchema).annotate({
    description: 'Engine version changes in the period, oldest first',
  }),
  errors: Schema.Array(auditErrorGroupSchema)
    .annotate({
      description: 'Error and critical audit entries grouped by action, most first, at most 5',
    })
    .pipe(Schema.check(Schema.isMaxLength(5))),
}).annotate({ description: 'The state of the instance itself' })

// ─── attention ────────────────────────────────────────────────────────────────

const digestAttentionSchema = Schema.Struct({
  unsetVariables: count('Environment variables the app requires that are not set'),
  expiredTokens: count('Connections whose token has expired'),
  pendingInvitations: count('Invitations still awaiting acceptance'),
}).annotate({ description: 'What is waiting on an operator at the end of the period' })

// ─── the document ─────────────────────────────────────────────────────────────

/**
 * The weekly summary, version 1.
 *
 * `previous` names the period end of the summary this one was compared with,
 * and is null exactly when `period.baseline` is true.
 */
export const weeklyDigestSchema = Schema.Struct({
  v: Schema.Literal(1).annotate({ description: 'Document version' }),
  app: digestAppSchema,
  period: digestPeriodSchema,
  automations: digestAutomationsSchema,
  data: digestDataSchema,
  system: digestSystemSchema,
  attention: digestAttentionSchema,
  previous: Schema.NullOr(
    Schema.Struct({
      periodEnd: looseIsoDateTime({
        description: 'End of the period of the summary this one compares against',
      }),
    }).annotate({ description: 'The earlier summary the change figures are measured against' })
  ).annotate({ description: 'The earlier summary compared against, or null on a baseline week' }),
}).annotate({ identifier: 'WeeklyDigest' })

/** @public */
export type WeeklyDigest = typeof weeklyDigestSchema.Type

/**
 * `POST /api/internal/notifications/weekly-digest` response.
 *
 * `sent` is false when the summary is switched off (`SOVRIUM_NOTIFY_DIGEST=off`),
 * when nobody is left to receive it, or when delivery failed; the digest is
 * computed either way, so a test and an operator can read the figures.
 */
export const weeklyDigestTriggerResponseSchema = Schema.Struct({
  sent: Schema.Boolean.annotate({ description: 'Whether the summary email was delivered' }),
  recipients: count('How many addresses the summary was sent to'),
  digest: weeklyDigestSchema,
}).annotate({ identifier: 'WeeklyDigestTriggerResponse' })

/** @public */
export type WeeklyDigestTriggerResponse = typeof weeklyDigestTriggerResponseSchema.Type
