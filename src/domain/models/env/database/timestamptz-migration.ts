/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const TimestamptzMigrationEnvSchema = Schema.Struct({
  migration: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Opt-in for the one-time timestamp → timestamptz column reshape (DATABASE_TIMESTAMPTZ_MIGRATION). Unset means no DDL is emitted.',
        examples: ['on'],
      })
    )
  ),
  acknowledgeNonUtc: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Acknowledgement required to run the reshape on a non-UTC server (DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC).',
        examples: ['1'],
      })
    )
  ),
})

export type TimestamptzMigrationEnvConfig = Schema.Schema.Type<typeof TimestamptzMigrationEnvSchema>

export const TIMESTAMPTZ_MIGRATION_ENV_VAR = 'DATABASE_TIMESTAMPTZ_MIGRATION'

export const TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR =
  'DATABASE_TIMESTAMPTZ_MIGRATION_ACK_NON_UTC'

const ENABLED_VALUES: ReadonlySet<string> = new Set(['on', 'true', '1', 'yes'])

const isEnabled = (raw: string | undefined): boolean => {
  const normalized = raw?.trim().toLowerCase()
  return normalized !== undefined && ENABLED_VALUES.has(normalized)
}

export const parseTimestamptzMigrationEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): TimestamptzMigrationEnvConfig =>
  Schema.decodeUnknownSync(TimestamptzMigrationEnvSchema)({
    migration: processEnv[TIMESTAMPTZ_MIGRATION_ENV_VAR],
    acknowledgeNonUtc: processEnv[TIMESTAMPTZ_MIGRATION_ACK_NON_UTC_ENV_VAR],
  })

export const isTimestamptzMigrationEnabled = (config: TimestamptzMigrationEnvConfig): boolean =>
  isEnabled(config.migration)

export const isNonUtcConversionAcknowledged = (config: TimestamptzMigrationEnvConfig): boolean =>
  isEnabled(config.acknowledgeNonUtc)

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

export const isUtcTimeZoneName = (timeZone: string): boolean =>
  UTC_TIME_ZONE_NAMES.has(timeZone.trim().toLowerCase())
