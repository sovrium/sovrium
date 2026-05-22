/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

interface CalendarCreateModalProps {
  readonly open: boolean
  readonly tableName: string
  readonly clickedDate: string | undefined
  readonly dateField: string | undefined
  readonly onClose: () => void
  readonly onSubmitted?: () => void
}

function formToJsonPayload(form: HTMLFormElement): Record<string, string> {
  const formData = new FormData(form)
  const entries = Array.from(formData.entries())
  const stringEntries = entries.filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return Object.fromEntries(stringEntries)
}

interface CalendarCreateFormProps {
  readonly tableName: string
  readonly clickedDate: string | undefined
  readonly dateField: string | undefined
  readonly onClose: () => void
  readonly onSubmitted: (() => void) | undefined
}

async function postRecord(
  tableName: string,
  payload: Record<string, string>
): Promise<{ readonly ok: boolean }> {
  try {
    const res = await fetch(`/api/tables/${tableName}/records`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}

function CalendarCreateForm({
  tableName,
  clickedDate,
  dateField,
  onClose,
  onSubmitted,
}: CalendarCreateFormProps): ReactElement {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const payload = formToJsonPayload(e.currentTarget)
    const result = await postRecord(tableName, payload)
    if (result.ok) {
      onSubmitted?.()
      onClose()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <label className="text-foreground block text-sm font-medium">
        <span>Title</span>
        <input
          type="text"
          name="title"
          required
          className="border-border bg-background-raised text-foreground focus:border-focus-ring focus:ring-focus-ring mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none"
        />
      </label>
      {dateField && clickedDate && (
        <input
          type="hidden"
          name={dateField}
          value={clickedDate}
        />
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="border-border text-foreground hover:bg-background-subtle rounded border px-3 py-2 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-primary text-primary-fg hover:bg-primary-hover rounded px-3 py-2 text-sm font-medium"
        >
          Create
        </button>
      </div>
    </form>
  )
}

export function CalendarCreateModal({
  open,
  tableName,
  clickedDate,
  dateField,
  onClose,
  onSubmitted,
}: CalendarCreateModalProps): ReactElement | undefined {
  if (!open) return undefined
  return (
    <>
      <div
        className="bg-scrim/50 fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-create-modal-title"
        data-modal="create-event"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-background-raised w-full max-w-md rounded-lg p-6 shadow-xl">
          <h2
            id="calendar-create-modal-title"
            className="text-foreground mb-4 text-lg font-semibold"
          >
            Create {tableName}
          </h2>
          <CalendarCreateForm
            tableName={tableName}
            clickedDate={clickedDate}
            dateField={dateField}
            onClose={onClose}
            onSubmitted={onSubmitted}
          />
        </div>
      </div>
    </>
  )
}
