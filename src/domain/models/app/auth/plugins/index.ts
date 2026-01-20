/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AdminConfigSchema } from './admin'
import { TwoFactorConfigSchema } from './two-factor'

// Export individual plugin schemas
export * from './admin'
export * from './two-factor'

/**
 * Unified Plugins Configuration Schema
 *
 * All authentication plugins in a single configuration object.
 * Each plugin is optional and can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * Plugin categories:
 * - Admin: admin
 * - Security: twoFactor
 *
 * @example
 * ```typescript
 * // Simple plugins
 * {
 *   plugins: {
 *     admin: true,
 *     twoFactor: true
 *   }
 * }
 *
 * // Configured plugins
 * {
 *   plugins: {
 *     admin: { impersonation: true },
 *     twoFactor: { issuer: 'MyApp', backupCodes: true }
 *   }
 * }
 * ```
 */
export const PluginsConfigSchema = Schema.Struct({
  // Admin features
  admin: Schema.optional(AdminConfigSchema),

  // Security plugins
  twoFactor: Schema.optional(TwoFactorConfigSchema),
}).pipe(
  Schema.annotations({
    title: 'Plugins Configuration',
    description: 'All authentication plugins configuration',
    examples: [{ admin: true }, { twoFactor: { issuer: 'MyApp' } }],
  })
)

export type PluginsConfig = Schema.Schema.Type<typeof PluginsConfigSchema>

/**
 * Helper to check if a plugin is enabled
 */
export const isPluginEnabled = (
  plugins: PluginsConfig | undefined,
  plugin: keyof PluginsConfig
): boolean => {
  if (!plugins) return false
  const value = plugins[plugin]
  if (typeof value === 'boolean') return value
  return value !== undefined
}
