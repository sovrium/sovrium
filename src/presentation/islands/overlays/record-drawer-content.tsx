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

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional confirm-gate + per-field/per-action event handlers (the footer-action confirm/cancel close over the armed action; a field's onChange closes over its name). These are transient surfaces rendered only while the drawer is open, not a hot path. Mirrors the same exemption in action-cell.tsx + inline-confirm-dialog.tsx. */

import { useCallback, useState, type ReactElement } from 'react'
import { fieldDescribedBy, fieldDescriptionId } from '@/presentation/design/field-display'
import { executeFetchAction } from '../runtime/action-executor'
import { AiRefinementMarker } from '../runtime/ai-refinement-marker'
import { readAiRefinementStatus } from '../runtime/ai-refinement-status'
import { InlineConfirmDialog, ObjectConfirmDialog } from '../runtime/inline-confirm-dialog'
import { RecordButton, type RecordButtonConfig } from '../runtime/record-button'
import { RecordDrawerChildren } from './record-drawer-children'
import type { Action, FetchAction } from '@/domain/models/app/pages/components/action'
import type { ConfirmObject } from '@/domain/models/app/pages/components/confirm-gate'

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
  /** Structured-display selector (CAP-3). Non-`text` renders a read-only block. */
  readonly renderAs?: 'text' | 'json' | 'list' | 'key-value' | 'code'
  /**
   * Button-field config, present only on `type: 'button'` fields. The drawer
   * holds the loaded record, so a button here gets the full behaviour: its
   * `visibleWhen` predicate and, for an automation button, a row to run on.
   */
  readonly button?: RecordButtonConfig
}

/** A footer action button the drawer renders below the record body (CAP-1). */
export interface DrawerAction {
  readonly label: string
  readonly action: Action
  readonly variant?: string
  /** Confirm gate before firing — the legacy STRING prompt or the rich OBJECT form. */
  readonly confirm?: string | ConfirmObject
}

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

/** Parse a JSON string into its structured value; leave non-JSON / non-string untouched. */
function coerceStructured(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** Render a leaf readably; serialize a nested object/array instead of `[object Object]`. */
function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** One labelled `name: value` line inside a list item or a key-value block. */
function PairLine({
  name,
  value,
}: {
  readonly name: string
  readonly value: unknown
}): ReactElement {
  return (
    <span className="text-foreground text-sm">
      <span className="text-foreground-muted">{name}</span>
      {`: ${formatScalar(value)}`}
    </span>
  )
}

/** Labelled key/value lines of one object (a list item or a key-value object). */
function renderObjectPairs(value: unknown): ReactElement[] {
  if (typeof value !== 'object' || value === null) {
    return [
      <span
        key="_scalar"
        className="text-foreground text-sm"
      >
        {formatScalar(value)}
      </span>,
    ]
  }
  return Object.entries(value as RawRecord).map(([key, val]) => (
    <PairLine
      key={key}
      name={key}
      value={val}
    />
  ))
}

const PRE_CLASS = 'text-foreground overflow-auto text-sm'

/** Array-of-objects → a readable `<ul>` list, one labelled item per element. */
function StructuredList({ data }: { readonly data: unknown }): ReactElement {
  if (!Array.isArray(data)) {
    return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((item, index) => (
        <li
          key={index}
          className="border-border flex flex-col gap-1 rounded border p-2"
        >
          {renderObjectPairs(item)}
        </li>
      ))}
    </ul>
  )
}

/** Render a (coerced) field value via its `renderAs` selector. */
function StructuredValue({
  renderAs,
  data,
}: {
  readonly renderAs: string
  readonly data: unknown
}): ReactElement {
  if (renderAs === 'list') return <StructuredList data={data} />
  if (renderAs === 'key-value') {
    return <div className="flex flex-col gap-1">{renderObjectPairs(data)}</div>
  }
  if (renderAs === 'code') {
    return (
      <pre className={PRE_CLASS}>
        {typeof data === 'string' ? data : JSON.stringify(data, undefined, 2)}
      </pre>
    )
  }
  // `json` (and any future structured default): pretty-print as indented JSON.
  return <pre className={PRE_CLASS}>{JSON.stringify(data, undefined, 2)}</pre>
}

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
        data={coerceStructured(value)}
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
  return (
    <label className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{entryLabel(field)}</span>
      <input
        type="text"
        aria-label={entryLabel(field)}
        name={field.name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="border-border rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60"
        {...fieldDescribedBy(field)}
      />
      <EntryDescription field={field} />
    </label>
  )
}

/** Coerce a record value to its read-only display string (matches the legacy system body). */
function toReadOnlyText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * A read-only labelled value (a plain non-structured field on a READ-ONLY drawer
 * — a system-detail binding, or a `canEdit: false` drawer). Renders a
 * `data-field`-tagged value span rather than a (disabled) text input, so a
 * system-detail drawer's plain fields read as text (queryable / maskable) exactly
 * as they did under the retired `SystemRecordDrawerBody`.
 */
function ReadOnlyField({
  field,
  value,
}: {
  readonly field: RecordDrawerField
  readonly value: unknown
}): ReactElement {
  return (
    <div className="text-md flex flex-col gap-1">
      <span className="text-foreground-muted">{entryLabel(field)}</span>
      <span
        data-field={field.name}
        className="text-foreground"
      >
        {toReadOnlyText(value)}
      </span>
      <EntryDescription field={field} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// CAP-1 — footer action slot
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a drawer footer action against the loaded record. Reuses the shared
 * `executeFetchAction` runtime — `$record.<field>` in the action's `url` / `body`
 * resolves against `record` at CLICK time (the drawer loads its record lazily).
 */
function dispatchDrawerAction(action: Action, record: RawRecord): void {
  if ('type' in action && action.type === 'fetch') {
    void executeFetchAction(action as FetchAction, { record })
  }
}

const ACTION_BUTTON_CLASS =
  'border-border text-foreground hover:bg-background-subtle rounded border px-3 py-1.5 text-md transition-colors'

/**
 * A single footer action button. A `confirm`-bearing action arms the shared
 * inline `alertdialog` gate on the first click (its confirm affordance re-uses
 * this action's label); otherwise the action fires immediately.
 */
function DrawerActionButton({
  item,
  record,
}: {
  readonly item: DrawerAction
  readonly record: RawRecord
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  const fire = useCallback(() => dispatchDrawerAction(item.action, record), [item.action, record])

  if (item.confirm && confirming) {
    // The OBJECT form renders the shared `ObjectConfirmDialog` (separate title /
    // dialog role / type-to-confirm input / label overrides); the legacy STRING
    // form keeps the byte-identical inline gate.
    if (typeof item.confirm !== 'string') {
      return (
        <ObjectConfirmDialog
          config={item.confirm}
          record={record}
          fallbackConfirmLabel={item.label}
          onConfirm={fire}
          onCancel={() => setConfirming(false)}
        />
      )
    }
    return (
      <InlineConfirmDialog
        prompt={item.confirm}
        confirmLabel={item.label}
        onConfirm={fire}
        onCancel={() => setConfirming(false)}
      />
    )
  }

  return (
    <button
      type="button"
      className={ACTION_BUTTON_CLASS}
      onClick={() => (item.confirm ? setConfirming(true) : fire())}
    >
      {item.label}
    </button>
  )
}

const NO_ACTIONS: ReadonlyArray<DrawerAction> = []

/** The footer action row rendered below the record body (nothing when empty). */
function DrawerActions({
  actions,
  record,
}: {
  readonly actions: ReadonlyArray<DrawerAction>
  readonly record: RawRecord
}): ReactElement | null {
  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  if (actions.length === 0) return null
  return (
    <div className="border-border mt-2 flex flex-wrap gap-2 border-t pt-4">
      {actions.map((item, index) => (
        <DrawerActionButton
          key={`${item.label}-${index}`}
          item={item}
          record={record}
        />
      ))}
    </div>
  )
}

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
  readonly onChange: (name: string, value: string) => void
  readonly onSave: () => void
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

/**
 * The field's value control: an editable input, or a read-only value span for a
 * system-backed / `canEdit: false` drawer.
 */
function DrawerFieldControl({
  field,
  values,
  record,
  canEdit,
  loading,
  onChange,
}: {
  readonly field: RecordDrawerField
  readonly values: Values
  readonly record: RawRecord
  readonly canEdit: boolean
  readonly loading: boolean
  readonly onChange: (name: string, value: string) => void
}): ReactElement {
  return canEdit ? (
    <FieldInput
      field={field}
      value={values[field.name] ?? ''}
      disabled={loading}
      onChange={onChange}
    />
  ) : (
    <ReadOnlyField
      field={field}
      value={record[field.name]}
    />
  )
}

/**
 * Render ONE schema-derived field: a structured `renderAs` block, then the value
 * control, then the AI refinement status where the value has one.
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
  // A button field is an action, never an input — it precedes both branches
  // below, which would otherwise offer an editor for a field with no value.
  if (field.button) {
    return (
      <RecordButton
        config={field.button}
        fieldName={field.name}
        record={record}
        {...(table === undefined ? {} : { table })}
        {...(record['id'] === undefined ? {} : { recordId: String(record['id']) })}
      />
    ) as ReactElement
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
      <DrawerFieldControl
        field={field}
        values={values}
        record={record}
        canEdit={canEdit}
        loading={loading}
        onChange={onChange}
      />
      {/* [internal ref] Phase 2: an AI-computed value whose refinement failed reads
          exactly like a refined one. The status rides in on the very response
          this drawer already parsed to fill the control above, so nothing new
          is fetched to say so — and the drawer has room to say it in full. */}
      <AiRefinementMarker
        status={readAiRefinementStatus(record, field.name)}
        placement="inline"
      />
    </>
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
  onChange,
  onSave,
  table,
  saveLabel,
}: DrawerContentProps): ReactElement {
  return (
    <>
      {error && (
        <p
          role="alert"
          aria-label="Validation error"
          className="text-error-fg bg-error-bg border-error-border text-md rounded border p-2"
        >
          {error}
        </p>
      )}
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
      {canEdit && (
        <button
          type="button"
          onClick={onSave}
          disabled={loading}
          className="bg-primary text-primary-fg text-md mt-2 self-start rounded px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveLabel}
        </button>
      )}
      {childrenHtml !== undefined && (
        <RecordDrawerChildren
          html={childrenHtml}
          record={record}
        />
      )}
      <DrawerActions
        actions={actions}
        record={record}
      />
    </>
  )
}
