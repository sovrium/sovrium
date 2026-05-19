/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const EnvVarSchema = Schema.Struct({
  key: Schema.String.pipe(
    Schema.pattern(/^[A-Z][A-Z0-9_]*$/),
    Schema.annotations({
      description: 'Environment variable key (uppercase snake_case, e.g., API_KEY)',
    })
  ),

  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({ description: 'Description of what this env var is used for' })
    )
  ),

  required: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether this variable must be set (default: true)' })
    )
  ),

  default: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description:
          'Default value used when the environment variable is not set. If both required and default are provided, default acts as fallback.',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'EnvVar',
    title: 'Environment Variable',
    description: 'Environment variable definition for use in automation actions',
    examples: [
      { key: 'API_KEY', description: 'External API authentication key', required: true },
      { key: 'SLACK_WEBHOOK_URL', description: 'Slack incoming webhook URL' },
    ],
  })
)

export type EnvVar = Schema.Schema.Type<typeof EnvVarSchema>

export const EnvVarsSchema = Schema.Array(EnvVarSchema).pipe(
  Schema.annotations({
    identifier: 'EnvVars',
    title: 'Environment Variables',
    description: 'List of environment variables available to automations. Values are never logged.',
  }),
  Schema.filter((vars) => {
    const keys = vars.map((v) => v.key)
    const uniqueKeys = new Set(keys)
    return keys.length === uniqueKeys.size || 'Environment variable keys must be unique'
  })
)

export type EnvVars = Schema.Schema.Type<typeof EnvVarsSchema>
