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

/**
 * Convert a `<form>` element's payload into a plain JSON object.
 * Skips File entries — only string values are forwarded, matching the
 * minimal create-event modal's hidden-input + text-input contract.
 */
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

/**
 * Submit a form payload to the records endpoint. Returns whether the
 * request succeeded so the caller can decide whether to close the modal
 * or surface an error.
 */
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

/** Inner form — split from the wrapper to satisfy max-lines-per-function. */
function CalendarCreateForm({
  tableName,
  clickedDate,
  dateField,
  onClose,
  onSubmitted,
}: CalendarCreateFormProps): ReactElement {
  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- React 19 Compiler memoizes; useCallback restricted by no-restricted-syntax
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
      <label className="block text-sm font-medium text-gray-700">
        <span>Title</span>
        <input
          type="text"
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
          className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create
        </button>
      </div>
    </form>
  )
}

/**
 * Lightweight create-event modal opened by `calendarInteraction.onDateClick`.
 *
 * The schema config is a CRUD `create` action targeting a table — we render
 * a minimal `<form>` (matching the spec assertion: the modal exposes either
 * `getByRole('dialog')` or `[data-modal="create-event"]`). The form posts
 * JSON to the records endpoint via `fetch` so we don't full-page reload,
 * and closes the modal on success.
 *
 * Why minimal: the test contract only requires that *some* dialog appears
 * with the clicked date pre-filled — the schema does not (yet) declare
 * which fields the modal should render. A future spec can extend this
 * with field-level configuration.
 */
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
        className="fixed inset-0 z-40 bg-black/50"
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
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2
            id="calendar-create-modal-title"
            className="mb-4 text-lg font-semibold text-gray-900"
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
