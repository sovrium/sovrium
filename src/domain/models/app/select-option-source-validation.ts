/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Select dynamic-option-source cross-validation.
 *
 * A `select` may resolve its option list from a table:
 * `dataSource: { table, displayField, valueField? }`. Three things must hold,
 * and none of them can be expressed inside the component's own schema because
 * all three need `app.tables`:
 *
 *  1. `options` and `dataSource` are MUTUALLY EXCLUSIVE — both answer "what are
 *     the choices", and there is no defensible precedence between them.
 *  2. `dataSource.table` must name a declared table.
 *  3. `displayField` / `valueField` must name real fields on that table.
 *     `valueField` defaults to `'id'`, which every table has implicitly, so the
 *     default is never checked against `fields[]`.
 *
 * (3) is the one that earns its keep: a typo'd `displayField` resolves every
 * row to `undefined` and renders a dropdown of blank rows — a control that
 * boots, validates, and is useless. Catching it OFFLINE in `sovrium validate`
 * is the whole point of config-as-code validation.
 *
 * Extracted into a standalone module (mirroring `validateAllSystemSourceReferences`
 * and `validateAllRedirectRules`) for two reasons: the recursive component walk
 * must not be inlined into the `AppSchema` filter chain (it pushes TypeScript's
 * inference depth over the limit and collapses the derived `App` type to
 * `never`), and the caller BUNDLES this into the existing final `Schema.filter`
 * rather than adding a new one, for the same depth reason.
 *
 * The walk is intentionally loose-typed (`unknown`) and recurses through every
 * value, so it finds a `select` wherever it is nested — top-level `components[]`,
 * a container's `children[]`, or inside a `form`'s children, which is where the
 * published docs put form controls in the first place.
 */

/** Minimal shape needed to validate select option sources. */
interface AppForSelectOptionSourceValidation {
  readonly tables?: ReadonlyArray<{
    readonly name: string
    readonly fields?: ReadonlyArray<{ readonly name: string }>
  }>
  readonly pages?: unknown
}

/** A `select` binding found in the page tree, reduced to what validation needs. */
interface FoundSelectBinding {
  readonly hasStaticOptions: boolean
  readonly table: string
  readonly displayField: string
  readonly valueField: string | undefined
}

/**
 * Implicit primary key present on every table, so a `valueField` naming it is
 * valid even though it is absent from the authored `fields[]`.
 */
const IMPLICIT_FIELDS: ReadonlySet<string> = new Set(['id'])

const isSelectNode = (record: Readonly<Record<string, unknown>>): boolean =>
  record['type'] === 'select'

/**
 * Recursively collect every `select` that declares a `dataSource`, together
 * with whether it ALSO declares a static `options` array.
 */
const collectSelectBindings = (node: unknown): readonly FoundSelectBinding[] => {
  if (Array.isArray(node)) return node.flatMap(collectSelectBindings)
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const nested = Object.values(record).flatMap(collectSelectBindings)
  if (!isSelectNode(record)) return nested

  const { dataSource, options } = record
  if (dataSource === null || typeof dataSource !== 'object') return nested

  const { table, displayField, valueField } = dataSource as Record<string, unknown>
  if (typeof table !== 'string' || typeof displayField !== 'string') return nested

  return [
    {
      hasStaticOptions: Array.isArray(options),
      table,
      displayField,
      valueField: typeof valueField === 'string' ? valueField : undefined,
    },
    ...nested,
  ]
}

/** A field name is known when the table declares it, or it is the implicit `id`. */
const isKnownField = (declared: ReadonlySet<string>, name: string): boolean =>
  declared.has(name) || IMPLICIT_FIELDS.has(name)

/** Human-readable tail listing the declared table names (or saying there are none). */
const availableTablesSuffix = (names: readonly string[]): string =>
  names.length > 0
    ? `. Available tables: ${names.toSorted().join(', ')}`
    : '. No tables are declared in app.tables[]'

/** Validate ONE binding; returns an error message, or `undefined` when it resolves. */
const validateBinding = (
  binding: FoundSelectBinding,
  tables: NonNullable<AppForSelectOptionSourceValidation['tables']>
): string | undefined => {
  const { table, displayField, valueField, hasStaticOptions } = binding

  if (hasStaticOptions) {
    return `Select component binds options to table '${table}' AND declares a static 'options' array — the two are mutually exclusive. Remove one.`
  }

  const matched = tables.find((t) => t.name === table)
  if (!matched) {
    const suffix = availableTablesSuffix(tables.map((t) => t.name))
    return `Select option source references table '${table}' which is not declared in app.tables[]${suffix}`
  }

  const declared = new Set((matched.fields ?? []).map((f) => f.name))
  if (!isKnownField(declared, displayField)) {
    return `Select option source displayField '${displayField}' does not exist on table '${table}'`
  }
  if (valueField !== undefined && !isKnownField(declared, valueField)) {
    return `Select option source valueField '${valueField}' does not exist on table '${table}'`
  }
  return undefined
}

/**
 * Validate every `select` dynamic option source against `app.tables`.
 *
 * Returns `true` when all bindings resolve, or an error message string naming
 * the first offending binding.
 */
export const validateAllSelectOptionSources = (
  app: AppForSelectOptionSourceValidation
): string | true => {
  if (!app.pages) return true

  const bindings = collectSelectBindings(app.pages)
  if (bindings.length === 0) return true

  const tables = app.tables ?? []
  return bindings.map((b) => validateBinding(b, tables)).find((e) => e !== undefined) ?? true
}
