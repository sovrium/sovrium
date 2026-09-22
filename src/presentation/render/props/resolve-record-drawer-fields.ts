/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { declaredFieldDescription, declaredFieldLabel } from '@/presentation/design/field-display'
import { resolveSourceTable } from './type-specific-props-builder'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** One control per declared field — the shape the record-drawer binds inputs to. */
export type DerivedRecordField = {
  readonly name: string
  readonly type: string
  /** Resolved display name for the panel entry; absent means "keep the raw name". */
  readonly label?: string
  /** Resolved guidance rendered beside the entry's value; absent means none. */
  readonly description?: string
}

/**
 * Resolve one drawer entry's display name + guidance against the bound table.
 *
 * The entry's own `label` / `description` win; otherwise the bound field's are
 * used; otherwise nothing is emitted and the island keeps its raw-`name`
 * fallback. `boundField` is `undefined` for a system-bound drawer — a system
 * DETAIL endpoint has no field schema behind it, so the per-entry override is
 * the only naming such an entry can have.
 */
function withResolvedFieldDisplay(
  entry: Readonly<Record<string, unknown>>,
  boundField: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> {
  const label = declaredFieldLabel(entry) ?? declaredFieldLabel(boundField)
  const description = declaredFieldDescription(entry) ?? declaredFieldDescription(boundField)
  return {
    ...entry,
    ...(label === undefined ? {} : { label }),
    ...(description === undefined ? {} : { description }),
  }
}

/**
 * Enrich the drawer entries an author DECLARED with the bound table's field
 * schema, so an entry carrying no `label` / `description` of its own still
 * resolves the bound field's.
 *
 * Declared entries used to pass through verbatim, which meant a field-level
 * `label` reached the auto-DERIVED case only — the opposite of the documented
 * resolution order, under which the per-entry value is an OVERRIDE of the
 * field's rather than the only rung that works.
 */
function enrichDeclaredFields(
  declared: readonly unknown[],
  component: Component | undefined,
  tables: Tables | undefined
): readonly unknown[] {
  const tableFields = component ? resolveSourceTable(component, tables)?.fields : undefined
  return declared.map((entry) => {
    if (typeof entry !== 'object' || entry === null) return entry
    const record = entry as Readonly<Record<string, unknown>>
    const boundField = tableFields?.find((field) => field.name === record['name']) as
      Readonly<Record<string, unknown>> | undefined
    return withResolvedFieldDisplay(record, boundField)
  })
}

/**
 * The record-drawer's SCHEMA-DERIVED field list.
 *
 * `recordFields` is optional, and the component's contract is that "one
 * component serves EVERY table because the form is DERIVED from the field
 * schema at render time". An author who omits it must therefore get one control
 * per declared field of the bound table — not an empty shell.
 *
 * Shares {@link resolveSourceTable} with the data-table's own derivation
 * (`resolveDataTableInputs`) so the `dataSource → app.tables` lookup lives in
 * one place. The two differ only in projection: a grid needs field NAMES, a
 * drawer needs `{ name, type }` plus its resolved display strings (its controls
 * are typed from the field schema).
 *
 * Returns `undefined` when the component has no table binding (a `system`
 * detail source, or a table the config does not declare) — the caller then
 * leaves `recordFields` absent, exactly as before.
 */
export function resolveRecordDrawerFields(
  component: Component | undefined,
  tables: Tables | undefined
): ReadonlyArray<DerivedRecordField> | undefined {
  if (!component) return undefined
  const table = resolveSourceTable(component, tables)
  if (!table) return undefined
  return table.fields.map((field) => {
    const declared = field as Readonly<Record<string, unknown>>
    const label = declaredFieldLabel(declared)
    const description = declaredFieldDescription(declared)
    return {
      name: field.name,
      type: field.type,
      ...(label === undefined ? {} : { label }),
      ...(description === undefined ? {} : { description }),
    }
  })
}

/**
 * The `recordFields` prop the SSR host hands the drawer island.
 *
 * ONE entry point for both cases, because both resolve the same display
 * strings: an omitted list is DERIVED from the bound table, and a DECLARED list
 * is enriched from it. Splitting them at the call site is how the declared case
 * ended up skipping the field-level `label` entirely.
 */
export function resolveRecordDrawerFieldProp(
  declared: unknown,
  component: Component | undefined,
  tables: Tables | undefined
): unknown {
  if (declared === undefined) return resolveRecordDrawerFields(component, tables)
  if (!Array.isArray(declared)) return declared
  return enrichDeclaredFields(declared, component, tables)
}
