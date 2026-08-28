/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record-drawer` overlay component-type
 *.
 *
 * A record-detail/edit drawer SPECIALIZATION built on the same slide-in panel
 * concept as `drawer`, but bound to a record: it opens on a `data-table` row
 * click (the existing `onRowClick: { action: 'openDrawer', component }`
 * dispatch), FETCHES the clicked record (`GET /api/tables/:t/records/:id`),
 * auto-generates an editable form from the table's field schema (one control
 * per field), and saves the whole record via `PATCH /api/tables/:t/records/:id`.
 *
 * One component serves EVERY table because the form is DERIVED from the field
 * schema at render time. The F6 tier read/edit split is honoured: an
 * `admin-viewer` sees a read-only record (`canEdit: false`, fields disabled,
 * no save affordance); an `admin-editor` can edit and save.
 *
 * Three additive, backward-compatible capabilities
 * generalise the drawer so any app config can express a record-detail surface
 * with footer actions, a configurable accessible name/role, and structured
 * (nested) field rendering:
 *
 *  - `actions`  — a footer slot of button-shaped actions that fire against the
 *    drawer's LOADED record (`$record.*` is resolved at click time). Reuses the
 *    standalone-button `action` + `confirm` capability — it does NOT reinvent
 *    dispatch.
 *  - `role`     — selects the surface's accessible role (`dialog` default |
 *    `region`) and `props.title` sets its accessible NAME — so a detail drawer
 *    can present as `region "Détail de l'exécution"` instead of the hardcoded
 *    `dialog "Détail de l'enregistrement"`.
 *  - `recordFields[].renderAs` — a per-field structured renderer so a nested
 *    object / array-of-objects renders readably (`json` / `list` / `key-value` /
 *    `code`) instead of mangling to `[object Object]` under `String(value)`.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../action'
import { ConfirmGateSchema } from '../../confirm-gate'
import { ButtonVariantSchema } from '../../shared-schemas'
import { SystemDetailSourceSchema } from '../../system-detail-source'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const RecordDrawerTypeLiteral = Schema.Literal('record-drawer')

/**
 * Per-field structured-display selector ([internal ref] CAP-3).
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
  title: 'Record Drawer Field Render As',
  description:
    'How a record-drawer field renders its value: text (default, String(value)), json (pretty <pre>), list (array-of-objects as a labelled list), key-value (nested object as a definition list), code (raw string in a monospace block).',
})

/** A single schema-derived form field the drawer renders a control for. */
export const RecordDrawerFieldSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
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
      Schema.check(Schema.isNonEmpty({ message: 'label must not be empty' })),
      Schema.annotate({
        description:
          "Display-name override for this drawer entry (wins over the bound field's label, then the raw name). Required to name an entry on a system-bound drawer, which has no table field schema to resolve from.",
        examples: ['Prix unitaire', 'Statut'],
      })
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
      Schema.check(Schema.isNonEmpty({ message: 'description must not be empty' })),
      Schema.annotate({
        description:
          "Guidance-text override rendered beside this drawer entry's value (wins over the bound field's description). Required to describe an entry on a system-bound drawer.",
        examples: ['Hors taxes, en euros.'],
      })
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
}).pipe(Schema.annotate({ identifier: 'RecordDrawerField', title: 'Record Drawer Field' }))

/**
 * A footer action button the drawer renders below the record body
 * ([internal ref] CAP-1).
 *
 * Each entry is a button-shaped action that fires against the drawer's LOADED
 * record. It REUSES the standalone-button capability rather than reinventing
 * dispatch:
 *
 *  - `action` accepts the full component `ActionSchema` union, so a footer
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
   * The action dispatched when the footer button fires. The full component
   * `ActionSchema` union — typically a `type: 'fetch'` operate action whose
   * `url` interpolates `$record.<field>` resolved against the drawer's loaded
   * record at click time.
   */
  action: ActionSchema,
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
}).pipe(Schema.annotate({ identifier: 'RecordDrawerAction', title: 'Record Drawer Action' }))

/**
 * Accessible role of the record-drawer surface ([internal ref] CAP-2).
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
  title: 'Record Drawer Role',
  description:
    'Accessible role of the drawer surface: dialog (default) or region. Its accessible name comes from props.title.',
})

export const recordDrawerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Drawer identifier referenced by `onRowClick: { action: 'openDrawer',
   * component: <id> }` (the existing dispatch the grid emits).
   */
  id: Schema.optional(
    Schema.String.annotate({
      description:
        "Record-drawer identifier referenced by `onRowClick: { action: 'openDrawer', component }`.",
    })
  ),
  /**
   * The single-record source the drawer fetches (and, for a DB table, patches).
   *
   * Discriminated:
   *  - `{ table }` — the original DB-table binding: fetch `GET …/records/:id`,
   *    save `PATCH …/records/:id` (UNCHANGED — every existing config keeps working).
   *  - `{ system }` — a system DETAIL-endpoint binding (`SystemDetailSourceSchema`):
   *    the drill-down opened from a system-source `data-table` fetches the clicked
   *    row's detail from a read endpoint (e.g. an automation run detail at
   *    `/api/admin/automations/runs/:runId`) instead of `/api/tables/:t/records/:id`.
   *    A system-detail drawer is READ-ONLY (no records table to PATCH).
   */
  dataSource: Schema.optional(
    Schema.Union([
      Schema.Struct({ table: Schema.String }).pipe(
        Schema.annotate({ identifier: 'RecordDrawerDataSource' })
      ),
      Schema.Struct({
        /** System detail-endpoint binding (mutually exclusive with the DB-table form) */
        system: SystemDetailSourceSchema,
      }).annotate({
        title: 'Record Drawer System Detail Source',
        description: 'System detail-endpoint binding for the record-detail drawer',
      }),
    ]).annotate({
      identifier: 'RecordDrawerDataSourceBinding',
      title: 'Record Drawer Data Source',
      description: 'DB-table single-record binding OR a system detail-endpoint binding',
    })
  ),
  /** Schema-derived field list (one control per field), authored at render time. */
  recordFields: Schema.optional(Schema.Array(RecordDrawerFieldSchema)),
  /** F6 tier read/edit split: `false` renders a read-only record (no save). */
  canEdit: Schema.optional(Schema.Boolean),
  /**
   * Footer action slot (CAP-1). One or more button-shaped actions rendered
   * below the record body. Each fires against the drawer's LOADED record
   * (`$record.*` resolved at click time) and reuses the standalone-button
   * `action` + `confirm` dispatch. Additive — a drawer without `actions` renders
   * exactly as before.
   */
  actions: Schema.optional(
    Schema.Array(RecordDrawerActionSchema).annotate({
      title: 'Record Drawer Actions',
      description:
        "Footer action buttons rendered below the record body. Each fires against the drawer's loaded record ($record.* resolved at click time) and reuses the button action + confirm dispatch.",
    })
  ),
  /**
   * Accessible role of the drawer surface (CAP-2). `dialog` (default) | `region`.
   * The accessible NAME is read from `props.title`. Additive — omit it (and/or
   * `props.title`) to keep the default `dialog "Détail de l'enregistrement"`.
   */
  role: Schema.optional(RecordDrawerRoleSchema),
} as const
