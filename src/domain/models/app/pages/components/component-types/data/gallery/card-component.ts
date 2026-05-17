/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * card property for data-table sections with kanban layout
 *
 * Configures the visual template for kanban board cards, including
 * title field, cover image, footer items, and onClick action.
 *
 * This is a re-export for schema path consistency. The canonical definition
 * lives in the sections/kanban module.
 *
 * @see {@link KanbanCardSchema} from `./kanban`
 */
export { KanbanCardSchema as CardSchema, type KanbanCard as Card } from '../kanban/schema'
