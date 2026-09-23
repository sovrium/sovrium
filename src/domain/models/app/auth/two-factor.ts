/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Two-Factor Authentication Plugin Configuration
 *
 * Enables TOTP-based two-factor authentication.
 * Users can set up 2FA using authenticator apps.
 *
 * Configuration options:
 * - issuer: Name shown in authenticator apps (e.g., "MyApp")
 * - backupCodes: Generate backup codes for account recovery
 * - digits: Number of digits in TOTP code — 6 or 8 (default: 6)
 * - period: Time period for code rotation in seconds (default: 30)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { plugins: { twoFactor: true } }
 *
 * // With configuration
 * { plugins: { twoFactor: { issuer: 'MyApp', backupCodes: true } } }
 * ```
 */
export const TwoFactorConfigSchema = Schema.Union([
  Schema.Boolean,
  Schema.Struct({
    issuer: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({ description: 'Issuer name shown in authenticator apps' })
      )
    ),
    backupCodes: Schema.optional(
      Schema.Boolean.pipe(Schema.annotate({ description: 'Generate backup codes for recovery' }))
    ),
    /**
     * TOTP code length. Narrowed to the two values the TOTP implementation
     * accepts: `Schema.between(4, 8)` also admitted 4, 5, 7 and non-integers
     * like 6.5, which the plugin then had to force through an unsound
     * `as 6 | 8` cast. Rejecting them here is the only feedback channel a
     * config author has.
     */
    digits: Schema.optional(
      Schema.Literals([6, 8]).pipe(
        Schema.annotate({ defaultNote: '6', description: 'Number of digits in TOTP code (6 or 8)' })
      )
    ),
    period: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({ defaultNote: '30', description: 'Code rotation period in seconds' }),
        Schema.check(Schema.isGreaterThan(0))
      )
    ),
  }),
]).pipe(
  Schema.annotate({
    title: 'Two-Factor Authentication Configuration',
    description: 'TOTP-based two-factor authentication',
    examples: [true, { issuer: 'MyApp', backupCodes: true }],
  })
)

/** @public */
export type TwoFactorConfig = Schema.Schema.Type<typeof TwoFactorConfigSchema>
