/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ImportCsvDialog } from '../../import-csv-dialog'
import { CreateRecordDialog } from '../create-record-dialog'
import { DeleteViewConfirmDialog } from '../delete-view-confirm-dialog'
import { SaveViewDialog } from '../save-view-dialog'
import type { ViewDialogsProps } from '../view-props'

/** The create-record dialog and the two saved-view dialogs. */
export function ViewDialogs(props: ViewDialogsProps) {
  return (
    <>
      {props.creating && (
        <CreateRecordDialog
          fields={props.tableFields}
          fieldMeta={props.fieldMeta}
          title={props.newRecordLabel}
          saveLabel={props.saveLabel}
          cancelLabel={props.cancelLabel}
          onCancel={props.onCancelCreate}
          onSubmit={props.onSubmitCreate}
        />
      )}
      <SaveViewDialog
        open={props.ui.saveViewDialogOpen}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- adapter closure bridges the dialog's `onOpenChange(boolean)` to the orchestrator's split open/close callbacks; the dialog re-renders only on `saveViewDialogOpen` flips, so the closure churn is bounded
        onOpenChange={(o) =>
          o ? props.ui.onOpenSaveViewDialog() : props.ui.onCloseSaveViewDialog()
        }
        onSave={props.onSaveNewView}
      />
      {props.ui.deleteViewTarget && (
        <DeleteViewConfirmDialog
          open={props.ui.deleteViewTarget !== null}
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- adapter closure for `onOpenChange(boolean)` → orchestrator's `onCloseDeleteViewDialog`. The dialog is only mounted while `deleteViewTarget !== null`, so re-renders are bounded.
          onOpenChange={(o) => (!o ? props.ui.onCloseDeleteViewDialog() : undefined)}
          viewName={props.ui.deleteViewTarget.name}
          onConfirm={props.onConfirmDeleteView}
        />
      )}
    </>
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
