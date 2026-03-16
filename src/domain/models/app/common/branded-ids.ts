/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Base numeric ID schema with common validation
 *
 * All numeric IDs share these constraints:
 * - Must be positive integers (>= 1)
 * - Must be within JavaScript safe integer range
 * - Are system-generated and immutable
 */
const BaseNumericIdSchema = Schema.Int.pipe(
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9_007_199_254_740_991)
)

/**
 * Table ID - Identifier for tables (numeric or string)
 *
 * Unique identifier for tables within an application.
 * Accepts positive integers, UUID strings, or simple string identifiers.
 * If omitted, an ID will be auto-generated during validation.
 *
 * @example
 * ```typescript
 * // Numeric ID
 * const table1 = { id: 1, name: 'users', fields: [] }
 *
 * // UUID string ID
 * const table2 = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'orders', fields: [] }
 *
 * // Simple string ID
 * const table3 = { id: 'products', name: 'products', fields: [] }
 * ```
 */
export const TableIdSchema = Schema.Union(
  BaseNumericIdSchema,
  Schema.String.pipe(Schema.minLength(1))
).pipe(
  Schema.annotations({
    identifier: 'TableId',
    title: 'Table ID',
    description:
      'Unique identifier for a table. Accepts positive integers, UUID strings, or simple string identifiers. Examples: 1, 2, 100, "550e8400-e29b-41d4-a716-446655440000", "products"',
  })
)

export type TableId = Schema.Schema.Type<typeof TableIdSchema>

/**
 * Field ID - Numeric identifier for fields
 *
 * Unique identifier for fields within a table.
 * Field IDs are unique within their parent table, not globally.
 *
 * @example
 * ```typescript
 * const field = { id: 1, name: 'email', type: 'email' }
 * ```
 */
export const FieldIdSchema = BaseNumericIdSchema.pipe(
  Schema.annotations({
    identifier: 'FieldId',
    title: 'Field ID',
    description: 'Unique identifier for a field within a table. Examples: 1, 2, 3, 100',
  })
)

export type FieldId = Schema.Schema.Type<typeof FieldIdSchema>

/**
 * Record ID - Numeric identifier for records
 *
 * Unique identifier for records within a table.
 * Record IDs are unique within their parent table.
 *
 * @example
 * ```typescript
 * const record = { id: 1, data: { ... } }
 * ```
 */
export const RecordIdSchema = BaseNumericIdSchema.pipe(
  Schema.annotations({
    identifier: 'RecordId',
    title: 'Record ID',
    description: 'Unique identifier for a record within a table. Examples: 1, 2, 3, 1000',
  })
)

export type RecordId = Schema.Schema.Type<typeof RecordIdSchema>

/**
 * User ID - Branded type for user identifiers
 *
 * Unique identifier for users in the authentication system.
 * User IDs are globally unique across the application.
 *
 * @example
 * ```typescript
 * const userId: UserId = 'usr_123abc' as UserId
 * ```
 */
export const UserIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('UserId'),
  Schema.annotations({
    identifier: 'UserId',
    title: 'User ID',
    description:
      'Unique identifier for a user (branded type). Examples: usr_123abc, user-456, 550e8400-e29b-41d4-a716-446655440000',
  })
)

export type UserId = Schema.Schema.Type<typeof UserIdSchema>

/**
 * Workspace ID - Branded type for workspace identifiers
 *
 * Unique identifier for workspaces.
 * Workspaces provide logical separation of data.
 *
 * @example
 * ```typescript
 * const workspaceId: WorkspaceId = 'ws_marketing' as WorkspaceId
 * ```
 */
export const WorkspaceIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('WorkspaceId'),
  Schema.annotations({
    identifier: 'WorkspaceId',
    title: 'Workspace ID',
    description:
      'Unique identifier for a workspace (branded type). Examples: ws_marketing, workspace-dev, default',
  })
)

export type WorkspaceId = Schema.Schema.Type<typeof WorkspaceIdSchema>

/**
 * Component Template ID - Branded type for component template identifiers
 *
 * Unique identifier for reusable component templates.
 * Component templates are referenced in page sections via $ref.
 *
 * @example
 * ```typescript
 * const componentId: ComponentTemplateId = 'hero-section' as ComponentTemplateId
 * ```
 */
export const ComponentTemplateIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[a-z][a-z0-9-]*$/, {
    message: () =>
      'Component template ID must start with a letter and contain only lowercase letters, numbers, and hyphens',
  }),
  Schema.brand('ComponentTemplateId'),
  Schema.annotations({
    identifier: 'ComponentTemplateId',
    title: 'Component Template ID',
    description:
      'Unique identifier for a reusable component template (branded type). Examples: hero-section, feature-grid, cta-banner',
  })
)

export type ComponentTemplateId = Schema.Schema.Type<typeof ComponentTemplateIdSchema>

/**
 * View ID - Branded type for view identifiers
 *
 * Unique identifier for table views.
 * Views define filtered/sorted/grouped perspectives on table data.
 *
 * @example
 * ```typescript
 * const viewId: ViewId = 'active_tasks' as ViewId
 * ```
 */
export const BrandedViewIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[a-z][a-z0-9_]*$/, {
    message: () =>
      'View ID must start with a letter and contain only lowercase letters, numbers, and underscores',
  }),
  Schema.brand('ViewId'),
  Schema.annotations({
    identifier: 'ViewId',
    title: 'View ID',
    description:
      'Unique identifier for a table view (branded type). Examples: active_tasks, by_department, recent_first',
  })
)

export type BrandedViewId = Schema.Schema.Type<typeof BrandedViewIdSchema>
