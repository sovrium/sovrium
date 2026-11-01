/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formulas that read the clock but are computed when the row is saved,
 * found from the schema alone.
 *
 * A formula over plain fields is stored with its row: it is computed when the
 * row is saved and keeps that value until the row is saved again. One that
 * reads `CURRENT_DATE` or `CURRENT_TIMESTAMP` therefore holds the date of the
 * row's last save, not today's — a "days left" that never counts down. A
 * formula that reads a `lookup`, `rollup` or `count`, directly or through
 * another formula, is computed when the row is read instead, and follows the
 * clock. This service names the first kind, so `sovrium validate` can say so.
 */

import { extractFieldReferences } from './table-formula-validation'

/** The field kinds whose value is computed when the row is read. */
const READ_TIME_FIELD_TYPES: ReadonlySet<string> = new Set(['lookup', 'rollup', 'count'])

/** A clock read: one of the SQL keywords, or `NOW` called as a function. */
const CLOCK_PATTERN = /\b(CURRENT_TIMESTAMP|CURRENT_DATE)\b|\b(NOW)\s*\(/i

/** The part of a field this service reads. */
export interface ClockFieldShape {
  readonly name: string
  readonly type: string
  readonly formula?: unknown
}

/** The part of an app this service reads. */
export interface ClockAppShape {
  readonly tables?:
    | ReadonlyArray<{ readonly name: string; readonly fields: readonly ClockFieldShape[] }>
    | undefined
}

const formulaOf = (field: ClockFieldShape): string | undefined =>
  field.type === 'formula' && typeof field.formula === 'string' ? field.formula : undefined

/** The clock keyword `formula` reads outside its string literals, upper-cased, if any. */
export const clockReadOf = (formula: string): string | undefined => {
  const withoutLiterals = formula.replace(/'[^']*'|"[^"]*"/g, "''")
  const match = CLOCK_PATTERN.exec(withoutLiterals)
  return (match?.[1] ?? match?.[2])?.toUpperCase()
}

/**
 * The formulas of `fields` computed when the row is read: those that reference
 * a `lookup`, `rollup` or `count` field, directly or through another such
 * formula (a fixed point over the formula-to-formula references).
 */
export const readTimeFormulas = (fields: readonly ClockFieldShape[]): ReadonlySet<string> => {
  const referencesOf = new Map(
    fields.flatMap((field) => {
      const formula = formulaOf(field)
      return formula === undefined
        ? []
        : [[field.name.toLowerCase(), new Set(extractFieldReferences(formula))] as const]
    })
  )
  const seeds = new Set(
    fields
      .filter((field) => READ_TIME_FIELD_TYPES.has(field.type))
      .map((field) => field.name.toLowerCase())
  )
  const expand = (current: ReadonlySet<string>): ReadonlySet<string> => {
    const next = new Set([
      ...current,
      ...[...referencesOf]
        .filter(([, references]) => [...references].some((name) => current.has(name)))
        .map(([name]) => name),
    ])
    return next.size === current.size ? next : expand(next)
  }
  const reached = expand(seeds)
  return new Set([...referencesOf.keys()].filter((name) => reached.has(name)))
}

/**
 * One notice per `formula` field that reads the clock and is computed when
 * its row is saved. Tables and fields in declaration order.
 */
export const savedClockFormulaNotices = (app: ClockAppShape): readonly string[] =>
  (app.tables ?? []).flatMap((table) => {
    const readTime = readTimeFormulas(table.fields)
    return table.fields.flatMap((field) => {
      const formula = formulaOf(field)
      const clock = formula === undefined ? undefined : clockReadOf(formula)
      return clock === undefined || readTime.has(field.name.toLowerCase())
        ? []
        : [
            `Formula "${field.name}" on table "${table.name}" reads the clock (${clock}): its value is computed when the row is saved and does not change until the row is saved again.`,
          ]
    })
  })
