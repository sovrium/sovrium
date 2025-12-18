/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { detectCycles } from './cycle-detection'
import { FORMULA_KEYWORDS } from './formula-keywords'

/**
 * Special field references that are always available in formulas.
 * These are system-managed fields that exist on all tables.
 */
export const SPECIAL_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
]) as ReadonlySet<string>

/**
 * Validate formula syntax to detect common syntax errors.
 * Checks for patterns that would cause SQL syntax errors.
 *
 * @param formula - The formula expression to validate
 * @returns Error message if invalid, undefined if valid
 */
const validateFormulaSyntax = (formula: string): string | undefined => {
  // Remove string literals and regex patterns to avoid false positives
  // String literals: 'text' or "text"
  // Regex patterns: text ~ 'pattern' or text ~ '^pattern$'
  const withoutLiterals = formula
    .replace(/'[^']*'/g, '') // Remove single-quoted strings
    .replace(/"[^"]*"/g, '') // Remove double-quoted strings

  // Check for consecutive operators (e.g., "* *", "+ +", "- -")
  // Only check outside of string literals and regex patterns
  const consecutiveOperatorPattern = /[+\-*/%]\s*[+\-*/%]/
  if (consecutiveOperatorPattern.test(withoutLiterals)) {
    return 'Invalid formula syntax: consecutive operators detected'
  }

  // Check for unmatched parentheses
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    return 'Invalid formula syntax: unmatched parentheses'
  }

  // Check for empty parentheses
  if (/\(\s*\)/.test(formula)) {
    return 'Invalid formula syntax: empty parentheses'
  }

  return undefined
}

/**
 * Extract potential field references from a formula expression.
 * This is a simplified parser that extracts identifiers (words) from the formula,
 * excluding string literals (content within quotes).
 * It doesn't handle complex syntax but catches common field reference patterns.
 *
 * @param formula - The formula expression to parse
 * @returns Array of field names referenced in the formula
 */
export const extractFieldReferences = (formula: string): ReadonlyArray<string> => {
  // Remove single-quoted and double-quoted string literals to avoid treating
  // literal values as field names (e.g., 'World' in STRPOS(text, 'World'))
  const withoutStringLiterals = formula
    .replace(/'[^']*'/g, '') // Remove single-quoted strings
    .replace(/"[^"]*"/g, '') // Remove double-quoted strings

  // Match word characters (field names) - exclude function names and operators
  // This regex matches identifiers that could be field names
  const identifierPattern = /\b([a-z_][a-z0-9_]*)\b/gi
  const matches = withoutStringLiterals.match(identifierPattern) || []

  return matches
    .map((match) => match.toLowerCase())
    .filter((identifier) => !FORMULA_KEYWORDS.has(identifier))
}

/**
 * Detect circular dependencies in formula fields using depth-first search.
 * A circular dependency exists when a formula field references itself directly or indirectly
 * through a chain of other formula fields.
 *
 * @param fields - Array of fields to validate
 * @returns Array of field names involved in circular dependencies, or empty array if none found
 */
const detectCircularDependencies = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): ReadonlyArray<string> => {
  // Build dependency graph: field name -> fields it references
  const dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>> = new Map(
    fields
      .filter(
        (field): field is typeof field & { formula: string } =>
          'formula' in field && typeof field.formula === 'string'
      )
      .map((field) => [field.name, extractFieldReferences(field.formula)] as const)
  )

  // Use shared cycle detection utility
  return detectCycles(dependencyGraph)
}

/**
 * Validate formula fields in a table (syntax, field references, circular dependencies).
 *
 * @param fields - Array of fields to validate
 * @returns Error object if invalid, undefined if valid
 */
export const validateFormulaFields = (
  fields: ReadonlyArray<{ readonly name: string; readonly type: string; readonly formula?: string }>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  const fieldNames = new Set(fields.map((field) => field.name))
  const formulaFields = fields.filter(
    (field): field is typeof field & { readonly formula: string } =>
      field.type === 'formula' && typeof field.formula === 'string'
  )

  // Validate formula syntax first (before checking field references)
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

  // Find the first invalid field reference across all formula fields
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

  // Detect circular dependencies in formula fields
  const circularFields = detectCircularDependencies(fields)
  if (circularFields.length > 0) {
    return {
      message: `Circular dependency detected in formula fields: ${circularFields.join(' -> ')}`,
      path: ['fields'],
    }
  }

  return undefined
}
