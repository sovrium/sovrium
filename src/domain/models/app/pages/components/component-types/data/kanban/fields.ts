/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterPublisherSchema } from '../../../data-source-publishers'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import {
  KanbanGroupBySchema,
  KanbanSwimlanesSchema,
  KanbanCardSchema,
  KanbanDragSchema,
} from './schema'

export const KanbanTypeLiteral = Schema.Literal('kanban')

export const kanbanFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  kanbanGroupBy: Schema.optional(KanbanGroupBySchema),
  swimlanes: Schema.optional(KanbanSwimlanesSchema),
  card: Schema.optional(KanbanCardSchema),
  drag: Schema.optional(KanbanDragSchema),
  emptyColumnMessage: Schema.optional(
    Schema.String.annotate({ description: 'Message when a kanban column has no records' })
  ),
  colorField: Schema.optional(
    Schema.String.annotate({
      description: 'Field whose values map to colors (kanban cards)',
    })
  ),
  /**
   * Publish the card the reader selects on a shared-filter channel: its record
   * id. Clicking a card selects it, beside whatever `card.onClick` does;
   * clicking it again clears the selection. The key `tree` and `graph` carry.
   */
  publishes: Schema.optional(SharedFilterPublisherSchema),
} as const

// Re-export all sub-schemas
