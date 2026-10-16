/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RecordButtonCore, type RecordButtonConfig } from './runtime/record-button-core'
import type { ReactNode } from 'react'

interface RecordFieldButtonIslandProps {
  readonly config: RecordButtonConfig
  readonly field: string
  readonly table: string
  readonly recordId: string
  /** The `action.*` words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}

/**
 * record-field-button island — a `record-field` naming a `button` field on the
 * page of one record. It draws the button the grid's cell draws, through the
 * same component, so pressing it runs the field's automation on the page's
 * record under the same write check.
 *
 * The server mounts it only where the button belongs: on a record its
 * `visibleWhen` admits and for a reader its field permission admits
 * (`record-button-field-resolver.ts`). So no record is passed to re-evaluate
 * the gate here; the decision was made where the record and the reader are.
 */
export default function RecordFieldButtonIsland({
  config,
  field,
  table,
  recordId,
  uiStrings,
}: RecordFieldButtonIslandProps): ReactNode {
  return (
    <RecordButtonCore
      config={config}
      fieldName={field}
      table={table}
      recordId={recordId}
      strings={uiStrings}
    />
  )
}
