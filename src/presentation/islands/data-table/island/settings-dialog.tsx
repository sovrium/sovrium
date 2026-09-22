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
 * Settings dialog for the data-table island (PG-03 / [internal ref]).
 *
 * Houses the "Reset to defaults" action that clears every user preference for
 * the bound table (column widths, density, default view, column order).
 *
 * The reset action is a two-step gesture: clicking "Reset to defaults" inside
 * the settings dialog opens a second confirmation dialog with explicit
 * Confirm / Cancel buttons, so the spec's interaction chain
 * `Settings button → Reset to defaults button → Confirm button in dialog`
 * always resolves three distinct DOM elements.
 */
interface SettingsDialogProps {
  readonly onReset: () => void
}

function SettingsBody({ onOpenConfirm }: { readonly onOpenConfirm: () => void }) {
  return (
    <div className={computeTableDialogPanelClasses()}>
      <Dialog.Title className={computeTableDialogTitleClasses()}>Table settings</Dialog.Title>
      <Dialog.Description className={computeTableDialogBodyClasses()}>
        Personal table preferences — column widths, row density, and your default view.
      </Dialog.Description>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
          onClick={onOpenConfirm}
        >
          Reset to defaults
        </button>
      </div>
      <div className={computeTableEditorFooterClasses()}>
        <Dialog.Close className={DROPDOWN_TRIGGER_CLASS}>Close</Dialog.Close>
      </div>
    </div>
  )
}

function ConfirmBody({ onConfirm }: { readonly onConfirm: () => void }) {
  return (
    <div className={computeTableDialogPanelClasses()}>
      <Dialog.Title className={computeTableDialogTitleClasses()}>
        Reset table preferences?
      </Dialog.Title>
      <Dialog.Description className={computeTableDialogBodyClasses()}>
        This clears your column widths, row density, column order, and default view for this table.
        Developer-configured defaults apply on the next page load.
      </Dialog.Description>
      <div className={computeTableEditorFooterClasses()}>
        <Dialog.Close className={DROPDOWN_TRIGGER_CLASS}>Cancel</Dialog.Close>
        <button
          type="button"
          className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

export function SettingsDialog({ onReset }: SettingsDialogProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const openConfirm = useCallback(() => setConfirmOpen(true), [])
  const handleConfirm = useCallback(() => {
    onReset()
    setConfirmOpen(false)
  }, [onReset])

  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger
          className={DROPDOWN_TRIGGER_CLASS}
          aria-label="Settings"
        >
          Settings
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
          <Dialog.Popup className={computeTableDialogPositionerClasses()}>
            <SettingsBody onOpenConfirm={openConfirm} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={computeOverlayBackdropClasses()} />
          <Dialog.Popup className={computeTableDialogPositionerClasses()}>
            <ConfirmBody onConfirm={handleConfirm} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
