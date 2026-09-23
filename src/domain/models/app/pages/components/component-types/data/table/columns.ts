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
} from '@/domain/models/app/tables/condition-operators'
import { ActionSchema } from '../../../action'
import { ConfirmGateSchema } from '../../../confirm-gate'
import { optStr } from '../../../shared-schemas'
import { CallerCapabilitySchema } from '../../../visibility'
import { SelectOptionSourceBindingSchema } from '../../form-controls/select-option-source'

// ---------------------------------------------------------------------------
// Column format
// ---------------------------------------------------------------------------

/**
 * Display format overrides for column rendering.
 *
 * Each format corresponds to a field type:
 * - Text: truncate
 * - Number: currency, percentage, compact (1.2K), bytes (11 KB)
 * - Date: relative-date (PAST-only "2 days ago"), relative-time (signed,
 *   locale-aware "dans 5 j" / "il y a 5 j" — works for FUTURE dates),
 *   short-date, long-date, datetime
 * - Boolean: yes-no, check-cross
 *
 * `bytes` is BINARY (1024-based, `B/KB/MB/GB`) and is not interchangeable with
 * `compact`, which is SI decimal (`11.5K`) — a file size printed in the wrong
 * base beside the real file is worse than no figure. It renders through the
 * same `formatByteCount` a KPI tile's `kpiFormat: { type: 'bytes' }` spends
 * (`@/domain/models/app/tables/cell-value-format`), so one number cannot print two ways on
 * two surfaces of the same page. Available on a data-table column AND on a
 * `record-field`, so a size shows in a row template as well as in a grid.
 *
 * `relative-time` is the bidirectional counterpart to `relative-date`: where
 * `relative-date` only ever renders past offsets in English, `relative-time`
 * renders a date relative to now in EITHER direction and in the page locale —
 * a future date as "dans N j" (fr) / "in N days" (en), a past date as
 * "il y a N j" / "N days ago". Use it for a forward-looking countdown column
 * (e.g. a grace-window "scheduled erasure" date that resolves to "dans 5 j").
 */
export const ColumnFormatSchema = Schema.Literals([
  'truncate',
  'currency',
  'percentage',
  'compact',
  'bytes',
  'relative-date',
  'relative-time',
  'short-date',
  'long-date',
  'datetime',
  'yes-no',
  'check-cross',
]).annotate({
  title: 'Column Format',
  description:
    'Display format override for a rendered value (a table column or a record-field). bytes = binary B/KB/MB/GB, NOT the SI compact 11.5K; relative-date = past-only English; relative-time = signed, locale-aware (dans N j / il y a N j) and future-capable.',
})

// ---------------------------------------------------------------------------
// Cell style condition
// ---------------------------------------------------------------------------

/**
 * Conditional cell styling based on cell value.
 *
 * The operator vocabulary (`ConditionOperatorsSchema`) lives in
 * `@/domain/models/app/tables/condition-operators` — promoted out of this file
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
  when: ConditionOperatorsSchema.annotate({
    description:
      'Condition matched against the cell value: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte.',
  }),
  /** Tailwind CSS classes to apply when condition matches */
  className: Schema.String.annotate({
    description: 'Tailwind CSS classes applied when the condition is met',
    examples: ['bg-green-50 text-green-700', 'bg-red-50 text-red-400 line-through'],
  }),
}).annotate({
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
  value: Schema.String.annotate({
    description: 'Option value submitted on commit (overrides $record.<field> in the action body)',
  }),
  /** Display label for the option (defaults to `value`). */
  label: optStr('Option display label (defaults to value)'),
}).annotate({
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
  field: Schema.String.annotate({
    description:
      'Row field edited: its value preselects the dropdown and the picked value overrides $record.<field> at dispatch',
  }),
  /** Accessible name for the inline `<select>` (its `aria-label`). */
  label: Schema.String.annotate({
    description: 'Accessible name (aria-label) of the inline select control',
  }),
  /**
   * The select options, spelled out.
   *
   * Optional since the arrival of `optionsSource`, and exactly one of the two
   * must be declared — enforced by `collectPageBindingViolations`, because a
   * `Schema.check` on this struct would wrap the node and re-key the published
   * property universe (the reason that file records for every rule it holds).
   * Declaring neither is a dropdown with nothing in it; declaring both leaves
   * no defensible precedence between two answers to the same question.
   */
  options: Schema.optional(
    Schema.Array(EditSelectOptionSchema).pipe(
      Schema.annotate({ description: 'Select options ({ value, label? }); at least one required' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Resolve the options from a table or a system read endpoint instead of
   * spelling them out.
   *
   * This is what a ROLE picker needs. The roles a caller may assign are
   * `assignableRoleNames(app)` — the built-ins, the admin tier names, and every
   * name the operator declared in `app.auth.roles[]`. A literal list cannot
   * reach them, and narrowing the picker to the built-ins was measured on a
   * partner-shaped app to share ZERO members with the roles that app declares.
   *
   * Resolved server-side by the same pass that resolves a `select`'s, and
   * REPLACED with a concrete `options` array — so the endpoint never reaches the
   * grid island's serialised props.
   */
  optionsSource: Schema.optional(SelectOptionSourceBindingSchema),
  /** Commit button label (defaults to "Enregistrer"). */
  saveLabel: optStr('Commit button label (defaults to "Enregistrer")'),
}).annotate({
  title: 'Edit Select',
  description:
    'Inline single-select editor for an action item: the trigger reveals a per-row <select> whose picked value overrides $record.<field> in the item action (POSTing an arbitrary endpoint), then composes with the action onSuccess.refetch.',
})

/**
 * Visual weight of ONE row action, in the platform button recipe's own words.
 *
 * ─── A SUBSET, NOT A SECOND VOCABULARY ─────────────────────────────────────
 *
 * Every member is spelled exactly as `ButtonVariantSchema`
 * (`pages/components/shared-schemas.ts`) spells it, and resolves through the
 * same `VARIANT_CLASS` recipe, so a row action and a standalone `button` asking
 * for `destructive` cannot drift apart. What is NARROWED is the member list:
 * `outline`, `link` and `fab` are refused because none of them has a drawing in
 * a 24px table row — `fab` is defined by floating over the page, `link`
 * collapses its padding to inline text, and `outline` reads as `secondary` at
 * this size. Admitting a member and removing it later is a breaking change;
 * widening the list when a drawing needs it is not.
 *
 * ─── WHY THIS KEY EXISTS AT ALL, GIVEN THE RECIPE'S REFUSAL ────────────────
 *
 * `computeTableActionButtonClasses` states the platform DEFAULT and it still
 * stands: a trigger is not destructive, because it opens a question and a row of
 * red buttons down the side of a table makes the question look answered. That is
 * why omission keeps painting `secondary` and why nothing about an existing grid
 * changes. The key is the OPT-OUT for the surfaces that genuinely end in a row
 * that is gone — the console's account directory draws Ban and Delete, and its
 * record grid draws Move to trash, in the danger pairing — where the weight is
 * carried by the action's consequence rather than by the grid's rhythm.
 *
 * Author-opt-in, never inferred. A `confirm` gate does NOT imply `destructive`:
 * an inline select commit is gated too, and reading intent off an unrelated key
 * is how one author's gate becomes another author's red button.
 */
export const RowActionVariantSchema = Schema.Literals([
  'default',
  'secondary',
  'ghost',
  'destructive',
]).annotate({
  title: 'Row Action Variant',
  description:
    "Visual weight of a row action, from the platform button vocabulary: 'default' (primary fill), 'secondary' (the unchanged default), 'ghost' (quiet), 'destructive' (danger). Omit for today's style.",
})

/** @public */
export type RowActionVariant = Schema.Schema.Type<typeof RowActionVariantSchema>

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
  label: Schema.String.annotate({ description: 'Action button label' }),
  /** Optional icon name */
  icon: Schema.optional(Schema.String.annotate({ description: 'Icon name (e.g., pencil, trash)' })),
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
  /**
   * Optional visual weight. Omit and the button paints exactly as it does today
   * (the `secondary` recipe at `sm`, shrunk to 24px on 11px type) — so this key
   * is inert on every grid that does not name it. See
   * {@link RowActionVariantSchema} for why the member list is narrower than
   * `ButtonVariantSchema` and why the recipe's own refusal still holds.
   */
  variant: Schema.optional(RowActionVariantSchema),
}).annotate({
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
  field: Schema.String.annotate({
    description: 'Field name from the data source table',
  }),
  /** Override header text (default: field name) */
  label: optStr(
    'Text in the column header. Defaults to the field name on a field column, and is often left empty on an action column.'
  ),
  /** Pixel width */
  width: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Column width in pixels' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Minimum pixel width for resize */
  minWidth: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Minimum column width in pixels' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Text alignment */
  align: Schema.optional(
    Schema.Literals(['left', 'center', 'right']).annotate({
      description: 'Column text alignment (default: left)',
    })
  ),
  /** Pin to left side */
  frozen: Schema.optional(
    Schema.Boolean.annotate({ description: 'Pin column to left side of table' })
  ),
  /** Allow sorting on this column */
  sortable: Schema.optional(
    Schema.Boolean.annotate({ description: 'Allow column sorting (default: true)' })
  ),
  /** Allow filtering on this column */
  filterable: Schema.optional(
    Schema.Boolean.annotate({ description: 'Allow column filtering (default: true)' })
  ),
  /** Allow inline editing */
  editable: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Allow inline editing (default: from table permissions)',
    })
  ),
  /** Show/hide column */
  visible: Schema.optional(
    Schema.Boolean.annotate({ description: 'Column visibility (default: true)' })
  ),
  /** Display format override */
  format: Schema.optional(ColumnFormatSchema),
  /** Conditional cell styling rules */
  cellStyle: Schema.optional(
    Schema.Array(CellStyleConditionSchema).annotate({
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
    Schema.Record(Schema.String, Schema.String).annotate({
      title: 'Value Labels',
      description:
        'Map of raw cell value -> display label, applied at render time only (does not mutate the record value or the API contract). Unmapped values render verbatim.',
      examples: [{ active: 'Actif', oauth2: 'OAuth2' }],
    })
  ),
}).annotate({
  title: 'Field Column',
  description: 'Column bound to a table field with presentation config',
})

/**
 * Action column -- renders action buttons per row (no field binding).
 */
export const ActionColumnSchema = Schema.Struct({
  /** Discriminator: always 'actions' */
  type: Schema.Literal('actions').annotate({
    description: "Must be 'actions' for an action column",
  }),
  /** Column header (often empty string) */
  label: optStr(
    'Text in the column header. Defaults to the field name on a field column, and is often left empty on an action column.'
  ),
  /**
   * Power the requesting session must hold for this whole column to exist.
   *
   * ─── WHY THE COMPONENT-LEVEL GATE DOES NOT REACH HERE ──────────────────────
   *
   * `visibility.capability` gates a COMPONENT, and the affordance a members
   * directory has to withhold is one COLUMN of one grid. Neither non-answer
   * works. Two grids, one gated and one not, needs a NEGATED capability that
   * does not exist, so an account admin would receive both. A server-computed
   * per-row flag plus `visibleWhen` is client-side row filtering, so every
   * action's URL is still serialised into `data-island-props` — the exact
   * disclosure the component gate's own docstring forbids (S1/S4).
   *
   * ─── WHY THE COLUMN AND NOT THE ITEM ───────────────────────────────────────
   *
   * Gating the three items individually leaves a labelled "Actions" header over
   * three empty cells: the column announces a power the caller does not have,
   * which is the greyed-out-button failure in another spelling. The column is
   * the unit that can be honestly absent. An item-level gate is a two-line
   * addition the day a MIXED column exists; none does, and a key with no call
   * site is the inert-config class this schema refuses.
   *
   * ─── WHY ONLY AN ACTION COLUMN ─────────────────────────────────────────────
   *
   * Deliberately absent from {@link FieldColumnSchema}. A field column renders
   * data the grid already fetched over the wire, so hiding the column hides
   * nothing — it would be security theatre with a security-sounding name. An
   * action column is the opposite: its URLs, methods and bodies exist ONLY in
   * the config, so withholding the column genuinely withholds them. Field-level
   * confidentiality is `tables[].fields[].permissions`, enforced at the API.
   *
   * ─── EXCLUSION, NOT DISABLING (S1) ─────────────────────────────────────────
   *
   * An unmet capability removes the column from the resolved config BEFORE the
   * grid's props are serialised, so no endpoint reaches the client bundle. The
   * same strategy `visibility.capability` uses, for the same reason.
   *
   * @example
   * ```yaml
   * columns:
   *   - field: email
   *     label: Email
   *   - type: actions
   *     label: Actions
   *     capability: administer-accounts   # absent for everyone else
   *     actions:
   *       - label: Ban
   *         action: { type: fetch, url: /api/auth/admin/ban-user, method: POST }
   * ```
   */
  capability: Schema.optional(CallerCapabilitySchema),
  /** Pixel width */
  width: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Column width in pixels' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Action buttons to render in each row */
  actions: Schema.Array(ActionColumnItemSchema).pipe(
    Schema.annotate({
      description: 'Action buttons rendered per row',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({
  title: 'Action Column',
  description: 'Column with action buttons (edit, delete, etc.)',
})

/**
 * Data table column -- either a field column or an action column.
 */
export const DataTableColumnSchema = Schema.Union([FieldColumnSchema, ActionColumnSchema]).annotate(
  {
    identifier: 'DataTableColumn',
    title: 'Data Table Column',
    description:
      'Column definition: field column (with field) or action column (with type: actions)',
  }
)

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
