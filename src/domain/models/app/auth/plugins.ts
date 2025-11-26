/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Admin plugin configuration
 *
 * Enables admin-specific authentication features including:
 * - User management and banning
 * - Role-based access control
 * - Administrative session management
 *
 * @example
 * ```typescript
 * const adminConfig = {
 *   enabled: true,
 * }
 * ```
 */
export const AdminPluginSchema = Schema.Struct({
  /**
   * Whether the admin plugin is enabled
   */
  enabled: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Admin Plugin Configuration',
    description: 'Configuration for admin plugin features',
    examples: [{ enabled: true }, { enabled: false }],
  })
)

/**
 * Organization plugin configuration
 *
 * Enables organization/multi-tenancy features including:
 * - Organization management
 * - Member invitations and access control
 * - Organization-scoped authentication
 *
 * @example
 * ```typescript
 * const orgConfig = {
 *   enabled: true,
 * }
 * ```
 */
export const OrganizationPluginSchema = Schema.Struct({
  /**
   * Whether the organization plugin is enabled
   */
  enabled: Schema.Boolean,
}).pipe(
  Schema.annotations({
    title: 'Organization Plugin Configuration',
    description: 'Configuration for organization plugin features',
    examples: [{ enabled: true }, { enabled: false }],
  })
)

/**
 * Authentication plugins configuration
 *
 * Enables optional authentication features like admin and organization management.
 * All plugins are optional and can be enabled independently.
 *
 * @example
 * ```typescript
 * const plugins = {
 *   admin: { enabled: true },
 *   organization: { enabled: true },
 * }
 * ```
 */
export const AuthPluginsSchema = Schema.Struct({
  /**
   * Admin plugin configuration (optional)
   *
   * Provides user management, banning, and administrative features
   */
  admin: Schema.optional(AdminPluginSchema),

  /**
   * Organization plugin configuration (optional)
   *
   * Provides multi-tenancy and organization management features
   */
  organization: Schema.optional(OrganizationPluginSchema),
}).pipe(
  Schema.annotations({
    title: 'Authentication Plugins',
    description: 'Optional authentication plugins for extended functionality',
    examples: [
      {
        admin: { enabled: true },
        organization: { enabled: true },
      },
      {
        admin: { enabled: true },
      },
      {},
    ],
  })
)

/**
 * TypeScript type inferred from AdminPluginSchema
 */
export type AdminPlugin = Schema.Schema.Type<typeof AdminPluginSchema>

/**
 * TypeScript type inferred from OrganizationPluginSchema
 */
export type OrganizationPlugin = Schema.Schema.Type<typeof OrganizationPluginSchema>

/**
 * TypeScript type inferred from AuthPluginsSchema
 */
export type AuthPlugins = Schema.Schema.Type<typeof AuthPluginsSchema>

/**
 * Encoded type of AdminPluginSchema (what goes in)
 */
export type AdminPluginEncoded = Schema.Schema.Encoded<typeof AdminPluginSchema>

/**
 * Encoded type of OrganizationPluginSchema (what goes in)
 */
export type OrganizationPluginEncoded = Schema.Schema.Encoded<typeof OrganizationPluginSchema>

/**
 * Encoded type of AuthPluginsSchema (what goes in)
 */
export type AuthPluginsEncoded = Schema.Schema.Encoded<typeof AuthPluginsSchema>
