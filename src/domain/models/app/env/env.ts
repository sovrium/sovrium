/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Environment Variable Schema
 *
 * Defines an environment variable available to automations.
 * Values are NEVER logged in run history — only the key name appears.
 *
 * Referenced in action params as: $env.API_KEY
 */
export const EnvVarSchema = Schema.Struct({
  /** Environment variable key (uppercase snake_case) */
  key: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/)),
    Schema.annotate({
      description: 'Environment variable key (uppercase snake_case, e.g., API_KEY)',
    })
  ),

  /** Human-readable description */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Description of what this env var is used for' })
    )
  ),

  /** Whether this env var is required for automation execution */
  required: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Whether this variable must be set (default: true)' })
    )
  ),

  /** Default value if the env var is not set at runtime */
  default: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Default value used when the environment variable is not set. If both required and default are provided, default acts as fallback.',
      })
    )
  ),

  /**
   * Whether `default` holds a credential. **Defaults to `true`** — omit it and
   * the default is treated as secret.
   *
   * The inverted default is deliberate and is the whole safety property. Every
   * config authored before this field existed keeps its current behaviour
   * (`default` redacted), so adding the field widens nothing on upgrade; making
   * a default visible is an explicit `secret: false` the author has to type.
   * The opposite polarity — visible unless marked — would silently expose every
   * existing `default` to the admin tier the moment this shipped.
   *
   * Why a per-declaration flag rather than a schema-level annotation: the
   * `secret` ANNOTATION flagged as the longer-term fix in
   * `[internal ref]` marks a FIELD as always-credential-bearing
   * (`clientSecret`, `hmac.secret`, `password`). `app.env[].default` is not
   * statically one or the other — `default: '3000'` on `PORT` and
   * `default: 'sk_live_…'` on `STRIPE_KEY` are the same field, and only the
   * author knows which. A static annotation cannot express that, so the two
   * mechanisms are complementary rather than competing and this one does not
   * pre-empt that decision.
   *
   * Scope: this governs every operator-facing REFLECTION of the config — the
   * schema surface (`GET /api/admin/config/schema` → the configuration-as-booted
   * view at `/_admin/changelog?view=current`) and the environment viewer
   * (`GET /api/admin/env` → `/_admin/env`) alike. The viewer
   * echoes the literal as `defaultValue` for a variable declared
   * `secret: false`, and for nothing else. Presence reporting via `hasDefault`
   * stays unconditional and independent of this marker, so an absent
   * `defaultValue` always means withheld rather than undeclared.
   */
  secret: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Whether `default` holds a credential. Defaults to TRUE — omit it and the default is redacted wherever the config is reflected to an operator. Set `secret: false` to let a harmless default (a port, a region, a base URL) render verbatim in the configuration-as-booted view of the admin console (/_admin/changelog?view=current) instead of ***.',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'EnvVar',
    title: 'Environment Variable',
    description: 'Environment variable definition for use in automation actions',
    examples: [
      { key: 'API_KEY', description: 'External API authentication key', required: true },
      { key: 'SLACK_WEBHOOK_URL', description: 'Slack incoming webhook URL' },
      // A default the operator is meant to READ in the configuration-as-booted
      // view (/_admin/changelog?view=current). Without `secret: false` it
      // renders as `***`, which says "a credential lives here" about a port
      // number.
      { key: 'PORT', description: 'HTTP listen port', default: '3000', secret: false },
    ],
  })
)

export type EnvVar = Schema.Schema.Type<typeof EnvVarSchema>

/**
 * Environment Variables Array
 */
export const EnvVarsSchema = Schema.Array(EnvVarSchema).pipe(
  Schema.annotate({
    identifier: 'EnvVars',
    title: 'Environment Variables',
    description: 'List of environment variables available to automations. Values are never logged.',
  }),
  Schema.check(
    Schema.makeFilter((vars) => {
      const keys = vars.map((v) => v.key)
      const uniqueKeys = new Set(keys)
      return keys.length === uniqueKeys.size || 'Environment variable keys must be unique'
    })
  )
)

/** @public */
export type EnvVars = Schema.Schema.Type<typeof EnvVarsSchema>
