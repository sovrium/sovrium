/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Derive a grid's columns from a declaration instead of authoring them.
 *
 * Two sources, one per thing a grid can be bound to whose shape is DECLARED in
 * the config rather than known only to an endpoint.
 *
 * ─── `table` — the bound table's fields ───────────────────────────────────
 *
 * A grid over a table named by the URL (`dataSource.table: $param.table`)
 * cannot enumerate its own columns: the page definition does not know which
 * table it will be asked for, and the operator's tables are not knowable when
 * the config is written. `columnsFrom: table` closes exactly that — ONE page
 * definition becomes a records explorer over every table the app declares.
 *
 * Re-binding such a grid to a system source over `/api/tables/:table/records`
 * looks equivalent and is not: inline edit, the typed create modal, the
 * `_canCreate` gate and the column derivation are all gated on
 * `!isSystemSource` by construction.
 *
 * One column per declared field, in declaration order, HONOURING field-level
 * read permissions for the requesting session. Exclusive with `columns`, and
 * requires a `dataSource.table`.
 *
 * ─── `{ form }` — a form's answers ────────────────────────────────────────
 *
 * A submissions inbox reads a system source (the admin submissions list), whose
 * rows are an envelope — id, status, received time — around the submitted
 * answers in `body`. The envelope's columns are the same for every form and are
 * authored; the answers differ per form and are what this derives: one column
 * per value-carrying field of the named form (a section heading carries none),
 * in declaration order, reading `body.<field>`, headed by the field's label and
 * drawn by its type's cell.
 *
 * WHY THE FORM IS NAMED HERE AND NOT READ FROM THE ENDPOINT: the endpoint is a
 * URL, and parsing a form name back out of one is a guess that breaks the day
 * an author points the grid at a different read. Naming the form on the column
 * source keeps the instruction and its argument in one key, validates offline
 * (a literal name must be a declared form; `$param.<segment>` must be a segment
 * of the page path), and is the form counterpart of `dataSource.table:
 * $param.table` — a URL that names no declared form answers 404.
 *
 * WHY `columns` MAY STAND BESIDE IT: table-derived columns cover the whole row,
 * so an authored list beside them could only duplicate one. Form-derived
 * columns cover only the answers, never the envelope, so the envelope columns
 * (status, received) are authored and lead; the answers follow.
 *
 * WHO GETS THE COLUMNS: answers reach a caller only through the reveal gate
 * (an admin role on an instance that sets
 * `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`), so a caller who could never fill
 * an answer column gets none — no empty columns for a read-only tier. Answer
 * columns are not sortable or filterable: the list sorts and searches its
 * envelope, never the answers.
 *
 * @example
 * ```yaml
 * path: /submissions/:form
 * components:
 *   - type: table
 *     dataSource:
 *       system:
 *         endpoint: /api/admin/forms/:form/submissions
 *         param: form
 *         totalKey: total
 *         query: { reveal: 'true' }
 *     columns:
 *       - { field: status, label: Status }
 *       - { field: submittedAt, label: Received, format: datetime }
 *     columnsFrom: { form: $param.form }
 * ```
 */
export const DataTableFormColumnsSchema = Schema.Struct({
  form: Schema.String.annotate({
    description:
      'The form whose fields become the answer columns: a declared form name, or $param.<segment> to take it from the URL (a URL naming no declared form answers 404).',
    examples: ['contact', '$param.form'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'DataTableFormColumns',
  title: 'Data Table Form Answer Columns',
  description:
    "One column per value-carrying field of the named form, reading each row's body.<field>, labelled and drawn by the form field. Requires a dataSource.system over a form's submissions; authored columns may lead.",
})

/** `columnsFrom`: the bound table's fields, or a named form's answers. */
export const DataTableColumnsFromSchema = Schema.Union([
  Schema.Literal('table').annotate({
    description:
      'Derive one column per declared field of the bound table, honouring field-level read permissions. Mutually exclusive with columns; requires a dataSource.table.',
  }),
  DataTableFormColumnsSchema,
]).annotate({
  identifier: 'DataTableColumnsFrom',
  title: 'Data Table Derived Columns',
  description:
    "Derive the columns instead of authoring them: 'table' from the bound table's declared fields (exclusive with columns, requires dataSource.table), or { form } from a form's fields over its submissions (requires dataSource.system; authored columns may lead).",
})

/** @public */
export type DataTableColumnsFrom = Schema.Schema.Type<typeof DataTableColumnsFromSchema>
