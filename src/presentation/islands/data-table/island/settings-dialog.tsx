/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState } from 'react'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'

interface SettingsDialogProps {
  readonly onReset: () => void
}

function SettingsBody({ onOpenConfirm }: { readonly onOpenConfirm: () => void }) {
  return (
    <div className="bg-background-overlay border-border w-full max-w-sm rounded-lg border p-6 shadow-xl">
      <Dialog.Title className="text-foreground text-lg font-semibold">Table settings</Dialog.Title>
      <Dialog.Description className="text-foreground-muted mt-2 text-sm">
        Personal table preferences — column widths, row density, and your default view.
      </Dialog.Description>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="hover:bg-background-subtle rounded border px-3 py-2 text-left text-sm"
          onClick={onOpenConfirm}
        >
          Reset to defaults
        </button>
      </div>
      <div className="mt-4 flex justify-end">
        <Dialog.Close className={DROPDOWN_TRIGGER_CLASS}>Close</Dialog.Close>
      </div>
    </div>
  )
}

function ConfirmBody({ onConfirm }: { readonly onConfirm: () => void }) {
  return (
    <div className="bg-background-overlay border-border w-full max-w-sm rounded-lg border p-6 shadow-xl">
      <Dialog.Title className="text-foreground text-lg font-semibold">
        Reset table preferences?
      </Dialog.Title>
      <Dialog.Description className="text-foreground-muted mt-2 text-sm">
        This clears your column widths, row density, column order, and default view for this table.
        Developer-configured defaults apply on the next page load.
      </Dialog.Description>
      <div className="mt-4 flex justify-end gap-2">
        <Dialog.Close className={DROPDOWN_TRIGGER_CLASS}>Cancel</Dialog.Close>
        <button
          type="button"
          className="bg-primary hover:bg-primary-emphasis text-on-primary rounded px-3 py-1 text-sm"
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
          <Dialog.Backdrop className="bg-scrim/40 fixed inset-0 z-50" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <SettingsBody onOpenConfirm={openConfirm} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="bg-scrim/50 fixed inset-0 z-50" />
          <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <ConfirmBody onConfirm={handleConfirm} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
