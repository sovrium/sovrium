/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  castFormulaDivisionOperands,
  getViewComputedFormulaFields,
  translateFormulaToPostgres,
} from './formula-utils'
import type { NumericCastField } from './formula-numeric-cast'
import type { Fields } from '@/domain/models/app/tables/fields'

const toCastField = (field: Fields[number]): NumericCastField => ({
  name: field.name,
  type: field.type,
  ...('resultType' in field && typeof field.resultType === 'string'
    ? { resultType: field.resultType }
    : {}),
})

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

const formulaRefsName = (formula: string, name: string): boolean =>
  new RegExp(`\\b${name}\\b`, 'i').test(formula)

const orderViewFormulasByDependency = (
  formulaFields: readonly (Fields[number] & { readonly formula: string })[]
): readonly (Fields[number] & { readonly formula: string })[] =>
  formulaFields.toSorted((a, b) => {
    const aRefsB = formulaRefsName(a.formula, b.name)
    const bRefsA = formulaRefsName(b.formula, a.name)
    if (aRefsB && !bRefsA) return 1
    if (bRefsA && !aRefsB) return -1
    return 0
  })

export type ViewFormulaLayer = {
  readonly name: string
  readonly render: (previousAlias: string) => string
}

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
      const translated = translateFormulaToPostgres(field.formula, allFields)
      const expression = qualifyViewFormula(translated, allFields, previousAlias)
      return `(${expression}) AS ${field.name}`
    },
  }))
}

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
