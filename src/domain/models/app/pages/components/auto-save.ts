/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from './action'


export const SaveModeSchema = Schema.Literal('auto', 'onBlur', 'manual').annotations({
  identifier: 'SaveMode',
  title: 'Save Mode',
  description:
    "How edits are persisted: 'auto' (debounced auto-save), 'onBlur' (save on field blur), 'manual' (explicit save button)",
})


export const SaveIndicatorPositionSchema = Schema.Literal('inline', 'toast', 'toolbar').annotations(
  {
    identifier: 'SaveIndicatorPosition',
    title: 'Save Indicator Position',
    description: 'Where the save status indicator appears',
  }
)


export const AutoSaveConfigSchema = Schema.Struct({
  saveMode: Schema.optional(
    SaveModeSchema.annotations({
      description:
        "Save trigger strategy: 'auto' (debounced), 'onBlur' (field blur), 'manual' (button). Default: 'manual'.",
    })
  ),
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
  showSaveIndicator: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Display a save status indicator (Saving... / Saved / Error). Default: true when saveMode is auto or onBlur.',
    })
  ),
  saveIndicatorPosition: Schema.optional(SaveIndicatorPositionSchema),
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


export type SaveMode = Schema.Schema.Type<typeof SaveModeSchema>
export type SaveIndicatorPosition = Schema.Schema.Type<typeof SaveIndicatorPositionSchema>
export type AutoSaveConfig = Schema.Schema.Type<typeof AutoSaveConfigSchema>
