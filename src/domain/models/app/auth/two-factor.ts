/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const TwoFactorConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    issuer: Schema.optional(
      Schema.String.pipe(
        Schema.annotations({ description: 'Issuer name shown in authenticator apps' })
      )
    ),
    backupCodes: Schema.optional(
      Schema.Boolean.pipe(Schema.annotations({ description: 'Generate backup codes for recovery' }))
    ),
    digits: Schema.optional(
      Schema.Number.pipe(
        Schema.between(4, 8),
        Schema.annotations({ description: 'Number of digits in TOTP code (4-8)' })
      )
    ),
    period: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Code rotation period in seconds' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Two-Factor Authentication Configuration',
    description: 'TOTP-based two-factor authentication',
    examples: [true, { issuer: 'MyApp', backupCodes: true }],
  })
)

export type TwoFactorConfig = Schema.Schema.Type<typeof TwoFactorConfigSchema>
