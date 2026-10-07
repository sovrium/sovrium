/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withDisplayLabels } from '@/domain/models/app/pages/substitute-record-vars'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { AiRefinementMarker } from '../runtime/ai-refinement-marker'
import { readAiRefinementStatus } from '../runtime/ai-refinement-status'
import { RecordButton, type RecordButtonConfig } from '../runtime/record-button'
import { ChoiceField } from './record-drawer-choice-input'
import { isChoiceField, isLinkField } from './record-drawer-choices'
import { isStructured } from './record-drawer-field'
import { LinkField } from './record-drawer-link-input'
import { ReadOnlyValue } from './record-drawer-read-only-value'
import { StructuredValue } from './record-drawer-structured-value'
import { TypedField } from './record-drawer-typed-input'
import type { RecordDrawerField, RawRecord } from './record-drawer-field'
import type { ReactElement, ReactNode } from 'react'

/**
 * One record-drawer entry as the reader sees it: its heading and guidance,
 * its control or read-only value, a structured block for nested data, the
 * AI refinement status and a field-level button.
 */

/**
 * The entry's heading: its resolved display name, or the RAW `name` verbatim.
 *
 * Raw on purpose — humanizing here would restyle every panel heading in every
 * already-shipped app with no config edit. The form control's fallback humanizes
 * and this one does not; that difference is the contract, not an oversight.
 */
function entryLabel(field: RecordDrawerField): string {
  return field.label ?? field.name
}

/** One entry's guidance line, or nothing when the entry carries no description. */
function EntryDescription({ field }: { readonly field: RecordDrawerField }) {
  if (field.description === undefined) return undefined
  return (
    <span
      id={fieldDescriptionId(field.name)}
      className="text-foreground-muted text-sm"
    >
      {field.description}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CAP-3 — structured field display
// ──────────────────────────────────────────────────────────────────────────────

/** A read-only structured field block (never a text input) — for a `renderAs` field. */
export function StructuredFieldDisplay({
  field,
  value,
}: {
  readonly field: RecordDrawerField
  readonly value: unknown
}): ReactElement {
  return (
    <div className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{entryLabel(field)}</span>
      <StructuredValue
        renderAs={field.renderAs ?? 'json'}
        value={value}
      />
      <EntryDescription field={field} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Editable text field
// ──────────────────────────────────────────────────────────────────────────────

/** A single schema-derived editable form control (one per editable non-structured field). */
export function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  readonly field: RecordDrawerField
  readonly value: string
  /** The record has not loaded yet — the control is inert until it has. */
  readonly disabled: boolean
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  if (isLinkField(field)) {
    return (
      <LinkField
        field={field}
        label={entryLabel(field)}
        value={value}
        disabled={disabled}
        onChange={onChange}
      >
        <EntryDescription field={field} />
      </LinkField>
    )
  }
  if (isChoiceField(field)) {
    return (
      <ChoiceField
        field={field}
        label={entryLabel(field)}
        value={value}
        disabled={disabled}
        onChange={onChange}
      >
        <EntryDescription field={field} />
      </ChoiceField>
    )
  }
  return (
    <TypedField
      field={field}
      label={entryLabel(field)}
      value={value}
      disabled={disabled}
      onChange={onChange}
    >
      <EntryDescription field={field} />
    </TypedField>
  )
}

/**
 * One entry of a READ-ONLY drawer (a system-detail binding, or a `canEdit:
 * false` drawer): its heading a term of the drawer's description list, and its
 * value the detail after it.
 */
export function ReadOnlyEntry({
  field,
  children,
}: {
  readonly field: RecordDrawerField
  readonly children: ReactNode
}): ReactElement {
  return (
    <div className="text-md flex flex-col gap-1">
      <dt className="text-foreground-muted">{entryLabel(field)}</dt>
      <dd className="flex flex-col gap-1">{children}</dd>
    </div>
  )
}

/**
 * A read-only entry's value: a `data-field`-tagged span, drawn as the grid
 * draws the same field (queryable / maskable), never a disabled text input.
 */
function ReadOnlyFieldValue({
  field,
  value,
}: {
  readonly field: RecordDrawerField
  readonly value: unknown
}): ReactElement {
  return (
    <span
      data-field={field.name}
      className="text-foreground"
    >
      <ReadOnlyValue
        type={field.type}
        value={value}
        label={entryLabel(field)}
        currency={field.currency}
        weekday={field.weekday}
        timeZone={field.timeZone}
        paints={field.paints}
      />
    </span>
  )
}

/** The AI refinement status beside a value that has one. */
export function RefinementStatus({
  record,
  field,
}: {
  readonly record: RawRecord
  readonly field: RecordDrawerField
}): ReactElement {
  // An AI-computed value whose refinement failed reads exactly like a refined
  // one. The status rides in on the very response this drawer already parsed,
  // so nothing new is fetched to say so — and the drawer has room to say it.
  return (
    <AiRefinementMarker
      status={readAiRefinementStatus(record, field.name)}
      placement="inline"
    />
  )
}

/** A button field: an action on the loaded record, never an input. */
export function FieldButton({
  field,
  config,
  record,
  table,
}: {
  readonly field: RecordDrawerField
  readonly config: RecordButtonConfig
  readonly record: RawRecord
  readonly table?: string
}): ReactElement {
  return (
    <RecordButton
      config={config}
      fieldName={field.name}
      record={record}
      {...(table === undefined ? {} : { table })}
      {...(record['id'] === undefined ? {} : { recordId: String(record['id']) })}
    />
  ) as ReactElement
}

/** What a read-only entry's detail holds: an action, a structured block or the value. */
export function ReadOnlyDetail({
  field,
  record,
  table,
}: {
  readonly field: RecordDrawerField
  readonly record: RawRecord
  readonly table?: string
}): ReactElement {
  if (field.button) {
    return (
      <FieldButton
        field={field}
        config={field.button}
        record={record}
        {...(table === undefined ? {} : { table })}
      />
    )
  }
  if (isStructured(field)) {
    return (
      <>
        <StructuredValue
          renderAs={field.renderAs ?? 'json'}
          value={record[field.name]}
        />
        <EntryDescription field={field} />
      </>
    )
  }
  return (
    <>
      <ReadOnlyFieldValue
        field={field}
        value={withDisplayLabels(record)[field.name]}
      />
      <EntryDescription field={field} />
      <RefinementStatus
        record={record}
        field={field}
      />
    </>
  )
}
