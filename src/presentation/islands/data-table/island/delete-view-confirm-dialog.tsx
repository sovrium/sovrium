/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeTableDialogBodyClasses,
  computeTableDialogPanelClasses,
  computeTableDialogPositionerClasses,
  computeTableDialogTitleClasses,
  computeTableEditorFooterClasses,
} from '@/presentation/design/table-default-classes'
import { computeOverlayBackdropClasses } from '../../overlays/overlay-default-classes'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'

/**
 * Delete-view confirmation Dialog (PG-03 / [internal ref]).
 *
 * Two-step deletion gesture that mirrors the `Reset to defaults` confirmation
 * in `settings-dialog.tsx`:
 *
 *  1. The Views dropdown's `Delete view` button calls the orchestrator's
 *     handler, which opens this dialog with the target view's name.
 *  2. The user clicks `Confirm` (or `Delete`), which fires `onConfirm` and
 *     dismisses the dialog. Clicking `Cancel` closes without deleting.
 *
 * The spec asserts the dialog body contains either "are you sure" or "cannot
 * be undone" wording — we use both for clarity.
 */
interface DeleteViewConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly viewName: string
  /**
   * Commit handler. Resolves on success; rejects on failure. The dialog
   * displays the error inline and stays open so the user can retry or cancel.
   */
  readonly onConfirm: () => Promise<void>
}

export function DeleteViewConfirmDialog({
  open,
  onOpenChange,
  viewName,
  onConfirm,
}: DeleteViewConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setPending(false)
        setError(undefined)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const handleConfirm = useCallback(async () => {
    setPending(true)
    setError(undefined)
    try {
      await onConfirm()
      onOpenChange(false)
      setPending(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete view'
      setError(message)
      setPending(false)
    }
  }, [onConfirm, onOpenChange])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
        <Dialog.Popup className={computeTableDialogPositionerClasses()}>
          <DeleteViewBody
            viewName={viewName}
            error={error}
            pending={pending}
            onConfirm={handleConfirm}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface DeleteViewBodyProps {
  readonly viewName: string
  readonly error: string | undefined
  readonly pending: boolean
  readonly onConfirm: () => void
}

/**
 * Confirmation body of the Delete-view dialog. Extracted so
 * {@link DeleteViewConfirmDialog} stays under the islands' 60-line
 * max-lines-per-function cap. State (pending, error) stays in the parent —
 * this is a pure render.
 */
function DeleteViewBody({ viewName, error, pending, onConfirm }: DeleteViewBodyProps) {
  return (
    <div className={computeTableDialogPanelClasses()}>
      <Dialog.Title className={computeTableDialogTitleClasses()}>Delete view?</Dialog.Title>
      <Dialog.Description className={computeTableDialogBodyClasses()}>
        Are you sure you want to delete <span className="font-medium">{viewName}</span>? This action
        cannot be undone.
      </Dialog.Description>
      {error && (
        <p
          role="alert"
          className="text-error-fg mt-2 text-sm"
        >
          {error}
        </p>
      )}
      <div className={computeTableEditorFooterClasses()}>
        <Dialog.Close
          type="button"
          className={DROPDOWN_TRIGGER_CLASS}
        >
          Cancel
        </Dialog.Close>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={computeButtonDefaultClasses({ variant: 'destructive', size: 'sm' })}
        >
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
