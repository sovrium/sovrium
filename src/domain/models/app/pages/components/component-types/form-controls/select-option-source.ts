/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SelectOptionSourceSchema } from '../../../../table-option-source'
import { SystemSourceSchema } from '../../system-source'

/**
 * Dynamic option source reading a SYSTEM endpoint rather than a declared table.
 *
 * ─── WHY THE TABLE-SHAPED SOURCE IS NOT ENOUGH ─────────────────────────────
 *
 * The values a control most often needs to offer are not rows of a table. The
 * roles a caller may assign are `assignableRoleNames(app)` — built-ins ∪ the
 * admin tier names ∪ whatever `app.auth.roles[]` declares — computed from the
 * auth config and stored in no table at all. An app's automation names, agent
 * names and table names are the same shape: facts ABOUT the operator's
 * configuration, already served by a read endpoint, and unreachable from
 * `{ table, displayField }`.
 *
 * Hardcoding those lists into the config was measured and rejected: narrowing a
 * role picker to the built-in names, on a partner-shaped app, left it sharing
 * ZERO members with the roles that app declares. That is not a degradation, it
 * is a control offering nothing the operator can pick.
 *
 * ─── SAME RESOLUTION CONTRACT ──────────────────────────────────────────────
 *
 * Resolved server-side before render by the same pass, and REPLACED by a
 * concrete `options` array — so the endpoint and its envelope keys never reach
 * the client bundle (security rule S4), and the rows-oriented resolver never
 * sees a select.
 *
 * ─── WHY IT REUSES THE ROWS ENVELOPE ───────────────────────────────────────
 *
 * `system` is the shared `SystemSourceSchema` verbatim, so the envelope
 * (`rowsKey`, `idKey`, `totalKey`, static `query`, and route-parameter
 * substitution) is described exactly once for every consumer that reads rows.
 * Only the projection to a choice list is new, and it is two keys.
 *
 * @example
 * ```yaml
 * - type: select
 *   dataSource:
 *     system:
 *       endpoint: /api/admin/automations
 *       rowsKey: automations
 *     valueKey: name
 *     labelKey: label
 *   props: { id: automation-filter, label: Filter by automation }
 * ```
 */
export const SelectSystemOptionSourceSchema = Schema.Struct({
  /** The read endpoint supplying the option rows (the shared rows envelope) */
  system: SystemSourceSchema,
  /**
   * Row key supplying each option's VALUE.
   *
   * Defaults to the envelope's own `idKey` (itself `'id'` by default), because
   * a system row's identity is exactly what an option submits. Declared when
   * the endpoint's identity is not what should be submitted — a role picker
   * submits `name`, not a numeric id.
   */
  valueKey: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Row key supplying each option's submitted value (default: the envelope's idKey)",
        examples: ['name', 'id', 'slug'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Row key supplying each option's LABEL.
   *
   * Required for the same reason `displayField` is above: guessing produces
   * blank labels on any endpoint that does not happen to match, and a control
   * that validates and renders empty rows is worse than a boot error naming the
   * missing property.
   */
  labelKey: Schema.String.pipe(
    Schema.annotate({
      description: "Row key supplying each option's display label",
      examples: ['name', 'label', 'title'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Maximum number of options to resolve (default 100, hard max 1000). */
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Maximum number of options to resolve. Default 100, hard max 1000 — the list is server-rendered into the page.',
        examples: [50, 200],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(1000))
    )
  ),
}).annotate({
  identifier: 'SelectSystemOptionSource',
  title: 'Select System Option Source',
  description:
    'Dynamic option source reading a system endpoint: projects its rows to label/value options server-side before render. Mutually exclusive with a static options array and with the table-backed source.',
})

/** @public */
export type SelectSystemOptionSource = Schema.Schema.Type<typeof SelectSystemOptionSourceSchema>

/**
 * Either dynamic option source — table rows, or the rows of a system endpoint.
 *
 * Discriminated by which key is present (`table` vs `system`), the same way
 * `DataTableDataSourceSchema` separates its two members, so a binding declaring
 * both is refused rather than silently resolved from one of them.
 */
export const SelectOptionSourceBindingSchema = Schema.Union([
  SelectOptionSourceSchema,
  SelectSystemOptionSourceSchema,
]).annotate({
  identifier: 'SelectOptionSourceBinding',
  title: 'Select Option Source Binding',
  description:
    'Dynamic option source for a choice control: table rows, or the rows of a system read endpoint',
})

/** @public */
export type SelectOptionSourceBinding = Schema.Schema.Type<typeof SelectOptionSourceBindingSchema>

/*
 * The TABLE member is declared at the app root (`table-option-source.ts`), where
 * a hosted form's `optionsSource` can reach it too; re-exported here so every
 * page-side reader keeps its import.
 */
export {
  SELECT_OPTION_SOURCE_DEFAULT_LIMIT,
  SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
  SelectOptionSourceSchema,
  type SelectOptionSource,
} from '../../../../table-option-source'
