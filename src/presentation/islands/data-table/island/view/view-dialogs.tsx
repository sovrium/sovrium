/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ImportCsvDialog } from '../../import-csv-dialog'
import { CreateRecordDialog } from '../create-record-dialog'
import type { ViewDialogsProps } from '../view-props'

/** The create-record dialog. */
export function ViewDialogs(props: ViewDialogsProps) {
  if (!props.creating) return undefined
  return (
    <CreateRecordDialog
      fields={props.tableFields}
      fieldMeta={props.fieldMeta}
      title={props.newRecordLabel}
      saveLabel={props.saveLabel}
      cancelLabel={props.cancelLabel}
      onCancel={props.onCancelCreate}
      onSubmit={props.onSubmitCreate}
    />
  )
}

/**
 * The CSV import dialog.
 *
 * Split from {@link ViewDialogs} so it keeps its position as the container's
 * last child: these are overlays, and reordering equal-z siblings changes
 * which one draws on top.
 */
export function GridImportDialog(props: ViewDialogsProps) {
  return (
    <ImportCsvDialog
      open={props.ui.importDialogOpen}
      onClose={props.ui.onCloseImportDialog}
      tableFields={props.tableFields}
      tableName={props.tableName}
      fieldMeta={props.fieldMeta}
    />
  )
}
