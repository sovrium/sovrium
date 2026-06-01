/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useState } from 'react'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'

interface SaveViewDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSave: (name: string) => Promise<void>
  readonly initialName?: string
}

function useSaveViewDialogState(
  initialName: string,
  onOpenChange: (open: boolean) => void,
  onSave: (name: string) => Promise<void>
) {
  const [name, setName] = useState(initialName)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setName('')
        setError(undefined)
        setPending(false)
      } else {
        setName(initialName)
      }
      onOpenChange(nextOpen)
    },
    [initialName, onOpenChange]
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = name.trim()
      if (trimmed === '') {
        setError('Name is required')
        return
      }
      setPending(true)
      setError(undefined)
      try {
        await onSave(trimmed)
        onOpenChange(false)
        setName('')
        setPending(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save view'
        setError(message.includes('CONFLICT') ? 'A view with that name already exists' : message)
        setPending(false)
      }
    },
    [name, onOpenChange, onSave]
  )

  return { name, pending, error, handleNameChange, handleOpenChange, handleSubmit }
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
  initialName = '',
}: SaveViewDialogProps) {
  const { name, pending, error, handleNameChange, handleOpenChange, handleSubmit } =
    useSaveViewDialogState(initialName, onOpenChange, onSave)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-scrim/40 fixed inset-0 z-50" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <SaveViewForm
            name={name}
            error={error}
            pending={pending}
            onNameChange={handleNameChange}
            onSubmit={handleSubmit}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface SaveViewFormProps {
  readonly name: string
  readonly error: string | undefined
  readonly pending: boolean
  readonly onNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

function SaveViewForm({ name, error, pending, onNameChange, onSubmit }: SaveViewFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-background-overlay border-border w-full max-w-sm rounded-lg border p-6 shadow-xl"
    >
      <Dialog.Title className="text-foreground text-lg font-semibold">Save view</Dialog.Title>
      <Dialog.Description className="text-foreground-muted mt-1 text-sm">
        Name this view so you can come back to it from the Views menu.
      </Dialog.Description>
      <div className="mt-4">
        <label
          htmlFor="save-view-name"
          className="text-foreground mb-1 block text-sm font-medium"
        >
          Name
        </label>
        <input
          id="save-view-name"
          type="text"
          value={name}
          onChange={onNameChange}
          autoFocus
          className="border-border focus:border-primary focus:ring-focus-ring w-full rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
          aria-label="Name"
          aria-invalid={error !== undefined}
        />
        {error && (
          <p
            role="alert"
            className="text-error-fg mt-1 text-sm"
          >
            {error}
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Dialog.Close
          type="button"
          className={DROPDOWN_TRIGGER_CLASS}
        >
          Cancel
        </Dialog.Close>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary hover:bg-primary-emphasis text-on-primary rounded px-3 py-1 text-sm disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
