/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Authentication feature types
 *
 * Defines the available authentication features:
 * - 'admin': User management, banning, administrative features
 * - 'organization': Multi-tenancy, organization management
 *
 * @example
 * ```typescript
 * const features: AuthFeature[] = ['admin', 'organization']
 * ```
 */
export const AuthFeatureSchema = Schema.Literal('admin', 'organization').pipe(
  Schema.annotations({
    title: 'Authentication Feature',
    description: 'Available authentication features',
  })
)

/**
 * TypeScript type for authentication features
 */
export type AuthFeature = Schema.Schema.Type<typeof AuthFeatureSchema>
