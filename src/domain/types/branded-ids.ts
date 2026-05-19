/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const BaseNumericIdSchema = Schema.Int.pipe(
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9_007_199_254_740_991)
)

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

export const FieldIdSchema = BaseNumericIdSchema.pipe(
  Schema.annotations({
    identifier: 'FieldId',
    title: 'Field ID',
    description: 'Unique identifier for a field within a table. Examples: 1, 2, 3, 100',
  })
)

export type FieldId = Schema.Schema.Type<typeof FieldIdSchema>

export const RecordIdSchema = BaseNumericIdSchema.pipe(
  Schema.annotations({
    identifier: 'RecordId',
    title: 'Record ID',
    description: 'Unique identifier for a record within a table. Examples: 1, 2, 3, 1000',
  })
)

export type RecordId = Schema.Schema.Type<typeof RecordIdSchema>

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
