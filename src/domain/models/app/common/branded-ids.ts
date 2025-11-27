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
 * Table ID - Numeric identifier for tables
 *
 * Unique identifier for tables within an application.
 * Simple positive integer - structural typing provides sufficient type safety.
 *
 * @example
 * ```typescript
 * const table = { id: 1, name: 'users', fields: [] }
 * ```
 */
export const TableIdSchema = BaseNumericIdSchema.pipe(
  Schema.annotations({
    identifier: 'TableId',
    title: 'Table ID',
    description: 'Unique identifier for a table. Examples: 1, 2, 100',
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
 * Organization ID - Branded type for organization identifiers
 *
 * Unique identifier for organizations in multi-tenant systems.
 * Used for data isolation and access control.
 *
 * @example
 * ```typescript
 * const orgId: OrganizationId = 'org_acme' as OrganizationId
 * ```
 */
export const OrganizationIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('OrganizationId'),
  Schema.annotations({
    identifier: 'OrganizationId',
    title: 'Organization ID',
    description:
      'Unique identifier for an organization (branded type). Examples: org_acme, org-123, acme-corp',
  })
)

export type OrganizationId = Schema.Schema.Type<typeof OrganizationIdSchema>

/**
 * Workspace ID - Branded type for workspace identifiers
 *
 * Unique identifier for workspaces within an organization.
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
 * Block ID - Branded type for block identifiers
 *
 * Unique identifier for reusable blocks/components.
 * Blocks are referenced in page sections via $ref.
 *
 * @example
 * ```typescript
 * const blockId: BlockId = 'hero-section' as BlockId
 * ```
 */
export const BlockIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.pattern(/^[a-z][a-z0-9-]*$/, {
    message: () =>
      'Block ID must start with a letter and contain only lowercase letters, numbers, and hyphens',
  }),
  Schema.brand('BlockId'),
  Schema.annotations({
    identifier: 'BlockId',
    title: 'Block ID',
    description:
      'Unique identifier for a reusable block (branded type). Examples: hero-section, feature-grid, cta-banner',
  })
)

export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>

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
