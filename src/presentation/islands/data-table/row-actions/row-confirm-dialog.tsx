/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import {
  computeDialogContentClasses,
  computeDialogOverlayClasses,
} from '@/presentation/design/dialog-default-classes'
import { copyOf, useTypedLock } from './row-confirm-copy'
import { GateFooter, GateHeader, TypedConfirm } from './row-confirm-parts'
import type { ActionControlLabels } from './row-action-types'
import type { TableRecord } from '../../runtime/types'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

/**
 * A row action's `confirm` gate: base-nova's `AlertDialog`, modal, centred over
 * the page.
 *
 * The question is asked where shadcn/ui asks it, over the page rather than in
 * the row, so the row never moves: the trigger stays where it was, and focus
 * returns to it when the dialog closes.
 *
 * The contract is kept: the dialog is an `alertdialog` named by the prompt (the
 * string form) or the `title` (the object form), its confirm button carries the
 * action's label and `data-action-type`, its cancel button the host's
 * language-resolved label, and an object form's `input.matchValue` locks the
 * confirm button until the reader types it. `$record.*` is filled from the row
 * the gate was armed for, as text.
 */

export interface RowConfirmDialogProps {
  readonly open: boolean
  readonly action: ActionColumnItem
  readonly record: TableRecord
  readonly labels: ActionControlLabels
  /** Fired once the reader confirms; the host dispatches for the gate's row. */
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/** The confirm gate of one row action. */
export function RowConfirmDialog({
  open,
  action,
  record,
  labels,
  onConfirm,
  onCancel,
}: RowConfirmDialogProps): ReactElement {
  const copy = copyOf(action, record, labels)
  const { object, typed, setTyped, locked } = useTypedLock(action, record)
  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={(next) => (next ? undefined : onCancel())}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="alert-dialog-overlay"
          className={computeDialogOverlayClasses()}
        />
        <Dialog.Popup
          role={object?.role ?? 'alertdialog'}
          aria-modal="true"
          data-slot="alert-dialog-content"
          data-size="default"
          className={computeDialogContentClasses('alert-dialog')}
        >
          <GateHeader copy={copy} />
          {object?.input && (
            <TypedConfirm
              label={object.input.label}
              value={typed}
              onChange={setTyped}
            />
          )}
          <GateFooter
            copy={copy}
            action={action}
            locked={locked}
            onConfirm={onConfirm}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
