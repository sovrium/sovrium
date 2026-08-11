/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { KanbanGroupBySchema, KanbanCardSchema, KanbanDragSchema } from './schema'

export const KanbanTypeLiteral = Schema.Literal('kanban')

export const kanbanFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  kanbanGroupBy: Schema.optional(KanbanGroupBySchema),
  card: Schema.optional(KanbanCardSchema),
  drag: Schema.optional(KanbanDragSchema),
  emptyColumnMessage: Schema.optional(
    Schema.String.annotations({ description: 'Message when a kanban column has no records' })
  ),
  colorField: Schema.optional(
    Schema.String.annotations({
      description: 'Field whose values map to colors (kanban cards)',
    })
  ),
} as const

// Re-export all sub-schemas
export * from './schema'
