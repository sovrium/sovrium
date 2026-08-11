/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { fieldWidgetOf } from '@/presentation/utils/field-type-behavior'
import type { FieldEditMeta, FieldMeta, FieldWriteValue } from '../../hooks/use-inline-editing'
import type { SelectOptionLike } from '@/domain/utils/select-option'

/**
 * What every inline cell editor is handed, whatever it renders.
 *
 * One shape for all of them so the widget → editor table can be a plain
 * `Record<FieldWidget, …>`: a new widget then fails to compile until it has an
 * editor, which is the guard the grid did not have when eight field types fell
 * through to a text box.
 */
export interface CellEditorProps {
  readonly value: unknown
  /** Writes the value and closes the editor (or persists in place under auto-save). */
  readonly commit: (next: FieldWriteValue) => void
  /** Closes the editor without writing. */
  readonly cancel: () => void
  /**
   * Commits and moves the editor to the next editable column, when the grid
   * supplied Tab wiring. Absent under manual-save mode, where `onTabNext` is
   * never built — see `use-island-setup.ts`.
   */
  readonly tabNext?: (next: FieldWriteValue) => void
  readonly fieldMeta?: FieldMeta
  readonly fieldName?: string
  readonly tableName?: string
  readonly recordId?: string | number
}

/** The declared editor properties this field carries, or an empty bag. */
export function editMetaOf(fieldMeta: FieldMeta | undefined): FieldEditMeta {
  return fieldMeta?.edit ?? {}
}

/** The declared options this field carries, or an empty list. */
export function optionsOf(fieldMeta: FieldMeta | undefined): readonly SelectOptionLike[] {
  return fieldMeta?.options ?? []
}

/**
 * Widgets whose live control REPLACES the read-only rendering of an editable
 * cell, instead of opening behind a double-click.
 *
 * A checkbox and a rating are single-gesture edits: requiring a double-click to
 * open and then a click to act is two gestures to change one bit. They have no
 * editing state at all, so they are not in the widget → editor table — they are
 * rendered by the read path.
 */
const SINGLE_GESTURE_WIDGETS: ReadonlySet<string> = new Set(['checkbox', 'rating'])

/** True when this field's control is rendered live in the cell — see above. */
export function isSingleGestureWidget(fieldMeta: FieldMeta | undefined): boolean {
  return SINGLE_GESTURE_WIDGETS.has(fieldWidgetOf(fieldMeta?.type ?? 'single-line-text'))
}
