/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AdminConfigSchema } from './admin'
import { ApiKeysConfigSchema } from './api-keys'
import { OrganizationConfigSchema } from './organization'
import { TwoFactorConfigSchema } from './two-factor'

// Export individual plugin schemas
export * from './admin'
export * from './organization'
export * from './two-factor'
export * from './api-keys'

/**
 * Unified Plugins Configuration Schema
 *
 * All authentication plugins in a single configuration object.
 * Each plugin is optional and can be:
 * - A boolean (true to enable with defaults)
 * - A configuration object for customization
 *
 * Plugin categories:
 * - Organization: admin, organization
 * - Security: twoFactor, apiKeys
 *
 * @example
 * ```typescript
 * // Simple plugins
 * {
 *   plugins: {
 *     admin: true,
 *     organization: true,
 *     twoFactor: true
 *   }
 * }
 *
 * // Configured plugins
 * {
 *   plugins: {
 *     admin: { impersonation: true },
 *     organization: { maxMembersPerOrg: 50 },
 *     twoFactor: { issuer: 'MyApp', backupCodes: true }
 *   }
 * }
 * ```
 */
export const PluginsConfigSchema = Schema.Struct({
  // Organization features
  admin: Schema.optional(AdminConfigSchema),
  organization: Schema.optional(OrganizationConfigSchema),

  // Security plugins
  twoFactor: Schema.optional(TwoFactorConfigSchema),
  apiKeys: Schema.optional(ApiKeysConfigSchema),
}).pipe(
  Schema.annotations({
    title: 'Plugins Configuration',
    description: 'All authentication plugins configuration',
    examples: [
      { admin: true, organization: true },
      { twoFactor: { issuer: 'MyApp' }, apiKeys: { expirationDays: 90 } },
    ],
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
