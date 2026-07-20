/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const DemoNoticeEnvSchema = Schema.Struct({
  notice: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Master switch for the demo context notice (SOVRIUM_DEMO_NOTICE). Unset means no notice.',
        examples: ['on'],
      })
    )
  ),
  name: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Optional template display name (SOVRIUM_DEMO_NAME). Sets the panel title to `<name> demo` / `Démo <name>`; unset (or empty) falls back to the brand title.',
        examples: ['CRM'],
      })
    )
  ),
  url: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Target of the notice "more info" call to action (SOVRIUM_DEMO_URL)',
        examples: ['https://sovrium.com/apps/crm'],
      })
    )
  ),
  email: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Display-only demo sign-in email (SOVRIUM_DEMO_EMAIL). NEVER sourced from AUTH_ADMIN_EMAIL.',
        examples: ['demo@sovrium.com'],
      })
    )
  ),
  password: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Display-only demo sign-in password (SOVRIUM_DEMO_PASSWORD). NEVER sourced from AUTH_ADMIN_PASSWORD.',
        examples: ['demo'],
      })
    )
  ),
})

export type DemoNoticeEnvConfig = Schema.Schema.Type<typeof DemoNoticeEnvSchema>

const ENABLED_VALUES: ReadonlySet<string> = new Set(['on', 'true', '1', 'yes'])

export const parseDemoNoticeEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>> = process.env
): DemoNoticeEnvConfig =>
  Schema.decodeUnknownSync(DemoNoticeEnvSchema)({
    notice: processEnv['SOVRIUM_DEMO_NOTICE'],
    name: processEnv['SOVRIUM_DEMO_NAME'],
    url: processEnv['SOVRIUM_DEMO_URL'],
    email: processEnv['SOVRIUM_DEMO_EMAIL'],
    password: processEnv['SOVRIUM_DEMO_PASSWORD'],
  })

export const isDemoNoticeEnabled = (config: DemoNoticeEnvConfig): boolean => {
  const raw = config.notice?.trim().toLowerCase()
  return raw !== undefined && ENABLED_VALUES.has(raw)
}

export const hasDemoCredentials = (config: DemoNoticeEnvConfig): boolean =>
  (config.email?.trim() ?? '') !== '' && (config.password?.trim() ?? '') !== ''

export const resolveDemoName = (config: DemoNoticeEnvConfig): string | undefined => {
  const trimmed = config.name?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}
