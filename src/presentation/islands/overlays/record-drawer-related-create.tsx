/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The create affordance of a CAP-8 related section.
 *
 * An inline form with one textbox per column the section shows, POSTed to the
 * related table's records endpoint with the relationship column already set
 * to the opened record — so the new row lands in the section it was created
 * from. Relationship and computed columns get no control: a relation needs a
 * picker and a computed value is never written, and both stay editable in the
 * drawer the row opens.
 *
 * Mounted only for a caller the SSR host found allowed to create in the table;
 * the endpoint still enforces it, and a refusal is reported inline.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- per-field change handlers close over the field name; the form exists only while the reader is creating. */

import { useState, type FormEvent, type ReactElement } from 'react'
import type { RelatedLabels, RelatedSection } from './record-drawer-related'

/** Column types a single textbox cannot write. */
const NOT_WRITABLE: ReadonlySet<string> = new Set([
  'relationship',
  'formula',
  'lookup',
  'rollup',
  'count',
  'autonumber',
  'created-at',
  'updated-at',
  'created-by',
  'updated-by',
])

const FORM_CLASS = 'flex flex-col gap-2'
const LABEL_CLASS = 'text-foreground-muted flex flex-col gap-1 text-sm'
const INPUT_CLASS = 'border-border bg-background text-foreground rounded border px-2 py-1 text-sm'
const SAVE_CLASS = 'bg-primary text-primary-fg rounded px-3 py-1 text-sm'
const CANCEL_CLASS = 'text-foreground-muted px-3 py-1 text-sm'
const ERROR_CLASS = 'text-error-fg text-sm'

/** POST the filled values plus the link back to the opened record. */
async function createRelatedRecord(
  section: RelatedSection,
  values: Readonly<Record<string, string>>,
  linkValue: string | number
): Promise<boolean> {
  const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))
  const response = await fetch(`/api/tables/${encodeURIComponent(section.table)}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...filled, [section.field]: linkValue }),
  })
  return response.ok
}

export function RelatedCreateForm({
  section,
  linkValue,
  labels,
  onDone,
}: {
  readonly section: RelatedSection
  readonly linkValue: string | number
  readonly labels: RelatedLabels
  readonly onDone: (created: boolean) => void
}): ReactElement {
  const [values, setValues] = useState<Readonly<Record<string, string>>>({})
  const [failed, setFailed] = useState(false)
  const columns = section.columns.filter(
    (column) => column.field !== section.field && !NOT_WRITABLE.has(column.type)
  )
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void createRelatedRecord(section, values, linkValue).then((ok) => {
      if (ok) onDone(true)
      else setFailed(true)
    })
  }
  return (
    <form
      className={FORM_CLASS}
      onSubmit={onSubmit}
    >
      {columns.map((column) => (
        <label
          key={column.field}
          className={LABEL_CLASS}
        >
          {column.label}
          <input
            type="text"
            className={INPUT_CLASS}
            value={values[column.field] ?? ''}
            onChange={(event) => setValues({ ...values, [column.field]: event.target.value })}
          />
        </label>
      ))}
      {failed && (
        <p
          role="alert"
          className={ERROR_CLASS}
        >
          {labels.createFailed}
        </p>
      )}
      <CreateFormButtons
        labels={labels}
        onCancel={() => onDone(false)}
      />
    </form>
  )
}

/** Save submits the form; cancel closes it without writing. */
function CreateFormButtons({
  labels,
  onCancel,
}: {
  readonly labels: RelatedLabels
  readonly onCancel: () => void
}): ReactElement {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        className={SAVE_CLASS}
      >
        {labels.save}
      </button>
      <button
        type="button"
        className={CANCEL_CLASS}
        onClick={onCancel}
      >
        {labels.cancel}
      </button>
    </div>
  )
}
