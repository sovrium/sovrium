/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectCycles } from './cycle-detection'
import { FORMULA_KEYWORDS } from './formula-keywords'

export const SPECIAL_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
]) as ReadonlySet<string>

const validateFormulaSyntax = (formula: string): string | undefined => {
  const withoutLiterals = formula
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')

  const consecutiveOperatorPattern = /[+\-*/%]\s*[+\-*/%]/
  if (consecutiveOperatorPattern.test(withoutLiterals)) {
    return 'Invalid formula syntax: consecutive operators detected'
  }

  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return 'Invalid formula syntax: unmatched parentheses'
  }

  if (/\(\s*\)/.test(formula)) {
    return 'Invalid formula syntax: empty parentheses'
  }

  return undefined
}

export const extractFieldReferences = (formula: string): ReadonlyArray<string> => {
  const withoutStringLiterals = formula
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '')

  const identifierPattern = /\b([a-z_][a-z0-9_]*)\b/gi
  const matches = withoutStringLiterals.match(identifierPattern) || []

  return matches
    .map((match) => match.toLowerCase())
    .filter((identifier) => !FORMULA_KEYWORDS.has(identifier))
}

const detectCircularDependencies = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): ReadonlyArray<string> => {
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    fields
      .filter(
        (field): field is typeof field & { formula: string } =>
          'formula' in field && typeof field.formula === 'string'
      )
      .map((field) => [field.name, extractFieldReferences(field.formula)] as const)
  )

  return detectCycles(dependencyGraph)
}

export const validateFormulaFields = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const fieldNames = new Set(fields.map((field) => field.name))
  const formulaFields = fields.filter(
    (field): field is typeof field & { readonly formula: string } =>
      field.type === 'formula' && typeof field.formula === 'string'
  )

  const syntaxError = formulaFields
    .map((formulaField) => ({
      field: formulaField,
      error: validateFormulaSyntax(formulaField.formula),
    }))
    .find((result) => result.error !== undefined)

  if (syntaxError?.error) {
    return {
      message: syntaxError.error,
      path: ['fields'],
    }
  }

  const invalidReference = formulaFields
    .flatMap((formulaField) => {
      const referencedFields = extractFieldReferences(formulaField.formula)
      const invalidField = referencedFields.find(
        (refField) => !fieldNames.has(refField) && !SPECIAL_FIELDS.has(refField)
      )
      return invalidField ? [{ formulaField, invalidField }] : []
    })
    .at(0)

  if (invalidReference) {
    return {
      message: `Invalid field reference: field '${invalidReference.invalidField}' not found in formula '${invalidReference.formulaField.formula}'`,
      path: ['fields'],
    }
  }

  const circularFields = detectCircularDependencies(fields)
  if (circularFields.length > 0) {
    return {
      message: `Circular dependency detected in formula fields: ${circularFields.join(' -> ')}`,
      path: ['fields'],
    }
  }

  return undefined
}
