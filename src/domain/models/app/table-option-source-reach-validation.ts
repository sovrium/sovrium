/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a choice column REACHES, and whether the engine's built-in read rules
 * would hide it — the two questions a public choice list must answer before
 * it publishes a column it reads with its own authority.
 *
 * A computed column carries no data of its own: a `lookup` repeats a column
 * of the related table, a `rollup` aggregates one, and a `formula` repeats
 * the columns it names. Refusing a sensitive or withheld column by its OWN
 * type and grant therefore misses every computed column built over one — a
 * lookup of an email address reads `lookup`, not `email`. So the exposure
 * rules walk from the named column to every column its value is read from.
 *
 * Lives at the app root rather than under `forms/` because it reads the
 * tables feature (the shared field-read predicate), which a feature directory
 * may not import.
 */

import { isFieldReadableByCaller } from './tables/field-read-filter-service'
import type { App } from './app'

/** Minimal column shape the walk reads. */
export interface ReachColumnShape {
  readonly name: string
  readonly type?: string
  readonly relatedTable?: string
  readonly relationshipField?: string
  readonly relatedField?: string
  readonly formula?: string
}

/** Minimal table shape the walk reads. */
export interface ReachTableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<ReachColumnShape>
  readonly permissions?: { readonly fields?: ReadonlyArray<unknown> }
}

/** One column a choice value is read from. */
export interface ReachedColumn {
  readonly table: string
  readonly field: string
  /** The column as declared, or `undefined` for an implicit one (`id`, a system column). */
  readonly column: ReachColumnShape | undefined
}

/**
 * How deep a chain of computed columns is followed. A lookup of a formula over
 * a rollup is already an unusual config; past this bound the walk stops rather
 * than trusting what it has not read — see {@link resolveChoiceColumnSources}.
 */
export const MAX_REACH_DEPTH = 8

const findColumn = (
  tables: ReadonlyArray<ReachTableShape>,
  table: string,
  field: string
): ReachColumnShape | undefined =>
  tables.find((candidate) => candidate.name === table)?.fields?.find((f) => f.name === field)

type ReachNode = { readonly table: string; readonly field: string }

/** A lookup or rollup reads one column of the table its relationship points at. */
const relatedSource = (
  tables: ReadonlyArray<ReachTableShape>,
  table: string,
  column: ReachColumnShape
): ReadonlyArray<ReachNode> => {
  const relatedTable = findColumn(tables, table, column.relationshipField ?? '')?.relatedTable
  if (relatedTable === undefined || column.relatedField === undefined) return []
  return [{ table: relatedTable, field: column.relatedField }]
}

/**
 * Every identifier a formula spells, outside its single-quoted string literals.
 *
 * Deliberately NOT the formula validator's reference extractor: that one drops
 * function names and SQL keywords, and `text`, `date`, `year` or `count` are
 * both keywords and legal column names — a formula over a `long-text` column
 * named `text` would reach nothing. Over-reading is the safe direction here;
 * the caller intersects with the table's declared columns, so a function name
 * that names no column falls away on its own. Double-quoted spans are kept,
 * since in SQL they quote an identifier, not a string.
 */
const formulaIdentifiers = (formula: string): ReadonlyArray<string> =>
  (formula.replace(/'[^']*'/g, ' ').match(/[a-z_][a-z0-9_]*/gi) ?? []).map((token) =>
    token.toLowerCase()
  )

/** A formula reads every column of its own table its expression names. */
const formulaSources = (
  tables: ReadonlyArray<ReachTableShape>,
  table: string,
  column: ReachColumnShape
): ReadonlyArray<ReachNode> => {
  const declared = new Set(
    (tables.find((candidate) => candidate.name === table)?.fields ?? []).map((f) => f.name)
  )
  return [...new Set(formulaIdentifiers(column.formula ?? ''))]
    .filter((name) => declared.has(name) && name !== column.name)
    .map((field) => ({ table, field }))
}

/** The `(table, field)` pairs ONE column's value is read from, one step down. */
const directSources = (
  tables: ReadonlyArray<ReachTableShape>,
  table: string,
  column: ReachColumnShape
): ReadonlyArray<ReachNode> => {
  if (column.type === 'lookup' || column.type === 'rollup') {
    return relatedSource(tables, table, column)
  }
  return column.type === 'formula' ? formulaSources(tables, table, column) : []
}

const reachKey = (table: string, field: string): string => `${table}\u0000${field}`

/**
 * Every column a choice column's value is read from — the column itself
 * first, then, for a `lookup` or `rollup`, the related column it repeats,
 * and for a `formula`, every column of its table the expression names;
 * recursively, since a lookup can read a lookup.
 *
 * A column already visited is not walked twice, so a formula cycle ends. A
 * chain deeper than {@link MAX_REACH_DEPTH} yields a `truncated` result: the
 * caller refuses it, because a column the walk never reached cannot be
 * vouched for.
 */
export const resolveChoiceColumnSources = (
  table: string,
  field: string,
  tables: ReadonlyArray<ReachTableShape>
): { readonly columns: readonly ReachedColumn[]; readonly truncated: boolean } => {
  const walk = (
    frontier: ReadonlyArray<ReachNode>,
    seen: ReadonlyMap<string, ReachedColumn>,
    depth: number
  ): { readonly columns: readonly ReachedColumn[]; readonly truncated: boolean } => {
    const fresh = frontier.filter((node) => !seen.has(reachKey(node.table, node.field)))
    if (fresh.length === 0) return { columns: [...seen.values()], truncated: false }
    if (depth > MAX_REACH_DEPTH) return { columns: [...seen.values()], truncated: true }
    const reached = fresh.map((node) => ({
      ...node,
      column: findColumn(tables, node.table, node.field),
    }))
    const nextSeen = new Map([
      ...seen,
      ...reached.map((node) => [reachKey(node.table, node.field), node] as const),
    ])
    const next = reached.flatMap((node) =>
      node.column === undefined ? [] : directSources(tables, node.table, node.column)
    )
    return walk(next, nextSeen, depth + 1)
  }
  return walk([{ table, field }], new Map(), 0)
}

/** The two built-in roles the engine's default read rules restrict. */
export const DEFAULT_RULE_ROLES = ['member', 'viewer'] as const

/** One of {@link DEFAULT_RULE_ROLES}. */
export type DefaultRuleRole = (typeof DEFAULT_RULE_ROLES)[number]

/**
 * The first built-in role among `roles` that may NOT read `field` on `table`,
 * or `undefined` when every one of them may.
 *
 * The answer comes from the shared read predicate the record API uses, never
 * from a copy of its rules — and nothing here reads the table's
 * `permissions.fields` itself. On a table that declares no field grants the
 * predicate applies the engine's built-in default rules; on one that does, it
 * applies the grants instead, which is how declaring them replaces the
 * defaults. A caller that has already refused every restricted grant (as the
 * form rule does) therefore only ever hears a denial from the defaults.
 */
export const roleHiddenByDefaultReadRules = (
  app: { readonly tables?: ReadonlyArray<ReachTableShape> },
  table: string,
  field: string,
  roles: ReadonlyArray<DefaultRuleRole>
): DefaultRuleRole | undefined => {
  if (app.tables?.some((candidate) => candidate.name === table) !== true) return undefined
  // The predicate is typed on the decoded `App`; it reads only `tables` and the
  // role ladder under `auth`, both of which the structural shape passes through.
  const decoded = app as unknown as App
  return roles.find((role) => !isFieldReadableByCaller(decoded, table, { role }, field))
}
