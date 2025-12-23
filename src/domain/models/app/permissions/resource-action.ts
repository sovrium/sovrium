/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Resource Name Schema
 *
 * Validates resource names in the resource:action permission pattern.
 * Must start with a letter and contain only lowercase letters, numbers, underscores, or hyphens.
 *
 * @example
 * Valid: "users", "posts", "api_keys", "user-profiles"
 * Invalid: "123users", "_posts", "User Posts"
 */
export const ResourceNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Resource Name',
    description: 'Resource identifier (e.g., "users", "posts", "analytics")',
    examples: ['users', 'posts', 'api_keys', 'user-profiles'],
  })
)

export type ResourceName = Schema.Schema.Type<typeof ResourceNameSchema>

/**
 * Action Name Schema
 *
 * Validates action names in the resource:action permission pattern.
 * Must start with a letter and contain only lowercase letters, numbers, underscores, or hyphens.
 *
 * @example
 * Valid: "read", "write", "create", "delete", "list_all"
 * Invalid: "123read", "_write"
 */
export const ActionNameSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_-]*$/i),
  Schema.annotations({
    title: 'Action Name',
    description: 'Action identifier (e.g., "read", "write", "create", "delete")',
    examples: ['read', 'write', 'create', 'update', 'delete', 'list'],
  })
)

export type ActionName = Schema.Schema.Type<typeof ActionNameSchema>

/**
 * Action with Wildcard Schema
 *
 * Either a specific action name or "*" for all actions on a resource.
 */
export const ActionWithWildcardSchema = Schema.Union(Schema.Literal('*'), ActionNameSchema).pipe(
  Schema.annotations({
    title: 'Action',
    description: 'Action name or "*" for all actions',
    examples: ['read', 'write', '*'],
  })
)

export type ActionWithWildcard = Schema.Schema.Type<typeof ActionWithWildcardSchema>

/**
 * Resource:Action Permissions Schema (Shared)
 *
 * Defines granular permissions using the resource:action pattern.
 * Each resource maps to an array of allowed actions.
 *
 * This schema is shared between:
 * - Admin plugin (customPermissions)
 * - API Keys plugin (resourcePermissions)
 * - Any future permission-based features
 *
 * @example
 * ```typescript
 * {
 *   users: ['read', 'list'],
 *   posts: ['create', 'read', 'update', 'delete'],
 *   analytics: ['*']  // Wildcard for all actions
 * }
 * ```
 */
export const ResourceActionPermissionsSchema = Schema.Record({
  key: ResourceNameSchema.pipe(
    Schema.annotations({ description: 'Resource name (e.g., "users", "posts")' })
  ),
  value: Schema.Array(ActionWithWildcardSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Allowed actions for this resource' })
  ),
}).pipe(
  Schema.annotations({
    title: 'Resource:Action Permissions',
    description:
      'Granular permission definitions using resource:action pattern. Shared across admin, API keys, and other permission contexts.',
    examples: [
      {
        users: ['read', 'list'],
        posts: ['create', 'read', 'update', 'delete'],
        analytics: ['*'],
      },
      {
        comments: ['create', 'read', 'delete'],
        media: ['*'],
      },
    ],
  })
)

export type ResourceActionPermissions = Schema.Schema.Type<typeof ResourceActionPermissionsSchema>
