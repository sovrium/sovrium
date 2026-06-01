/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState } from 'react'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'

interface DeleteViewConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly viewName: string
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
        <Dialog.Backdrop className="bg-scrim/50 fixed inset-0 z-50" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

function DeleteViewBody({ viewName, error, pending, onConfirm }: DeleteViewBodyProps) {
  return (
    <div className="bg-background-overlay border-border w-full max-w-sm rounded-lg border p-6 shadow-xl">
      <Dialog.Title className="text-foreground text-lg font-semibold">Delete view?</Dialog.Title>
      <Dialog.Description className="text-foreground-muted mt-2 text-sm">
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
      <div className="mt-4 flex justify-end gap-2">
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
          className="bg-error-fg hover:bg-error-fg/90 text-on-primary rounded px-3 py-1 text-sm disabled:opacity-60"
        >
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}
