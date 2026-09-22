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
 * ─── WHY THIS FILE OUTLIVED ITS COMPONENT TYPE ─────────────────────────────
 *
 * `record-drawer` was retired into `drawer` with a `dataSource`: it was a
 * drawer bound to one record, and every key it added is now a key on `drawer`.
 * The TYPE went; these SHAPES did not, because they were never only its own —
 * `table`'s `row-expand` renders the same field list through the same
 * schema, and `resolve-record-drawer-fields.ts` derives it for both.
 *
 * The names keep the `RecordDrawer` prefix on purpose. Renaming them would
 * touch every one of their importers to say the same thing, and "the fields a
 * record drawer shows" is still exactly what they describe — the drawer is now
 * spelled `drawer` with a binding rather than as its own type.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../action'
import { ConfirmGateSchema } from '../../confirm-gate'
import { ButtonVariantSchema } from '../../shared-schemas'

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
