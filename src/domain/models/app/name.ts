/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * NameSchema defines validation rules for application names.
 *
 * Application names must follow npm package naming conventions:
 * - Lowercase only
 * - Maximum 214 characters (including scope for scoped packages)
 * - Cannot start with a dot or underscore
 * - Cannot contain leading/trailing spaces
 * - Cannot contain non-URL-safe characters
 * - Scoped packages: @scope/package-name format allowed
 * - Can include hyphens and underscores (but not at the start)
 *
 * @example
 * ```typescript
 * // Valid names
 * const name1 = 'my-app'
 * const name2 = 'todo-app'
 * const name3 = '@myorg/my-app'
 * const name4 = 'blog-system'
 * const name5 = 'dashboard-admin'
 *
 * // Validate name
 * const validated = Schema.decodeUnknownSync(NameSchema)(name1)
 * ```
 */
export const NameSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Name must not be empty' }),
  Schema.maxLength(214, { message: () => 'Name must not exceed 214 characters' }),
  Schema.pattern(/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, {
    message: () =>
      'Name must be lowercase and follow npm package naming conventions (no leading/trailing spaces, no dots/underscores at start, URL-safe characters only)',
  }),
  Schema.annotations({
    title: 'Application Name',
    description: 'The name of the application (follows npm package naming conventions)',
    examples: ['my-app', 'todo-app', '@myorg/my-app', 'blog-system', 'dashboard-admin'],
  })
)

/**
 * TypeScript type inferred from NameSchema.
 *
 * Use this type for type-safe access to validated application names.
 *
 * @example
 * ```typescript
 * const name: Name = 'my-app'
 * ```
 */
export type Name = Schema.Schema.Type<typeof NameSchema>

/**
 * Encoded type of NameSchema (what goes in).
 *
 * In this case, it's the same as Name since we don't use transformations.
 */
export type NameEncoded = Schema.Schema.Encoded<typeof NameSchema>
