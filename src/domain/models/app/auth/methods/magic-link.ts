/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Magic Link Authentication Method
 *
 * Passwordless authentication via email link.
 * User receives an email with a one-time link to sign in.
 *
 * Configuration options:
 * - expirationMinutes: How long the magic link is valid (default: 15)
 *
 * @example
 * ```typescript
 * // Simple enable
 * { methods: ['magic-link'] }
 *
 * // With configuration
 * {
 *   methods: [{
 *     method: 'magic-link',
 *     expirationMinutes: 30
 *   }]
 * }
 * ```
 */

/**
 * Magic Link configuration options
 */
export const MagicLinkConfigSchema = Schema.Struct({
  method: Schema.Literal('magic-link'),
  expirationMinutes: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({ description: 'Link expiration time in minutes' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Magic Link Configuration',
    description: 'Configuration for magic link authentication',
  })
)

/**
 * Magic Link method - can be literal or config object
 */
export const MagicLinkMethodSchema = Schema.Union(
  Schema.Literal('magic-link'),
  MagicLinkConfigSchema
).pipe(
  Schema.annotations({
    title: 'Magic Link Method',
    description: 'Passwordless email link authentication',
  })
)

export type MagicLinkConfig = Schema.Schema.Type<typeof MagicLinkConfigSchema>
export type MagicLinkMethod = Schema.Schema.Type<typeof MagicLinkMethodSchema>
