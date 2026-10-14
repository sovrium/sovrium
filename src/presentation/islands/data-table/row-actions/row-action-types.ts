/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Callback for executing a per-row action. The data-table island wires this to
 * a handler that calls the API, shows toast notifications, and refreshes the
 * table.
 *
 * Declared here, apart from every component that passes it along, so the row
 * action parts import a TYPE from a leaf rather than from each other: before,
 * the action cell, the account controls and the select editor each imported the
 * next one's types, and the three files formed an import cycle.
 */
export type RowActionHandler = (
  action: ActionColumnItem,
  record: TableRecord,
  /** The pressed control: the overlay holding the table is the one `onSuccess.close` closes. */
  origin?: Element
) => void | Promise<void>

/** The per-row click handler an action control receives; the same contract. */
export type ActionClickHandler = RowActionHandler

/**
 * The interpreter-provided labels an action cell's OWN controls wear: the inline
 * select-editor's commit + dismiss, and the confirm gate's dismiss. Resolved
 * server-side against the app language. The action's own `label` and an
 * `editSelect.saveLabel` are author content and still win where they apply.
 */
export interface ActionControlLabels {
  readonly save: string
  readonly cancel: string
}

/**
 * How a row's actions draw: `inline` buttons in the action column (the
 * default), or one `…` menu per row.
 */
export type RowActionsDisplay = 'inline' | 'menu'
