/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Operator opt-in for the one-time `timestamp → timestamptz` reshape of declared
 * `created-at` / `updated-at` / `deleted-at` columns.
 *
 * Env vars: DATABASE_TIMESTAMPTZ_MIGRATION,
 * DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC.
 *
 * ## Why env and NOT AppSchema
 *
 * This is a one-time platform DATA migration over columns that already exist on
 * a running deployment. It describes an operational act — "convert my tables
 * now, I have scheduled the lock" — not application shape, so per the standing
 * infra/app split it belongs in env vars the operator sets at deploy time and no
 * shipped config ever carries.
 *
 * ## Why it is off by default
 *
 * `ALTER TABLE … ALTER COLUMN … TYPE TIMESTAMPTZ` is not a metadata-only change:
 * PostgreSQL rewrites the whole table and holds an `ACCESS EXCLUSIVE` lock for
 * the duration. Firing that automatically at boot would take a downtime window
 * on every running deployment's next deploy, while being completely invisible on
 * a fresh install — the exact failure shape of the v0.12.0 upgrade incident.
 * Default-off turns it into a scheduled act, at the cost of a WARN per drifted
 * column until the operator gets to it.
 *
 * ## Why the second acknowledgement exists
 *
 * The conversion uses PostgreSQL's DEFAULT `timestamp → timestamptz` cast, which
 * interprets the naive stored value in the session `TimeZone`. That is the exact
 * inverse of the write (`CURRENT_TIMESTAMP` is a `timestamptz` implicitly cast
 * DOWN into the naive column through the same GUC), so the instant is preserved
 * on ANY server whose `TimeZone` has been constant — UTC or not.
 *
 * On a NON-UTC server two violations of that constancy assumption become
 * reachable, and neither is observable from the column: a mid-life `TimeZone`
 * change (rows written on either side are wall-clock in different zones, and
 * which zone applied to which row is unrecoverable), and DST fall-back ambiguity
 * (a repeated local hour maps to two instants; PostgreSQL picks one). The
 * preflight therefore refuses to convert on a non-UTC server until the operator
 * has explicitly acknowledged both.
 */
export const TimestamptzMigrationEnvSchema = Schema.Struct({
  migration: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Opt-in for the one-time timestamp → timestamptz column reshape (DATABASE_TIMESTAMPTZ_MIGRATION). Unset means no DDL is emitted.',
        examples: ['on'],
      })
    )
  ),
  acknowledgeNonUtc: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Acknowledgement required to run the reshape on a non-UTC server (DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC).',
        examples: ['1'],
      })
    )
  ),
})

export type TimestamptzMigrationEnvConfig = Schema.Schema.Type<typeof TimestamptzMigrationEnvSchema>

/** The opt-in variable, named verbatim in the drift WARN so operators can act. */
export const TIMESTAMPTZ_MIGRATION_ENV_VAR = 'DATABASE_TIMESTAMPTZ_MIGRATION'

/** The non-UTC acknowledgement, named verbatim in the preflight abort message. */
export const TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR =
  'DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC'

/**
 * Values that turn a gate on, compared case-insensitively after trimming.
 * Everything else — including the EMPTY STRING — leaves it off.
 *
 * Empty must mean off because the E2E harness inherits the parent shell's
 * environment into the spawned test server, so a spec asserting the default
 * neutralizes a leaked parent value by passing an empty string.
 */
const ENABLED_VALUES: ReadonlySet<string> = new Set(['on', 'true', '1', 'yes'])

const isEnabled = (raw: string | undefined): boolean => {
  const normalized = raw?.trim().toLowerCase()
  return normalized !== undefined && ENABLED_VALUES.has(normalized)
}

/**
 * Read the timestamptz-migration gates from an env snapshot. Defaults to
 * `process.env`; unit tests pass an explicit snapshot so the parser stays a
 * pure, directly testable function.
 */
export const parseTimestamptzMigrationEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): TimestamptzMigrationEnvConfig =>
  Schema.decodeSync(TimestamptzMigrationEnvSchema)({
    migration: processEnv[TIMESTAMPTZ_MIGRATION_ENV_VAR],
    acknowledgeNonUtc: processEnv[TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR],
  })

/** Whether the operator opted into emitting the reshape DDL. Default: false. */
export const isTimestamptzMigrationEnabled = (config: TimestamptzMigrationEnvConfig): boolean =>
  isEnabled(config.migration)

/** Whether the operator acknowledged converting on a non-UTC server. Default: false. */
export const isNonUtcConversionAcknowledged = (config: TimestamptzMigrationEnvConfig): boolean =>
  isEnabled(config.acknowledgeNonUtc)

/**
 * The spellings PostgreSQL reports for a session pinned to UTC.
 *
 * Deliberately NAME-based rather than offset-based: a zone can sit at offset
 * zero for half the year (`Europe/London` in winter) while still carrying DST
 * rules and a mid-life-change risk, so a zero current offset is not evidence
 * that the constancy assumption holds.
 */
const UTC_TIME_ZONE_NAMES: ReadonlySet<string> = new Set([
  'utc',
  'etc/utc',
  'universal',
  'etc/universal',
  'zulu',
  'etc/zulu',
  'gmt',
  'gmt0',
  'gmt+0',
  'gmt-0',
  'etc/gmt',
  'greenwich',
  'etc/greenwich',
  'z',
])

/** Whether a `current_setting('TimeZone')` reading names UTC (or an alias of it). */
export const isUtcTimeZoneName = (timeZone: string): boolean =>
  UTC_TIME_ZONE_NAMES.has(timeZone.trim().toLowerCase())
