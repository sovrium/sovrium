/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldMeta } from '../../hooks/use-inline-editing'
import type { TabDirection } from '../island/tab-target'

/**
 * The props of an inline cell editor. A leaf of its own so the text editor and
 * the cell that picks it share the contract without importing each other.
 */
export interface EditableCellProps {
  readonly value: unknown
  readonly fieldMeta?: FieldMeta
  readonly onSave: (newValue: unknown) => void | Promise<void>
  readonly onCancel: () => void
  readonly tableName?: string
  readonly recordId?: string | number
  readonly fieldName?: string
  /** When true, edits persist automatically (debounced) without an Enter keypress. */
  readonly autoSave?: boolean
  /** Debounce delay (ms) for auto-save. Only used when `autoSave` is true. */
  readonly autoSaveDebounceMs?: number
  /**
   * When true, edits persist when the field loses focus (Notion-like) instead
   * of on every debounced keystroke. Used by `saveMode: 'onBlur'`.
   */
  readonly saveOnBlur?: boolean
  /** Persists the in-progress edit without exiting edit mode (auto-save). */
  readonly onAutoSave?: (newValue: unknown) => void | Promise<void>
  /** Records the latest un-persisted value so a cell switch can flush it. */
  readonly onTrackValue?: (newValue: unknown) => void
  /** Saves the current value and moves the editor to the next editable cell. */
  readonly onTabNext?: (newValue: unknown, direction: TabDirection) => void
}
