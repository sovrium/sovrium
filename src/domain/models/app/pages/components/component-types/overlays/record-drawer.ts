/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-binding shapes a `drawer` uses, and the `table` row-expand
 * that reuses them.
 *
 * ─── WHY THIS FILE EXISTS WITHOUT A `record-drawer` TYPE ───────────────────
 *
 * A drawer bound to one record is a `drawer` with a `dataSource`, not a type of
 * its own. These SHAPES are shared — `table`'s `row-expand` renders the same
 * field list through the same schema, and `resolve-record-drawer-fields.ts`
 * derives it for both.
 *
 * The names keep the `RecordDrawer` prefix on purpose: "the fields a record
 * drawer shows" is exactly what they describe — the drawer is spelled `drawer`
 * with a binding.
 */

import { Schema } from 'effect'
import { FieldConditionSchema } from '@/domain/models/app/tables/condition-operators'
import { PageCapabilitySchema } from '../../../requires'
import { actionWithoutFill, NavigateActionSchema, OpenDrawerActionSchema } from '../../action'
import { ConfirmGateSchema } from '../../confirm-gate'
import { DataSortSchema } from '../../data-source'
import { ButtonVariantSchema, ValueLabelsSchema } from '../../shared-schemas'

/**
 * Per-field structured-display selector.
 *
 * Controls how a `recordFields` entry RENDERS its (possibly nested) value in the
 * drawer's read-only display. The flat default coerces every value through
 * `String(value)`, which mangles an object/array to `[object Object]`. Opting a
 * field into a structured renderer makes nested data readable:
 *
 *  - `text` (default): the historical `String(value)` rendering — UNCHANGED.
 *  - `json`: pretty-print the value as indented JSON inside a `<pre>` (the
 *    generic catch-all for any nested object/array — e.g. a run's `steps[]`).
 *  - `list`: render an array-of-objects as a readable list, one item per
 *    element, each item exposing its own labelled key/value pairs (e.g. a run's
 *    step list, each step showing input / output / error).
 *  - `key-value`: render a single nested object as a definition list of its
 *    labelled key/value pairs.
 *  - `code`: render a raw string value in a monospace `<pre>` code block (no
 *    JSON re-serialization) — for a value that is already a code/log blob.
 *
 * Additive/backward-compatible: omitting `renderAs` (or setting `text`) keeps
 * the exact current scalar rendering for every existing record-drawer field.
 */
export const RecordDrawerFieldRenderAsSchema = Schema.Literals([
  'text',
  'json',
  'list',
  'key-value',
  'code',
]).annotate({
  title: 'Record Sheet Field Render As',
  description:
    'How a record-sheet field renders its value: text (default, String(value)), json (pretty <pre>), list (array-of-objects as a labelled list), key-value (nested object as a definition list), code (raw string in a monospace block).',
})

/** A single schema-derived form field the drawer renders a control for. */
export const RecordDrawerFieldSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'Field of the record this entry shows.',
  }),
  type: Schema.String.annotate({
    description:
      'Field type of this entry, naming the control the sheet renders for it. Left open rather than enumerated so a sheet bound to a system endpoint, which has no table schema to resolve a type from, can state one itself.',
  }),
  /**
   * Display-name override for this panel entry, winning over the bound field's
   * own `label` (and over the raw `name` fallback).
   *
   * Needed for exactly one reason: a drawer can bind to `dataSource.system` — a
   * system DETAIL endpoint with NO table behind it — and there is then no field
   * schema to resolve a `label` from. The override is the only way to name such
   * an entry. This is the same reason `FieldColumnSchema.label` ("Override
   * header text (default: field name)") already exists on the data-table
   * column, so it is an established pattern here, not a new one.
   *
   * On a table-bound drawer it stays a plain per-surface override: omit it and
   * the entry resolves the bound field's `label`, then the raw `name`.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Display-name override for this sheet entry (wins over the bound field's label, then the raw name). Required to name an entry on a system-bound sheet, which has no table field schema to resolve from.",
        examples: ['Prix unitaire', 'Statut'],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'label must not be empty' }))
    )
  ),
  /**
   * Guidance text override rendered beside this entry's value, winning over the
   * bound field's own `description`. Exists for the same system-source reason as
   * `label` above: a `dataSource.system` drawer has no field schema to resolve
   * guidance from.
   */
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Guidance-text override rendered beside this sheet entry's value (wins over the bound field's description). Required to describe an entry on a system-bound sheet.",
        examples: ['Hors taxes, en euros.'],
      }),
      Schema.check(Schema.isNonEmpty({ message: 'description must not be empty' }))
    )
  ),
  /**
   * Structured-display selector (CAP-3). Selects how a (possibly nested) value
   * renders in the drawer's read-only display. Omitting it (or `text`) keeps the
   * historical scalar `String(value)` rendering — backward-compatible. A field
   * with a non-`text` `renderAs` is rendered as a READ-ONLY structured block (a
   * nested object/array has no meaningful single text input), regardless of the
   * drawer's `canEdit`.
   */
  renderAs: Schema.optional(RecordDrawerFieldRenderAsSchema),
  /**
   * The words a read-only entry prints for a stored value — the grid column's
   * `valueLabels`, same name and same shape (`ValueLabelsSchema` by reference),
   * so the sheet opened on a row says what the row's cell says.
   *
   * A value the map leaves out prints as stored. On an option field the label
   * is drawn in the option's chip and keeps its colour, and an unmapped value
   * keeps the option's own label — the grid's rule. An editable control keeps
   * the stored value it edits: the map changes what a reader reads, never what
   * a save sends, and the record and every API answer are untouched.
   *
   * It exists for the sheet with no field schema to borrow a label from — a
   * `dataSource.system` sheet whose endpoint answers a raw status — and for
   * relabelling one surface without renaming an option everywhere.
   *
   * @example
   * ```yaml
   * recordFields:
   *   - name: status
   *     type: single-line-text
   *     valueLabels: { done: processed, processing: in progress }
   * ```
   */
  valueLabels: Schema.optional(
    ValueLabelsSchema.annotate({
      title: 'Value Labels',
      description:
        "Map of stored value -> the words this entry prints for it, the grid column's valueLabels on a record sheet. A value left out prints as stored; on an option field the label keeps the option's chip and colour. Read-only display only: an editable control, a save and the API keep the stored value.",
      examples: [{ done: 'processed', processing: 'in progress' }],
    })
  ),
  /**
   * Per-record visibility: the entry is drawn only when the open record's
   * `field` satisfies the operator(s); omit it to draw the entry on every record.
   *
   * The SAME condition a `table` action item's `visibleWhen`, a `button`
   * field's `visibleWhen` and `visibility.record` spend — `FieldConditionSchema`
   * by reference, evaluated by `satisfiesFieldCondition` — so the four sites
   * cannot drift. It sits on the entry rather than in a `visibility` because an
   * entry is not a component: it has no `visibility`, and the record it tests is
   * loaded in the browser after the sheet opens, past the server-side row
   * expansion `visibility.record` relies on.
   *
   * Read against the record the sheet loaded, never against unsaved edits.
   * Hiding is presentation, not permission: the hidden field keeps its stored
   * value, and saving the sheet never clears it.
   *
   * @example
   * ```yaml
   * # The reason shows only on a rejected claim
   * - { name: decision_reason, type: long-text, visibleWhen: { field: status, eq: Rejected } }
   * ```
   */
  visibleWhen: Schema.optional(FieldConditionSchema),
}).pipe(
  Schema.annotate({
    identifier: 'RecordDrawerField',
    title: 'Record Sheet Field',
    description: 'One field of the record: its name, its type, and how its value is rendered',
  })
)

/**
 * A footer action button the drawer renders below the record body.
 *
 * Each entry is a button-shaped action that fires against the drawer's LOADED
 * record. It REUSES the standalone-button capability rather than reinventing
 * dispatch:
 *
 *  - `action` accepts the component action union minus `fill`, so a footer
 *    button can `fetch` (the operate gesture), `navigate`, run an `automation`,
 *    etc. — with all the action's own options (e.g. a `type: 'fetch'` action's
 *    `method` / `body` / `confirm` / `mode`).
 *  - `confirm` is the standalone-button confirmation PROMPT (a string). When
 *    present, the first click surfaces an inline `alertdialog` whose accessible
 *    NAME is this prompt and whose confirm affordance re-uses this action's
 *    `label`; confirming dispatches the action, cancelling restores the button.
 *    This is the same confirm pattern documented on the `button` component —
 *    set it on any destructive footer action (e.g. a run retry, a record ban).
 *
 * `$record` context — the action's `url` / `body` may interpolate
 * `$record.<field>` (e.g. `url: '/api/admin/automations/runs/$record.id/retry'`).
 * Unlike a data-table row action (where `$record` is the row, substituted at
 * render time), a record-drawer footer action resolves `$record` AT CLICK TIME
 * against the record the drawer has fetched and loaded — because the drawer
 * loads its record lazily after it opens. The drawer island therefore renders
 * these actions itself (carrying the loaded record) rather than relying on
 * static SSR substitution.
 *
 * @example
 * ```yaml
 * # A run-detail drawer with a confirm-gated retry footer action
 * type: record-drawer
 * id: run-detail
 * role: region
 * props: { title: Détail de l'exécution }
 * dataSource:
 *   system: { endpoint: /api/admin/automations/runs/:runId, param: runId }
 * recordFields:
 *   - { name: steps, type: json, renderAs: list }
 * actions:
 *   - label: Réessayer
 *     confirm: Confirmer la nouvelle tentative
 *     action:
 *       type: fetch
 *       method: POST
 *       url: /api/admin/automations/runs/$record.id/retry
 * ```
 */
export const RecordDrawerActionSchema = Schema.Struct({
  /** Visible button text. Also the confirm affordance's label when `confirm` is set. */
  label: Schema.String.annotate({
    description: "Footer action button text (and the confirm dialog's confirm-button label).",
  }),
  /**
   * The action dispatched when the footer button fires. The component action
   * union minus `fill` — typically a `type: 'fetch'` operate action whose
   * `url` interpolates `$record.<field>` resolved against the drawer's loaded
   * record at click time.
   */
  action: actionWithoutFill(
    'A drawer footer action (actions[].action)',
    'RecordDrawerFooterAction',
    'Record Sheet Footer Action',
    'The action a sheet footer button runs against the record the sheet loaded. Every action type except `fill`, which runs only from a button on the page, a list item click or a board drop hook.'
  ),
  /** Optional button variant (visual style) — same set as the `button` component. */
  variant: Schema.optional(ButtonVariantSchema),
  /**
   * Confirmation gate over the action (the standalone-button `confirm` pattern). A
   * bare STRING is the prompt — the first click surfaces an inline `alertdialog`
   * whose accessible name is this prompt and whose confirm affordance re-uses the
   * action's `label`. The OBJECT form (`ConfirmGateSchema`) adds a separate title,
   * dialog role, a type-to-confirm input, and confirm/cancel label overrides. Both
   * support `$record.<field>` interpolation. Backward-compatible: omit it for a
   * non-destructive footer action that fires immediately.
   */
  confirm: Schema.optional(ConfirmGateSchema),
  /**
   * The footer button is drawn only when the host app declares this capability
   * — the same closed vocabulary as `visibility.declares`, asked about the
   * sheet's own table.
   *
   * ─── WHY ON THE BUTTON, NOT ON A `visibility` ──────────────────────────────
   *
   * A footer button is not a component: it has no `props`, no `children` and no
   * `visibility`, and gating the whole sheet would take the record away with
   * the one affordance. It carries the clause at its own root, the position a
   * grid's action column already takes for `capability`.
   *
   * ─── WHAT "THE SHEET'S OWN TABLE" BUYS ─────────────────────────────────────
   *
   * The clause is answered with the table in the sheet's `dataSource.table`,
   * after a `$param.table` binding has resolved to the table the address
   * names. For `auth.scopeTables` that is the whole point: one sheet written
   * for every table of a records explorer offers "Who has access" on a scoped
   * table's record and on no other. Every other capability is a fact about the
   * app and answers the same whatever the table.
   *
   * An unmet clause REMOVES the button from the page, as an unmet
   * `visibility.declares` removes a component: it is not drawn disabled and its
   * action never reaches the browser.
   *
   * @example
   * ```yaml
   * actions:
   *   - label: Who has access
   *     declares: auth.scopeTables
   *     action: { type: fetch, mode: navigate, url: /access/$record.id }
   * ```
   */
  declares: Schema.optional(PageCapabilitySchema),
  /**
   * Per-record visibility: the footer button is drawn only when the open
   * record's `field` satisfies the operator(s); omit it to draw the button on
   * every record.
   *
   * The grid's per-row `columns[].actions[].visibleWhen`, at the sheet's foot:
   * the same `FieldConditionSchema` and the same matcher. Where `declares` asks
   * about the app, this asks about the record. An unmet condition REMOVES the
   * button — not drawn disabled, never fired — and when an action writes the
   * record while the sheet stays open, the sheet reads it again and the footer
   * follows.
   *
   * @example
   * ```yaml
   * actions:
   *   - label: Approve
   *     visibleWhen: { field: status, eq: Pending }
   *     action: { type: fetch, method: PATCH, url: /api/tables/expenses/records/$record.id, body: { fields: { status: Approved } } }
   * ```
   */
  visibleWhen: Schema.optional(FieldConditionSchema),
}).pipe(
  Schema.annotate({
    identifier: 'RecordDrawerAction',
    title: 'Record Sheet Action',
    description: 'One footer button: its label, the action it fires, and an optional confirm gate',
  })
)

/**
 * Accessible role of the record-drawer surface.
 *
 *  - `dialog` (default): the slide-in panel announces as a `dialog` — the
 *    historical, UNCHANGED behavior.
 *  - `region`: the surface announces as a `region` instead — so a detail
 *    drill-down (e.g. an automation run's detail pane) can present as a named
 *    landmark `region` rather than a modal dialog while keeping the same
 *    record-fetch + render machinery.
 *
 * The surface's accessible NAME comes from `props.title` (the long-declared but
 * previously unused title prop). When `props.title` is omitted the default
 * "Détail de l'enregistrement" name is kept, so existing drawers are unchanged.
 */
export const RecordDrawerRoleSchema = Schema.Literals(['dialog', 'region']).annotate({
  title: 'Record Sheet Role',
  description:
    'Accessible role of the sheet surface: dialog (default) or region. Its accessible name comes from props.title.',
})

/**
 * One column of a related section: a field of the
 * related table, and the header it is shown under.
 */
export const RecordDrawerRelatedColumnSchema = Schema.Struct({
  field: Schema.String.annotate({
    description: 'Field of the related table this column shows.',
  }),
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Header of the column. When omitted, the header is the field's own label, then its name.",
      }),
      Schema.check(Schema.isNonEmpty({ message: 'label must not be empty' }))
    )
  ),
}).annotate({
  title: 'Record Sheet Related Column',
  description: 'One column of a related section: a field of the related table and its header',
})

/**
 * What a click on a related row does (CAP-8). The two variants a `table`'s
 * `onRowClick` honours, and no others: `openSheet` names another drawer on the
 * page bound to the related table, which opens on the clicked row in place of
 * this one; `navigate` follows a path with `$record.*` read from the row.
 *
 * Deliberately NOT `RowClickActionSchema` itself: that node carries an
 * identifier and a description written for a grid, and the option needs its
 * own words. The two variants are the same schemas, so the vocabulary is one.
 */
export const RecordDrawerRelatedRowClickSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
]).annotate({
  description:
    'What a click on a listed record does: `openSheet` opens that record in another sheet on the page, bound to `table`, in place of this one; `navigate` follows a path, with `$record.*` read from the clicked record.',
})

/**
 * One related section of a record-bound drawer:
 * the rows of another table whose relationship column points at the record the
 * drawer opened, read when the drawer opens.
 *
 * The cross-table rules — `table` exists, `field` is a relationship on it that
 * points at the drawer's own table, `columns` / `sort` name real fields, an
 * `openSheet` target is a drawer bound to `table` — need the whole config and
 * live in `drawer-related-validation.ts`, never as a `Schema.check` here.
 */
export const RecordDrawerRelatedSchema = Schema.Struct({
  label: Schema.String.pipe(
    Schema.annotate({
      description: 'Heading of the section, and the accessible name of the region that holds it.',
    }),
    Schema.check(Schema.isNonEmpty({ message: 'label must not be empty' }))
  ),
  table: Schema.String.annotate({
    description: 'Table whose records the section lists.',
  }),
  field: Schema.String.annotate({
    description:
      "Relationship column on `table` that points at the sheet's own table; the section lists the records whose value in this column is the opened record.",
  }),
  columns: Schema.optional(
    Schema.Array(RecordDrawerRelatedColumnSchema).annotate({
      description:
        'Columns the section shows, in order, each naming a field of `table` and an optional header label. When omitted, the section shows every field of `table` except `field` itself.',
    })
  ),
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotate({
      description:
        'Order of the listed records, as field and direction pairs applied in turn. When omitted, records keep the order the table returns them in.',
    })
  ),
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Maximum number of records the section lists. When omitted, it lists the first 10.',
        examples: [5, 10, 25],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100))
    )
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Text shown in the section when no record points at the opened one.',
    })
  ),
  onRowClick: Schema.optional(RecordDrawerRelatedRowClickSchema),
}).annotate({
  title: 'Record Sheet Related',
  description:
    'One section listing the records of another table that point at the record the sheet opened',
})
