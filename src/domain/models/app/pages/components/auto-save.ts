/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from './action'

// ---------------------------------------------------------------------------
// Save mode
// ---------------------------------------------------------------------------

/**
 * Controls when and how edits are persisted to the database.
 *
 * - `auto`: Debounced auto-save after each keystroke (Airtable-like)
 * - `onBlur`: Save when the edited field loses focus (Notion-like)
 * - `manual`: Explicit save button required (default, backward compatible)
 */
export const SaveModeSchema = Schema.Literal('auto', 'onBlur', 'manual').annotations({
  identifier: 'SaveMode',
  title: 'Save Mode',
  description:
    "How edits are persisted: 'auto' (debounced auto-save), 'onBlur' (save on field blur), 'manual' (explicit save button)",
})

// ---------------------------------------------------------------------------
// Save indicator position
// ---------------------------------------------------------------------------

/**
 * Where the save status indicator is displayed.
 *
 * - `inline`: Near the edited cell or field
 * - `toast`: As a toast notification
 * - `toolbar`: In the component toolbar area
 */
export const SaveIndicatorPositionSchema = Schema.Literal('inline', 'toast', 'toolbar').annotations(
  {
    identifier: 'SaveIndicatorPosition',
    title: 'Save Indicator Position',
    description: 'Where the save status indicator appears',
  }
)

// ---------------------------------------------------------------------------
// Auto-save configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for automatic persistence of edits.
 *
 * Applies to editable components: data-table, form, kanban, calendar.
 * When omitted, the component uses the default manual save behavior.
 *
 * @example
 * ```yaml
 * # Airtable-like: auto-save with 500ms debounce
 * autoSave:
 *   saveMode: auto
 *   autoSaveDebounceMs: 500
 *   showSaveIndicator: true
 *   saveIndicatorPosition: inline
 *
 * # Notion-like: save on blur
 * autoSave:
 *   saveMode: onBlur
 *
 * # Explicit save (same as omitting autoSave entirely)
 * autoSave:
 *   saveMode: manual
 * ```
 */
export const AutoSaveConfigSchema = Schema.Struct({
  /** How edits are persisted */
  saveMode: Schema.optional(
    SaveModeSchema.annotations({
      description:
        "Save trigger strategy: 'auto' (debounced), 'onBlur' (field blur), 'manual' (button). Default: 'manual'.",
    })
  ),
  /** Debounce delay in milliseconds for auto save mode (min: 100, default: 500) */
  autoSaveDebounceMs: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(100),
      Schema.annotations({
        description: 'Debounce delay for auto-save in milliseconds (default: 500, min: 100)',
        examples: [300, 500, 1000],
      })
    )
  ),
  /** Show a save status indicator (default: true when saveMode is auto or onBlur) */
  showSaveIndicator: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Display a save status indicator (Saving... / Saved / Error). Default: true when saveMode is auto or onBlur.',
    })
  ),
  /** Where to display the save indicator */
  saveIndicatorPosition: Schema.optional(SaveIndicatorPositionSchema),
  /** Custom action for persisting changes (defaults to CRUD update on the bound dataSource table) */
  saveAction: Schema.optional(
    ActionSchema.annotations({
      description:
        'Custom save action. When omitted, defaults to a CRUD update operation on the bound dataSource table.',
    })
  ),
}).annotations({
  identifier: 'AutoSaveConfig',
  title: 'Auto Save Configuration',
  description:
    'Configuration for automatic persistence of edits. Applies to data-table, form, kanban, and calendar components.',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type SaveMode = Schema.Schema.Type<typeof SaveModeSchema>
/** @public */
export type SaveIndicatorPosition = Schema.Schema.Type<typeof SaveIndicatorPositionSchema>
/** @public */
export type AutoSaveConfig = Schema.Schema.Type<typeof AutoSaveConfigSchema>
