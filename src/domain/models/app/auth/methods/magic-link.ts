/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Magic Link Authentication Method Configuration
 *
 * Passwordless authentication via email link.
 * User receives an email with a one-time link to sign in.
 *
 * Can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * Configuration options:
 * - expirationMinutes: How long the magic link is valid (default: 15)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { magicLink: true }
 *
 * // With configuration
 * {
 *   magicLink: {
 *     expirationMinutes: 30
 *   }
 * }
 * ```
 */
export const MagicLinkConfigSchema = Schema.Union(
  Schema.Boolean,
  Schema.Struct({
    expirationMinutes: Schema.optional(
      Schema.Number.pipe(
        Schema.positive(),
        Schema.annotations({ description: 'Link expiration time in minutes' })
      )
    ),
  })
).pipe(
  Schema.annotations({
    title: 'Magic Link Configuration',
    description: 'Configuration for magic link authentication',
    examples: [true, { expirationMinutes: 30 }],
  })
)

export type MagicLinkConfig = Schema.Schema.Type<typeof MagicLinkConfigSchema>
