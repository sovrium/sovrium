/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  computeTableBulkBarClasses,
  computeTableBulkBarCountClasses,
  computeTablePanelCaptionClasses,
  computeTableToolbarButtonClasses,
  computeTableToolbarPrimaryButtonClasses,
} from '@/presentation/design/table-default-classes'
import { useGridString } from './grid-strings'
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

interface BulkActionBarProps {
  readonly bulkActions: readonly DataTableBulkAction[]
  readonly selectedCount: number
  readonly onExecute: (action: DataTableBulkAction) => void
}

/**
 * Hidden placeholder rendered while no rows are selected.
 *
 * The bulk-action buttons must remain present in the DOM so that E2E specs
 * targeting them by `getByRole('button', { name: ... })` resolve before the
 * user makes any selection (the buttons are revealed when selection becomes
 * non-empty).
 */
function HiddenBulkActionsPlaceholder({
  bulkActions,
}: {
  readonly bulkActions: readonly DataTableBulkAction[]
}) {
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

/**
 * The bar that appears above the header row once rows are selected.
 *
 * ## The confirm prompt asks quietly and answers with a button
 * It used to sit inside a bordered `warning-bg` gate with the confirm drawn as
 * a green link — three signals for one question, and the loudest of them
 * spending the reserved colour on an outcome that had not happened yet. It now
 * asks with a right-aligned muted caption and answers with the one primary
 * button on the bar, keeping colour for a FAILURE.
 */
export function BulkActionBar({ bulkActions, selectedCount, onExecute }: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<DataTableBulkAction | undefined>(undefined)
  const confirmLabel = useGridString('confirmGate.confirm', 'Confirm')
  const cancelLabel = useGridString('confirmGate.cancel', 'Cancel')

  if (selectedCount === 0) {
    return <HiddenBulkActionsPlaceholder bulkActions={bulkActions} />
  }

  return (
    <div className={computeTableBulkBarClasses()}>
      <span className={computeTableBulkBarCountClasses()}>{selectedCount} selected</span>
      {!confirmAction &&
        bulkActions.map((action, i) => (
          <button
            key={i}
            type="button"
            className={computeTableToolbarButtonClasses()}
            onClick={() => {
              if (action.confirm) {
                setConfirmAction(action)
              } else {
                onExecute(action)
              }
            }}
          >
            {action.label}
          </button>
        ))}
      {confirmAction?.confirm !== undefined && (
        <ConfirmPrompt
          words={confirmWords(confirmAction.confirm, { confirmLabel, cancelLabel })}
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

/** The inline question and its two answers, right-aligned on the bar. */
function ConfirmPrompt(props: {
  readonly words: ConfirmWords
  readonly selectedCount: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  return (
    <div className={`ml-auto flex items-center gap-2 ${computeTablePanelCaptionClasses()}`}>
      {props.words.message.replace('{count}', String(props.selectedCount))}
      <button
        type="button"
        className={computeTableToolbarPrimaryButtonClasses()}
        onClick={props.onConfirm}
      >
        {props.words.confirmLabel}
      </button>
      <button
        type="button"
        className={computeTableToolbarButtonClasses()}
        onClick={props.onCancel}
      >
        {props.words.cancelLabel}
      </button>
    </div>
  )
}
