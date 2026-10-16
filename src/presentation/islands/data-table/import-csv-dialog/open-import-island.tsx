/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { dispatch } from '../../runtime/event-bus'
import { ImportCsvDialog } from '.'
import type { ImportResult } from './types'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface OpenImportIslandProps {
  /** The table the imported rows are written to. */
  readonly table: string
  /** The button's own words. */
  readonly label: string
  /** The author's button attributes: id, test id, classes, accessible name. */
  readonly buttonProps?: Record<string, unknown>
  /** The fields a CSV column may be mapped onto. */
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
}

/**
 * A button that opens the CSV import dialog for one table — the `openImport`
 * action. The server drew it only for a reader the table lets create records.
 *
 * Once the rows are written, every data component on the page bound to the
 * table hears it on the same channel a record form's create announces itself
 * on, and reads again: the imported rows appear without a reload.
 */
export default function OpenImportIsland({
  table,
  label,
  buttonProps,
  tableFields,
  fieldMeta,
}: OpenImportIslandProps) {
  const [open, setOpen] = useState(false)
  const onImported = useCallback(
    (result: ImportResult) => {
      if (result.created > 0 || result.updated > 0) {
        dispatch('sovrium:crud-success', { table, operation: 'create', close: false })
      }
    },
    [table]
  )
  return (
    <>
      <button
        type="button"
        {...buttonProps}
        // Hidden from assistive technology while its modal dialog is open: the
        // dialog's own Import is then the only one a reader can reach.
        aria-hidden={open || undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <ImportCsvDialog
        open={open}
        onClose={() => setOpen(false)}
        tableName={table}
        {...(tableFields !== undefined && { tableFields })}
        {...(fieldMeta !== undefined && { fieldMeta })}
        onImported={onImported}
      />
    </>
  )
}
