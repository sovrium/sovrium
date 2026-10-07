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

import { DrawerActions, type DrawerAction } from './record-drawer-actions'
import { RecordDrawerChildren } from './record-drawer-children'
import {
  StructuredFieldDisplay,
  FieldInput,
  ReadOnlyEntry,
  RefinementStatus,
  FieldButton,
  ReadOnlyDetail,
} from './record-drawer-entry'
import { isStructured } from './record-drawer-field'
import type { RecordDrawerField, Values, RawRecord } from './record-drawer-field'
import type { ReactElement, ReactNode } from 'react'

const NO_ACTIONS: ReadonlyArray<DrawerAction> = []

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
