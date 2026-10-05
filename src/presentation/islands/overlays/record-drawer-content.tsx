/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared record-drawer body content ([internal ref] CAP-1 + CAP-3).
 *
 * The drawer's inner body — error banner, per-field controls, the save
 * affordance, and the footer action slot — rendered as a Fragment so its
 * children stay DIRECT flex children of the surrounding panel. The dialog OR
 * region wrapper (in `record-drawer-island.tsx`) owns the title + close; this
 * module owns everything between them so both surfaces share ONE body.
 *
 *  - CAP-3 `recordFields[].renderAs`: a field with a non-`text` `renderAs`
 *    renders a READ-ONLY structured block (json / list / key-value / code)
 *    instead of an editable text input — so nested data renders readably rather
 *    than mangling to `[object Object]` under `String(value)`.
 *  - CAP-1 `actions`: a footer slot of button-shaped actions that fire against
 *    the drawer's LOADED record. Each REUSES the shared `executeFetchAction`
 *    runtime (`$record.*` resolved at click time) and, when a `confirm` prompt
 *    is set, the shared `InlineConfirmDialog` gate — it does NOT reinvent
 *    dispatch.
 *  - CAP-5 `children`: the author's composed content, placed between the
 *    record's own form and the footer action row. The fields are the record's
 *    facts and the footer is where the reader acts on them, so content ABOUT
 *    those facts belongs between the two; below the footer it would sit under
 *    the commit affordance. See `record-drawer-children.tsx`.
 */

import { withDisplayLabels } from '@/domain/models/app/pages/substitute-record-vars'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { AiRefinementMarker } from '../runtime/ai-refinement-marker'
import { readAiRefinementStatus } from '../runtime/ai-refinement-status'
import { RecordButton, type RecordButtonConfig } from '../runtime/record-button'
import { DrawerActions, type DrawerAction } from './record-drawer-actions'
import { RecordDrawerChildren } from './record-drawer-children'
import { ChoiceField } from './record-drawer-choice-input'
import { isChoiceField, isLinkField, type DrawerChoice } from './record-drawer-choices'
import { LinkField } from './record-drawer-link-input'
import { ReadOnlyValue } from './record-drawer-read-only-value'
import { StructuredValue } from './record-drawer-structured-value'
import { TypedField } from './record-drawer-typed-input'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { OptionChipPaint } from '@/presentation/design/option-chip-paint'
import type { ReactElement, ReactNode } from 'react'

/** A schema-derived field the drawer renders a control (or structured block) for. */
export interface RecordDrawerField {
  readonly name: string
  readonly type: string
  /**
   * The entry's display name, already resolved server-side (the per-entry
   * override, then the bound field's `label`). Absent means the drawer keeps its
   * raw-`name` fallback — deliberately RAW, never humanized.
   */
  readonly label?: string
  /** Guidance rendered beside the entry's value, already resolved server-side. */
  readonly description?: string
  /**
   * The bound column's declared currency display, when it has one — a
   * read-only entry prints its amount the way the grid cell does.
   */
  readonly currency?: CurrencyDisplayOptions
  /** Structured-display selector (CAP-3). Non-`text` renders a read-only block. */
  readonly renderAs?: 'text' | 'json' | 'list' | 'key-value' | 'code'
  /**
   * Button-field config, present only on `type: 'button'` fields. The drawer
   * holds the loaded record, so a button here gets the full behaviour: its
   * `visibleWhen` predicate and, for an automation button, a row to run on.
   */
  readonly button?: RecordButtonConfig
  /**
   * A `single-select` / `status` field's declared options, resolved by the SSR
   * host, so an editable drawer offers them as a choice the way the form does.
   */
  readonly options?: ReadonlyArray<DrawerChoice>
  /** A date / datetime column's `weekday`, printed before the date it reads. */
  readonly weekday?: 'short' | 'long'
  /** A datetime column's own `timeZone`, read before the operator zone. */
  readonly timeZone?: string
  /**
   * A `single-select` / `status` field's `value → paint` map, resolved by the
   * SSR host as the grid's pill paints it, so a read-only entry draws the
   * grid's badge. Only options declaring a colour are listed.
   */
  readonly paints?: Readonly<Record<string, OptionChipPaint>>
  /** An attachment column's upload bucket and constraints, for the editable file picker. */
  readonly bucket?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  /**
   * A single-valued `relationship`'s related table and `displayField`, resolved
   * by the SSR host, so an editable drawer offers the link as a picker of named
   * records the way the form does.
   */
  readonly relatedTable?: string
  readonly displayField?: string
  /**
   * The bound column must hold a value: Save refuses it blank, and an optional
   * link offers a Clear control.
   */
  readonly required?: boolean
  /** The words a blank required entry is refused with, in the page language. */
  readonly requiredMessage?: string
  /**
   * The reader's role may not write this field: drawn as its value without an
   * editable control, and never sent by Save.
   */
  readonly readOnly?: boolean
  /** An optional link's Clear control, caption and accessible name, in the page language. */
  readonly clearLabel?: string
  readonly clearName?: string
}

const NO_ACTIONS: ReadonlyArray<DrawerAction> = []

type Values = Record<string, string>
type RawRecord = Record<string, unknown>

/** Whether a field renders as a read-only structured block (CAP-3) vs an editable input. */
// eslint-disable-next-line react-refresh/only-export-components -- pure shared predicate co-located with the body it gates (the island filters editable fields with it); not a fast-refresh component module
export function isStructured(field: RecordDrawerField): boolean {
  return field.renderAs !== undefined && field.renderAs !== 'text'
}

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
function StructuredFieldDisplay({
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
function FieldInput({
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
function ReadOnlyEntry({
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

// ──────────────────────────────────────────────────────────────────────────────
// CAP-1 — footer action slot
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Shared drawer body
// ──────────────────────────────────────────────────────────────────────────────

export interface DrawerContentProps {
  readonly fields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  /** The drawer's LOADED record (raw) — feeds structured display + `$record.*`. */
  readonly record: RawRecord
  readonly canEdit: boolean
  /**
   * The record GET is still in flight, so the form is on screen but holds no
   * record yet. Its controls and its save affordance render — the drawer keeps
   * its shape rather than jumping when the response lands — but both are
   * DISABLED, because neither typing into nor saving a record the drawer has not
   * read has a correct outcome. See the `loading` note in the island.
   */
  readonly loading?: boolean
  readonly error?: string
  readonly actions?: ReadonlyArray<DrawerAction>
  /**
   * CAP-5: the author's composed-content slot, as markup the SSR host rendered.
   * Absent unless children were declared — see `RecordDrawerChildren`.
   */
  readonly childrenHtml?: string
  /**
   * CAP-8: the related sections, already built by the island (they read their
   * own rows). Placed after the record's fields and the composed children, and
   * before the footer `actions`, which stay anchored at the bottom.
   */
  readonly related?: ReactElement
  readonly onChange: (name: string, value: string) => void
  readonly onSave: () => void
  /** Close this drawer — a footer `openDrawer` steps aside for the drawer it opens. */
  readonly onClose: () => void
  /**
   * The bound table's name. Lets an automation button field address its invoke
   * endpoint; absent for a system-backed drawer, which has no record route.
   */
  readonly table?: string
  /**
   * The save affordance's label. Resolved from the interpreter string catalog
   * against the app's language by the SSR host (where author
   * `languages.translations` overrides are visible), never a literal here.
   */
  readonly saveLabel: string
}

/** The AI refinement status beside a value that has one ([internal ref] Phase 2). */
function RefinementStatus({
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
function FieldButton({
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
function ReadOnlyDetail({
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

/**
 * One entry of an editable drawer: an action, a structured `renderAs` block, or
 * the field's control followed by its AI refinement status.
 */
function EditableField({
  field,
  values,
  record,
  loading,
  onChange,
  table,
}: {
  readonly field: RecordDrawerField
  readonly values: Values
  readonly record: RawRecord
  readonly loading: boolean
  readonly onChange: (name: string, value: string) => void
  readonly table?: string
}): ReactElement {
  // A button field is an action, never an input — it precedes both branches
  // below, which would otherwise offer an editor for a field with no value.
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
      <StructuredFieldDisplay
        field={field}
        value={record[field.name]}
      />
    )
  }
  return (
    <>
      <FieldInput
        field={field}
        value={values[field.name] ?? ''}
        disabled={loading || field.readOnly === true}
        onChange={onChange}
      />
      <RefinementStatus
        record={record}
        field={field}
      />
    </>
  )
}

/**
 * Render ONE schema-derived field. A read-only drawer lists it as a term and
 * its detail; an editable one draws an action, a structured `renderAs` block,
 * or the field's control followed by its AI refinement status.
 */
function DrawerField({
  field,
  values,
  record,
  canEdit,
  loading,
  onChange,
  table,
}: {
  readonly field: RecordDrawerField
  readonly values: Values
  readonly record: RawRecord
  readonly canEdit: boolean
  readonly loading: boolean
  readonly onChange: (name: string, value: string) => void
  readonly table?: string
}): ReactElement {
  if (!canEdit) {
    return (
      <ReadOnlyEntry field={field}>
        <ReadOnlyDetail
          field={field}
          record={record}
          {...(table === undefined ? {} : { table })}
        />
      </ReadOnlyEntry>
    )
  }
  return (
    <EditableField
      field={field}
      values={values}
      record={record}
      loading={loading}
      onChange={onChange}
      {...(table === undefined ? {} : { table })}
    />
  )
}

/**
 * The fields' container. A read-only drawer lists its fields as ONE
 * description list — each heading a term, each value its detail; an editable
 * drawer's controls stay direct children of the panel.
 */
function DrawerFieldList({
  canEdit,
  children,
}: {
  readonly canEdit: boolean
  readonly children: ReactNode
}): ReactNode {
  if (canEdit) return children
  return (
    <dl
      data-component-type="description-list"
      className="flex flex-col gap-4"
    >
      {children}
    </dl>
  )
}

/** The inline validation banner, or nothing when there is no error. */
function DrawerError({ error }: { readonly error: string | undefined }): ReactElement | undefined {
  if (!error) return undefined
  return (
    <p
      role="alert"
      aria-label="Validation error"
      className="text-error-fg bg-error-bg border-error-border text-md rounded border p-2"
    >
      {error}
    </p>
  )
}

/** The save affordance: inert, like the fields, until the record has loaded. */
function DrawerSaveButton({
  label,
  loading,
  onSave,
}: {
  readonly label: string
  readonly loading: boolean
  readonly onSave: () => void
}): ReactElement {
  return (
    <button
      type="button"
      data-component-type="button"
      onClick={onSave}
      disabled={loading}
      className="bg-primary text-primary-fg text-md mt-2 self-start rounded px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

/**
 * The drawer's inner body — rendered as a Fragment so its children stay DIRECT
 * flex children of the surrounding panel (the dialog OR region wrapper owns the
 * title + close). A field with a structured `renderAs` renders a read-only
 * block (never an input); the rest render an editable control.
 */
export function DrawerContent({
  fields,
  values,
  record,
  canEdit,
  loading = false,
  error,
  actions = NO_ACTIONS,
  childrenHtml,
  related,
  onChange,
  onSave,
  onClose,
  table,
  saveLabel,
}: DrawerContentProps): ReactElement {
  return (
    <>
      <DrawerError error={error} />
      <DrawerFieldList canEdit={canEdit}>
        {fields.map((field) => (
          <DrawerField
            key={field.name}
            field={field}
            values={values}
            record={record}
            canEdit={canEdit}
            loading={loading}
            onChange={onChange}
            {...(table === undefined ? {} : { table })}
          />
        ))}
      </DrawerFieldList>
      {canEdit && (
        <DrawerSaveButton
          label={saveLabel}
          loading={loading}
          onSave={onSave}
        />
      )}
      {childrenHtml !== undefined && (
        <RecordDrawerChildren
          html={childrenHtml}
          record={record}
        />
      )}
      {related}
      <DrawerActions
        actions={actions}
        record={record}
        loading={loading}
        onLeave={onClose}
      />
    </>
  )
}
