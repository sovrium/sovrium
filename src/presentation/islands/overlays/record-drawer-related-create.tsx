/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The create affordance of a CAP-8 related section.
 *
 * An inline form with one control per column the section shows — the SAME
 * control an editable drawer of the related table draws for that column's
 * type (`FieldInput`): a date in the page's own format, a status or a select
 * as its options, a number as a number input, a person or a link as its
 * picker. It is POSTed to the related table's records endpoint with the
 * relationship column already set to the opened record — so the new row lands
 * in the section it was created from. A computed or stamped column, and one
 * the reader may not write, gets no control.
 *
 * Mounted only for a caller the SSR host found allowed to create in the table;
 * the endpoint still enforces it. A refusal it pins to a field is said on that
 * field, the form staying open with what was typed; any other is one sentence.
 */

import { useMemo, useState, type ReactElement } from 'react'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { renderPendingContent } from '@/presentation/design/spinner-mark'
import { FieldInput } from './record-drawer-entry'
import { relatedCreateEntries, useRelatedCreateSubmit } from './record-drawer-related-create-submit'
import type { RelatedLabels, RelatedSection } from './record-drawer-related'
import type { Values } from './record-drawer-values'

const FORM_CLASS = 'flex flex-col gap-2'
const SAVE_CLASS = 'bg-primary text-primary-foreground rounded px-3 py-1 text-sm'
const CANCEL_CLASS = 'text-muted-foreground px-3 py-1 text-sm'
const ERROR_CLASS = 'text-error-fg text-sm'

const NO_FIELD_ERRORS: Readonly<Record<string, string>> = {}

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
  const entries = useMemo(() => relatedCreateEntries(section), [section])
  const [values, setValues] = useState<Values>({})
  const { refusal, pending, onSubmit } = useRelatedCreateSubmit({
    section,
    entries,
    values,
    linkValue,
    onDone,
  })
  const fieldErrors = refusal.kind === 'fields' ? refusal.fields : NO_FIELD_ERRORS
  const onChange = (name: string, value: string) =>
    setValues((held) => ({ ...held, [name]: value }))
  return (
    <form
      className={FORM_CLASS}
      onSubmit={onSubmit}
    >
      {entries.map((entry) => (
        <FieldInput
          key={entry.name}
          field={entry}
          value={values[entry.name] ?? ''}
          disabled={false}
          onChange={onChange}
          error={fieldErrors[entry.name]}
        />
      ))}
      {refusal.kind === 'failed' && (
        <p
          role="alert"
          className={ERROR_CLASS}
        >
          {labels.createFailed}
        </p>
      )}
      <CreateFormButtons
        labels={labels}
        pending={pending}
        onCancel={() => onDone(false)}
      />
    </form>
  )
}

/** Save submits the form; cancel closes it without writing. */
function CreateFormButtons({
  labels,
  pending,
  onCancel,
}: {
  readonly labels: RelatedLabels
  readonly pending: boolean
  readonly onCancel: () => void
}): ReactElement {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        data-component-type="button"
        className={SAVE_CLASS}
        {...pendingControlProps(pending)}
      >
        {pending ? renderPendingContent(labels.saving) : labels.save}
      </button>
      <button
        type="button"
        data-component-type="button"
        className={CANCEL_CLASS}
        onClick={onCancel}
      >
        {labels.cancel}
      </button>
    </div>
  )
}
