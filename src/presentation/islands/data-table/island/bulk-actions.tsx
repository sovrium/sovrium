/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  TABLE_TOOLBAR_BUTTON_PART,
  TABLE_TOOLBAR_PRIMARY_BUTTON_PART,
  computeTableBulkBarClasses,
  computeTableBulkBarCountClasses,
  computeTablePagerButtonClasses,
} from '@/presentation/design/table-default-classes'
import { useGridString } from './grid-strings'
import { ExportSelectedButton, type SelectionExportProps } from './selection-export'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** A bulk action's prompt and the two labels that answer it, the defaults filled in. */
interface ConfirmWords {
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel: string
}

/**
 * The words of a confirm: a string is the prompt alone, answered by the
 * language-resolved Confirm / Cancel; the object form may name its own buttons.
 */
function confirmWords(
  confirm: NonNullable<DataTableBulkAction['confirm']>,
  defaults: Omit<ConfirmWords, 'message'>
): ConfirmWords {
  if (typeof confirm === 'string') return { message: confirm, ...defaults }
  return {
    message: confirm.message,
    confirmLabel: confirm.confirmLabel ?? defaults.confirmLabel,
    cancelLabel: confirm.cancelLabel ?? defaults.cancelLabel,
  }
}

interface SelectionBarProps {
  readonly bulkActions: readonly DataTableBulkAction[]
  readonly selectedCount: number
  readonly onExecute: (action: DataTableBulkAction) => void
  /** The selection export, on a multi-select grid that offers one. */
  readonly selectionExport?: SelectionExportProps
  /**
   * The table the selection's Delete removes rows from — present only when the
   * reader may delete them (decided on the server), absent otherwise: a reader
   * who may not delete is not shown the button at all.
   */
  readonly deleteFrom?: string
}

/**
 * Hidden placeholder rendered while no rows are selected.
 *
 * The bulk-action buttons stay in the DOM, hidden, so a spec that locates one by
 * its text resolves it before the reader makes any selection; they are revealed
 * in the bottom bar when the selection becomes non-empty.
 */
export function HiddenBulkActionsPlaceholder({
  bulkActions,
}: {
  readonly bulkActions: readonly DataTableBulkAction[]
}) {
  if (bulkActions.length === 0) return undefined
  return (
    <div
      className="hidden"
      aria-hidden="true"
    >
      {bulkActions.map((action, i) => (
        <button
          key={i}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

/** The selection's own Delete, as a bulk action the bar runs like any other. */
function deleteAction(
  table: string,
  words: { readonly label: string; readonly message: string; readonly cancelLabel: string }
): DataTableBulkAction {
  return {
    label: words.label,
    confirm: { message: words.message, confirmLabel: words.label, cancelLabel: words.cancelLabel },
    action: { type: 'crud', table, operation: 'delete' },
  } as DataTableBulkAction
}

/**
 * What acts on the checked rows, drawn in the LEFT half of the bottom bar in
 * place of the range summary once anything is checked: the count, Export
 * selected, Delete when the reader may delete, then the author's own bulk
 * actions. Nothing is drawn while nothing is checked — the bar then says where
 * in the list the reader is, which is the only thing it has to say.
 *
 * ## The confirm prompt asks quietly and answers with a button
 * A question a bulk action asks (and Delete always asks one) replaces the
 * buttons in the same row: a muted caption answered by the one primary button
 * — the destructive one for Delete — keeping colour for a FAILURE.
 */
export function SelectionBar({
  bulkActions,
  selectedCount,
  onExecute,
  selectionExport,
  deleteFrom,
}: SelectionBarProps) {
  const [confirmAction, setConfirmAction] = useState<DataTableBulkAction | undefined>(undefined)
  const confirmLabel = useGridString('confirmGate.confirm', 'Confirm')
  const cancelLabel = useGridString('confirmGate.cancel', 'Cancel')
  const countLabel = useGridString('datatable.selected', '{count} selected', {
    count: selectedCount,
  })
  const deleteLabel = useGridString('datatable.delete', 'Delete')
  const deleteMessage = useGridString('datatable.deleteConfirm', 'Delete {count} records?')
  if (selectedCount === 0) return undefined

  // An author who declared a delete of their own keeps theirs: one Delete per bar.
  const actions =
    deleteFrom === undefined || bulkActions.some(isDelete)
      ? bulkActions
      : [
          deleteAction(deleteFrom, { label: deleteLabel, message: deleteMessage, cancelLabel }),
          ...bulkActions,
        ]
  return (
    <div
      data-slot="data-table-bulk-actions"
      className={computeTableBulkBarClasses()}
    >
      <span className={computeTableBulkBarCountClasses()}>{countLabel}</span>
      {!confirmAction && selectionExport && (
        <ExportSelectedButton
          {...selectionExport}
          selectedCount={selectedCount}
        />
      )}
      {!confirmAction &&
        actions.map((action, i) => (
          <BulkActionButton
            key={i}
            action={action}
            onPress={() => (action.confirm ? setConfirmAction(action) : onExecute(action))}
          />
        ))}
      {confirmAction?.confirm !== undefined && (
        <ConfirmPrompt
          words={confirmWords(confirmAction.confirm, { confirmLabel, cancelLabel })}
          destructive={isDelete(confirmAction)}
          selectedCount={selectedCount}
          onConfirm={() => {
            onExecute(confirmAction)
            setConfirmAction(undefined)
          }}
          onCancel={() => setConfirmAction(undefined)}
        />
      )}
    </div>
  )
}

/** Whether a bulk action deletes rows — its confirm is then answered in the destructive tone. */
const isDelete = (action: DataTableBulkAction): boolean =>
  'type' in action.action &&
  action.action.type === 'crud' &&
  (action.action as { readonly operation?: string }).operation === 'delete'

/** One bulk action's button on the bar. */
function BulkActionButton(props: {
  readonly action: DataTableBulkAction
  readonly onPress: () => void
}) {
  return (
    <button
      type="button"
      {...TABLE_TOOLBAR_BUTTON_PART}
      className={computeTablePagerButtonClasses({ variant: 'outline' })}
      onClick={props.onPress}
    >
      {props.action.label}
    </button>
  )
}

/** The inline question and its two answers, in the bar's own row. */
function ConfirmPrompt(props: {
  readonly words: ConfirmWords
  readonly destructive: boolean
  readonly selectedCount: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {props.words.message.replace('{count}', String(props.selectedCount))}
      <button
        type="button"
        {...TABLE_TOOLBAR_PRIMARY_BUTTON_PART}
        className={computeTablePagerButtonClasses({
          variant: props.destructive ? 'destructive' : 'default',
        })}
        onClick={props.onConfirm}
      >
        {props.words.confirmLabel}
      </button>
      <button
        type="button"
        {...TABLE_TOOLBAR_BUTTON_PART}
        className={computeTablePagerButtonClasses({ variant: 'outline' })}
        onClick={props.onCancel}
      >
        {props.words.cancelLabel}
      </button>
    </div>
  )
}
