/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Passkey Authentication Method Configuration
 *
 * WebAuthn-based passwordless authentication using biometrics or security keys.
 * Provides strong security with a seamless user experience.
 *
 * Can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * Configuration options:
 * - rpName: Relying Party name (displayed to user)
 * - rpId: Relying Party ID (usually the domain)
 * - attestation: Attestation preference (none, indirect, direct)
 * - userVerification: User verification requirement
 *
 * Note: Passkey requires HTTPS in production.
 *
 * @example
 * ```typescript
 * // Simple enable
 * { methods: { passkey: true } }
 *
 * // With configuration
 * {
 *   methods: {
 *     passkey: {
 *       rpName: 'My Application',
 *       userVerification: 'required'
 *     }
 *   }
 * }
 * ```
 */
export const PasskeyConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    rpName: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Relying Party name shown to user' }))
    ),
    rpId: Schema.optional(
      Schema.String.pipe(Schema.annotations({ description: 'Relying Party ID (domain)' }))
    ),
    attestation: Schema.optional(
      Schema.Literal('none', 'indirect', 'direct').pipe(
        Schema.annotations({ description: 'Attestation conveyance preference' })
      )
    ),
    userVerification: Schema.optional(
      Schema.Literal('required', 'preferred', 'discouraged').pipe(
        Schema.annotations({ description: 'User verification requirement' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Passkey Configuration',
    description: 'Configuration for WebAuthn passkey authentication',
    examples: [true, { userVerification: 'required' }, { rpName: 'My App', rpId: 'example.com' }],
  })
)

export type PasskeyConfig = Schema.Schema.Type<typeof PasskeyConfigSchema>
