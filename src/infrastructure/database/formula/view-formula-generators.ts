/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { translateFormula } from './formula-translation'
import { castFormulaDivisionOperands, getViewComputedFormulaFields } from './formula-utils'
import type { NumericCastField } from './formula-numeric-cast'
import type { Fields } from '@/domain/models/app/tables/fields'

/** A view field reduced to the shape the division-cast post-pass needs. */
const toCastField = (field: Fields[number]): NumericCastField => ({
  name: field.name,
  type: field.type,
  ...('resultType' in field && typeof field.resultType === 'string'
    ? { resultType: field.resultType }
    : {}),
})

/**
 * Qualify each referenced field in a view formula with the CTE alias, then cast
 * numeric `/` division operands so integer-by-integer division does not
 * truncate.
 *
 * Qualification mirrors `qualifyColumnReferences` (whole-word replacement,
 * dot/quote-aware lookbehind to avoid double-qualifying) but targets a CTE
 * column rather than a `NEW`/`OLD` record. The numeric CAST is applied as a
 * shared post-pass (`castFormulaDivisionOperands`) scoped to `/` operands so
 * integer-arg functions / EXTRACT keywords are untouched (consistent with the
 * GENERATED-column and TRIGGER paths).
 *
 * @example
 * // 'sum_heures + sum_minutes / 60' with both numeric, alias 'computed'
 * // -> 'computed.sum_heures + CAST(computed.sum_minutes AS REAL) / 60'
 */
const qualifyViewFormula = (
  formula: string,
  allFields: readonly Fields[number][],
  cteAlias: string
): string => {
  const qualified = allFields.reduce((acc, field) => {
    const fieldRegex = new RegExp(`(?<![."])\\b${field.name}\\b(?!["'(])`, 'gi')
    return acc.replace(fieldRegex, `${cteAlias}.${field.name}`)
  }, formula)
  return castFormulaDivisionOperands(qualified, allFields.map(toCastField), cteAlias)
}

/** Whether formula `a` references the field name of formula `b`. */
const formulaRefsName = (formula: string, name: string): boolean =>
  new RegExp(`\\b${name}\\b`, 'i').test(formula)

/**
 * Order view-computed formula fields so that each formula appears AFTER every
 * other view-computed formula it references (topological order over
 * formula-over-formula dependencies). This lets each CTE layer reference only
 * columns already materialized by a previous layer.
 *
 * Simple insertion-based topological sort — the formula dependency graph is
 * tiny (a handful of fields per table) so an O(n^2) stable order is fine and
 * avoids hand-rolling cycle handling (cycles are rejected upstream at schema
 * validation).
 */
const orderViewFormulasByDependency = (
  formulaFields: readonly (Fields[number] & { readonly formula: string })[]
): readonly (Fields[number] & { readonly formula: string })[] =>
  formulaFields.toSorted((a, b) => {
    const aRefsB = formulaRefsName(a.formula, b.name)
    const bRefsA = formulaRefsName(b.formula, a.name)
    if (aRefsB && !bRefsA) return 1 // a depends on b -> b first
    if (bRefsA && !aRefsB) return -1 // b depends on a -> a first
    return 0
  })

/**
 * A view-computed formula field paired with its translated, alias-qualified SQL
 * expression and column alias. Returned in dependency order so the VIEW builder
 * can emit one CTE layer per formula.
 */
export type ViewFormulaLayer = {
  readonly name: string
  /** SQL expression referencing the PREVIOUS CTE alias (passed at render time). */
  readonly render: (previousAlias: string) => string
}

/**
 * Build the ordered list of view-computed formula layers for a table.
 *
 * Each layer's expression references columns from the immediately-preceding CTE
 * alias (supplied by the caller), so formula-over-formula chains resolve
 * correctly: the first formula reads rollup/lookup/count aliases, the next can
 * read that first formula's column, and so on.
 *
 * Returns an empty array when the table has no view-computed formulas.
 */
export const getViewFormulaLayers = (
  allFields: readonly Fields[number][]
): readonly ViewFormulaLayer[] => {
  const viewComputedNames = getViewComputedFormulaFields(allFields)
  if (viewComputedNames.size === 0) return []

  const formulaFields = allFields.filter(
    (f): f is Fields[number] & { readonly formula: string } =>
      f.type === 'formula' &&
      viewComputedNames.has(f.name) &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  )

  const ordered = orderViewFormulasByDependency(formulaFields)

  return ordered.map((field) => ({
    name: field.name,
    render: (previousAlias: string): string => {
      // Translate user-facing syntax (SUBSTR, date::TEXT, GREATEST/LEAST,
      // reserved-word escaping) for the ACTIVE dialect, then qualify+cast
      // references to the previous CTE alias.
      const translated = translateFormula(field.formula, allFields)
      const expression = qualifyViewFormula(translated, allFields, previousAlias)
      return `(${expression}) AS ${field.name}`
    },
  }))
}

/**
 * Assemble a layered-CTE `CREATE VIEW` statement that computes view-only
 * formulas on top of the lookup/rollup/count computation.
 *
 * The first CTE (`computed`) holds `base.*` plus the lookup/rollup/count
 * aliases. Each formula layer adds one CTE that selects the previous layer's
 * columns (`.*`) plus its own formula expression, so a formula-over-formula
 * chain resolves left-to-right. The final SELECT reads the outermost layer.
 */
export const buildLayeredViewSQL = (options: {
  readonly createView: string
  readonly viewName: string
  readonly computedSelectClause: string
  readonly fromClause: string
  readonly formulaLayers: readonly ViewFormulaLayer[]
}): string => {
  const { createView, viewName, computedSelectClause, fromClause, formulaLayers } = options

  const baseCte = `computed AS (
    SELECT
    ${computedSelectClause}
    ${fromClause}
  )`

  const { ctes, finalAlias } = formulaLayers.reduce<{
    readonly ctes: readonly string[]
    readonly finalAlias: string
    readonly index: number
  }>(
    (acc, layer) => {
      const alias = `computed_${acc.index + 1}`
      const cte = `${alias} AS (
    SELECT ${acc.finalAlias}.*, ${layer.render(acc.finalAlias)}
    FROM ${acc.finalAlias}
  )`
      return { ctes: [...acc.ctes, cte], finalAlias: alias, index: acc.index + 1 }
    },
    { ctes: [baseCte], finalAlias: 'computed', index: 0 }
  )

  return `${createView} ${viewName} AS
  WITH ${ctes.join(',\n  ')}
  SELECT * FROM ${finalAlias}`
}
