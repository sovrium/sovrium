/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

function parseCondition(match: RegExpExecArray):
  | {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }
  | undefined {
  const field = match[1]
  const operator = match[2]
  const stringValue1 = match[3]
  const stringValue2 = match[4]
  const numberValue = match[5]

  if (!field || !operator) {
    return undefined
  }

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

function extractConditions(conditions: string): Array<{
  readonly field: string
  readonly operator: string
  readonly value: unknown
}> {
  const conditionRegex = /\{([^}]+)\}\s*([!=<>]+)\s*(?:'([^']*)'|"([^"]*)"|(\d+))/g

  const matches = [...conditions.matchAll(conditionRegex)]
  const parsedConditions = matches
    .map(parseCondition)
    .filter((c): c is NonNullable<typeof c> => c !== undefined)

  return parsedConditions
}

export function parseFormulaToFilter(formula: string):
  | {
      readonly and?: Array<{
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }>
    }
  | undefined {
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
