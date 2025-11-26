/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Permissions Schema
 *
 * Permissions configuration for the view, defining who can access or modify it.
 * Currently uses Unknown as a placeholder for future permission structure.
 *
 * @example
 * ```typescript
 * { read: ['admin', 'user'], write: ['admin'] }
 * { public: true }
 * ```
 */
export const ViewPermissionsSchema = Schema.Unknown.pipe(
  Schema.annotations({
    title: 'View Permissions',
    description: 'Permission configuration for the view, defining who can access or modify it.',
  })
)

export type ViewPermissions = Schema.Schema.Type<typeof ViewPermissionsSchema>
