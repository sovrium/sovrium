/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  ConditionOperatorsSchema,
  FieldConditionSchema,
} from '@/domain/models/shared/condition-operators'
import { ActionSchema } from '../../../action'
import { ConfirmGateSchema } from '../../../confirm-gate'
import { optStr } from '../../../shared-schemas'

// ---------------------------------------------------------------------------
// Column format
// ---------------------------------------------------------------------------

/**
 * Display format overrides for column rendering.
 *
 * Each format corresponds to a field type:
 * - Text: truncate
 * - Number: currency, percentage, compact (1.2K)
 * - Date: relative-date (PAST-only "2 days ago"), relative-time (signed,
 *   locale-aware "dans 5 j" / "il y a 5 j" — works for FUTURE dates),
 *   short-date, long-date, datetime
 * - Boolean: yes-no, check-cross
 *
 * `relative-time` is the bidirectional counterpart to `relative-date`: where
 * `relative-date` only ever renders past offsets in English, `relative-time`
 * renders a date relative to now in EITHER direction and in the page locale —
 * a future date as "dans N j" (fr) / "in N days" (en), a past date as
 * "il y a N j" / "N days ago". Use it for a forward-looking countdown column
 * (e.g. a grace-window "scheduled erasure" date that resolves to "dans 5 j").
 */
export const ColumnFormatSchema = Schema.Literal(
  'truncate',
  'currency',
  'percentage',
  'compact',
  'relative-date',
  'relative-time',
  'short-date',
  'long-date',
  'datetime',
  'yes-no',
  'check-cross'
).annotations({
  title: 'Column Format',
  description:
    'Display format override for column rendering. relative-date = past-only English; relative-time = signed, locale-aware (dans N j / il y a N j) and future-capable.',
})

// ---------------------------------------------------------------------------
// Cell style condition
// ---------------------------------------------------------------------------

/**
 * Conditional cell styling based on cell value.
 *
 * The operator vocabulary (`ConditionOperatorsSchema`) lives in
 * `@/domain/models/shared/condition-operators` — promoted out of this file
 * once a third consumer needed the same grammar (the `button` FIELD type's
 * `visibleWhen`), so a table field no longer has to import a page-component
 * module to describe itself.
 *
 * @example
 * ```yaml
 * cellStyle:
 *   - when: { eq: shipped }
 *     className: bg-green-50 text-green-700
 *   - when: { eq: cancelled }
 *     className: bg-red-50 text-red-400 line-through
 * ```
 */
export const CellStyleConditionSchema = Schema.Struct({
  /** Condition matcher: operator -> value (at least one operator required) */
  when: ConditionOperatorsSchema.annotations({
    description:
      'Condition matched against the cell value: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte.',
  }),
  /** Tailwind CSS classes to apply when condition matches */
  className: Schema.String.annotations({
    description: 'Tailwind CSS classes applied when the condition is met',
    examples: ['bg-green-50 text-green-700', 'bg-red-50 text-red-400 line-through'],
  }),
}).annotations({
  title: 'Cell Style Condition',
  description: 'Conditional styling rule for table cells',
})

// ---------------------------------------------------------------------------
// Action column item
// ---------------------------------------------------------------------------

/**
 * Per-row visibility predicate for an action column item.
 *
 * Unlike a field column, an action column has no field binding of its own, so
 * the predicate names the row `field` to test, then applies the shared
 * condition vocabulary to that field's value. When present, the action button
 * renders ONLY on rows whose `field` value satisfies the operator(s); when
 * `visibleWhen` is omitted, the action renders on every row.
 *
 * Identical in shape to a `button` field's `visibleWhen` — both are
 * `FieldConditionSchema` — because both answer the same question: does this
 * control belong on THIS record?
 *
 * @example
 * ```yaml
 * # "Renew" shows only on expiring/expired rows
 * visibleWhen: { field: status, in: [expiring, expired] }
 * # "Connect" shows only on disconnected oauth2 rows
 * visibleWhen: { field: status, eq: disconnected }
 * ```
 */
const actionVisibleWhenSchema = FieldConditionSchema

// ---------------------------------------------------------------------------
// Inline select-edit (an action item that opens a per-row single-select editor)
// ---------------------------------------------------------------------------

/**
 * One option in an inline select-edit dropdown.
 *
 * `value` is the value submitted on commit (and the value that overrides the
 * row's `$record.<field>` so a `fetch` body referencing it resolves to the
 * selection). `label` is the option's display text; it defaults to `value` when
 * omitted (so a raw-enum option list needs no labels, while a localized one can
 * read `{ value: editor, label: Éditeur }`).
 */
const EditSelectOptionSchema = Schema.Struct({
  /** The value submitted on commit (overrides `$record.<field>` at dispatch). */
  value: Schema.String.annotations({
    description: 'Option value submitted on commit (overrides $record.<field> in the action body)',
  }),
  /** Display label for the option (defaults to `value`). */
  label: optStr('Option display label (defaults to value)'),
}).annotations({
  title: 'Edit Select Option',
  description: 'A single { value, label? } option in an inline select-edit dropdown',
})

/**
 * Inline single-select editor configuration for an action-column item.
 *
 * When an action item carries `editSelect`, its trigger button (the item's
 * `label`, e.g. "Modifier le rôle") does NOT dispatch the action immediately —
 * instead it reveals an INLINE editor in the row: a `<select>` (accessible name
 * `label`) of `options`, preset to the clicked row's current `field` value, plus a
 * commit button (`saveLabel`, default "Enregistrer"). On commit the item's own
 * `action` is dispatched with the PICKED value overriding the row's `field`, so a
 * `fetch` body referencing `$record.<field>` resolves to the SELECTION (not the
 * row's stored value). Composing the action's `onSuccess.refetch` then refreshes
 * the grid (or a named sibling) so the cell reflects the new value.
 *
 * This is the generic, reusable config equivalent of the bespoke admin
 * "Modifier le rôle → Rôle select → Enregistrer → POST /api/auth/admin/set-role"
 * gesture: a per-row select-edit that POSTs an ARBITRARY endpoint (NOT the records
 * API the field-column `editable` flag PATCHes), works over a `dataSource.system`
 * grid, and reuses the shipped `$record.*` body substitution + `onSuccess.refetch`.
 * Unlike the field-column `editable` boolean (records-API inline cell edit, gated
 * OFF for a system source), `editSelect` lives on an action item and targets the
 * item's configured `action.url`.
 *
 * @example
 * ```yaml
 * - label: Modifier le rôle
 *   editSelect:
 *     field: role          # the row field edited; preselects + is overridden on commit
 *     label: Rôle          # accessible name of the inline <select>
 *     saveLabel: Enregistrer
 *     options:
 *       - { value: member }
 *       - { value: editor }
 *       - { value: admin }
 *   action:
 *     type: fetch
 *     url: /api/auth/admin/set-role
 *     method: POST
 *     body: { userId: '$record.id', role: '$record.role' }   # role = the picked value
 *     responseEnvelope: better-auth
 *     onSuccess: { type: toast, message: Rôle mis à jour, refetch: users-grid }
 * ```
 */
export const EditSelectSchema = Schema.Struct({
  /**
   * Row field the editor edits. Its current value preselects the dropdown, and
   * the picked value OVERRIDES this field in the dispatched action's `$record.*`
   * context (so an action body's `$record.<field>` resolves to the selection).
   */
  field: Schema.String.annotations({
    description:
      'Row field edited: its value preselects the dropdown and the picked value overrides $record.<field> at dispatch',
  }),
  /** Accessible name for the inline `<select>` (its `aria-label`). */
  label: Schema.String.annotations({
    description: 'Accessible name (aria-label) of the inline select control',
  }),
  /** The select options (at least one). */
  options: Schema.Array(EditSelectOptionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({ description: 'Select options ({ value, label? }); at least one required' })
  ),
  /** Commit button label (defaults to "Enregistrer"). */
  saveLabel: optStr('Commit button label (defaults to "Enregistrer")'),
}).annotations({
  title: 'Edit Select',
  description:
    'Inline single-select editor for an action item: the trigger reveals a per-row <select> whose picked value overrides $record.<field> in the item action (POSTing an arbitrary endpoint), then composes with the action onSuccess.refetch.',
})

/**
 * A single action button within an action column.
 *
 * @example
 * ```yaml
 * - label: Edit
 *   icon: pencil
 *   action:
 *     type: crud
 *     operation: update
 *     table: orders
 * ```
 */
export const ActionColumnItemSchema = Schema.Struct({
  /** Button label */
  label: Schema.String.annotations({ description: 'Action button label' }),
  /** Optional icon name */
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., pencil, trash)' })
  ),
  /** Action to execute (reuses ActionSchema) */
  action: ActionSchema,
  /**
   * Optional inline single-select editor. When set, the trigger button reveals a
   * per-row `<select>` (preset to `editSelect.field`) plus a commit button; on
   * commit the picked value overrides `$record.<field>` and `action` is dispatched
   * against its (arbitrary) `url`. Omit for the immediate-dispatch button behavior.
   */
  editSelect: Schema.optional(EditSelectSchema),
  /**
   * Optional confirmation gate. A bare STRING is the prompt (the alertdialog's
   * accessible name; supports the `{count}` placeholder for bulk). The OBJECT form
   * (`ConfirmGateSchema`) adds a separate title, dialog role, a type-to-confirm
   * input, and confirm/cancel label overrides.
   */
  confirm: Schema.optional(ConfirmGateSchema),
  /**
   * Optional per-row visibility predicate. When set, this action renders only on
   * rows whose `field` value satisfies the condition; when omitted, it renders on
   * every row (backward-compatible default).
   */
  visibleWhen: Schema.optional(actionVisibleWhenSchema),
}).annotations({
  title: 'Action Column Item',
  description: 'Single action button within an action column',
})

// ---------------------------------------------------------------------------
// Column definitions (discriminated by presence of `field` vs `type: actions`)
// ---------------------------------------------------------------------------

/**
 * Field column -- binds to a table field with presentation overrides.
 */
export const FieldColumnSchema = Schema.Struct({
  /** Table field name this column displays */
  field: Schema.String.annotations({
    description: 'Field name from the data source table',
  }),
  /** Override header text (default: field name) */
  label: optStr('Column header text override'),
  /** Pixel width */
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
  /** Minimum pixel width for resize */
  minWidth: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Minimum column width in pixels' })
    )
  ),
  /** Text alignment */
  align: Schema.optional(
    Schema.Literal('left', 'center', 'right').annotations({
      description: 'Column text alignment (default: left)',
    })
  ),
  /** Pin to left side */
  frozen: Schema.optional(
    Schema.Boolean.annotations({ description: 'Pin column to left side of table' })
  ),
  /** Allow sorting on this column */
  sortable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column sorting (default: true)' })
  ),
  /** Allow filtering on this column */
  filterable: Schema.optional(
    Schema.Boolean.annotations({ description: 'Allow column filtering (default: true)' })
  ),
  /** Allow inline editing */
  editable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Allow inline editing (default: from table permissions)',
    })
  ),
  /** Show/hide column */
  visible: Schema.optional(
    Schema.Boolean.annotations({ description: 'Column visibility (default: true)' })
  ),
  /** Display format override */
  format: Schema.optional(ColumnFormatSchema),
  /** Conditional cell styling rules */
  cellStyle: Schema.optional(
    Schema.Array(CellStyleConditionSchema).annotations({
      description: 'Conditional styling rules evaluated against the cell value',
    })
  ),
  /**
   * Display-label map for known raw cell values: raw value (key) -> friendly
   * label (value). Render-only — the underlying record value and the API / read
   * endpoint contract are unchanged; only the rendered cell text is substituted.
   * Raw values without an entry render verbatim (passthrough fallback). Use this
   * to localize/humanize enum values whose endpoints are `.strict()` and assert
   * the raw enum (so server-side relabeling is impossible).
   */
  valueLabels: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).annotations({
      title: 'Value Labels',
      description:
        'Map of raw cell value -> display label, applied at render time only (does not mutate the record value or the API contract). Unmapped values render verbatim.',
      examples: [{ active: 'Actif', oauth2: 'OAuth2' }],
    })
  ),
}).annotations({
  title: 'Field Column',
  description: 'Column bound to a table field with presentation config',
})

/**
 * Action column -- renders action buttons per row (no field binding).
 */
export const ActionColumnSchema = Schema.Struct({
  /** Discriminator: always 'actions' */
  type: Schema.Literal('actions').annotations({
    description: "Must be 'actions' for an action column",
  }),
  /** Column header (often empty string) */
  label: optStr('Column header text'),
  /** Pixel width */
  width: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Column width in pixels' })
    )
  ),
  /** Action buttons to render in each row */
  actions: Schema.Array(ActionColumnItemSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Action buttons rendered per row',
    })
  ),
}).annotations({
  title: 'Action Column',
  description: 'Column with action buttons (edit, delete, etc.)',
})

/**
 * Data table column -- either a field column or an action column.
 */
export const DataTableColumnSchema = Schema.Union(
  FieldColumnSchema,
  ActionColumnSchema
).annotations({
  identifier: 'DataTableColumn',
  title: 'Data Table Column',
  description: 'Column definition: field column (with field) or action column (with type: actions)',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ColumnFormat = Schema.Schema.Type<typeof ColumnFormatSchema>
export type CellStyleCondition = Schema.Schema.Type<typeof CellStyleConditionSchema>
export type EditSelect = Schema.Schema.Type<typeof EditSelectSchema>
export type ActionColumnItem = Schema.Schema.Type<typeof ActionColumnItemSchema>
export type FieldColumn = Schema.Schema.Type<typeof FieldColumnSchema>
export type ActionColumn = Schema.Schema.Type<typeof ActionColumnSchema>
export type DataTableColumn = Schema.Schema.Type<typeof DataTableColumnSchema>
