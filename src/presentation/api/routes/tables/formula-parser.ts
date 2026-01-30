/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Map operator symbol to internal operator name
 */
function mapOperator(operator: string): string | undefined {
  const operatorMap: Record<string, string> = {
    '=': 'equals',
    '!=': 'notEquals',
    '<': 'lessThan',
    '<=': 'lessThanOrEqual',
    '>': 'greaterThan',
    '>=': 'greaterThanOrEqual',
  }
  return operatorMap[operator]
}

/**
 * Parse a single condition from regex match
 */
function parseCondition(match: RegExpExecArray): {
  readonly field: string
  readonly operator: string
  readonly value: unknown
} | undefined {
  const field = match[1]
  const operator = match[2]
  const stringValue1 = match[3]
  const stringValue2 = match[4]
  const numberValue = match[5]

  // Determine value (string or number)
  const value = stringValue1 ?? stringValue2 ?? Number(numberValue)

  const mappedOperator = mapOperator(operator)
  if (!mappedOperator) {
    return undefined
  }

  return {
    field,
    operator: mappedOperator,
    value,
  }
}

/**
 * Extract all conditions from formula string
 */
function extractConditions(conditions: string): readonly {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}[] {
  // Regex to match: {field}operator'value' or {field}operatorvalue
  const conditionRegex = /\{([^}]+)\}\s*([!=<>]+)\s*(?:'([^']*)'|"([^"]*)"|(\d+))/g

  const matches = [...conditions.matchAll(conditionRegex)]
  const parsedConditions = matches.map(parseCondition).filter((c) => c !== undefined)

  return parsedConditions
}

/**
 * Parse Airtable-style formula syntax into filter structure
 *
 * Supported syntax:
 * - AND({field}='value', {field}>=value)
 * - Field references: {fieldName}
 * - Operators: =, !=, <, <=, >, >=
 * - String values: 'value' or "value"
 * - Number values: 123
 *
 * @param formula - Airtable-style formula string
 * @returns Filter structure compatible with existing filter system
 */
export function parseFormulaToFilter(formula: string): {
  readonly and?: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
} | undefined {
  // Match AND(...) pattern
  const andMatch = formula.match(/^AND\((.*)\)$/i)
  if (!andMatch) {
    return undefined
  }

  const conditions = andMatch[1]
  if (!conditions) {
    return undefined
  }

  const filters = extractConditions(conditions)

  if (filters.length === 0) {
    return undefined
  }

  return { and: filters }
}
