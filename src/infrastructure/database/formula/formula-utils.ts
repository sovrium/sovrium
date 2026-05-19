/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const SQL_RESERVED_KEYWORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'from',
  'where',
  'join',
  'inner',
  'outer',
  'left',
  'right',
  'full',
  'cross',
  'on',
  'as',
  'table',
  'create',
  'alter',
  'drop',
  'truncate',
  'add',
  'column',
  'constraint',
  'primary',
  'foreign',
  'key',
  'references',
  'unique',
  'index',
  'view',
  'database',
  'schema',
  'grant',
  'revoke',
  'transaction',
  'commit',
  'rollback',
  'union',
  'intersect',
  'except',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'distinct',
  'all',
  'any',
  'some',
  'exists',
  'in',
  'between',
  'like',
  'ilike',
  'and',
  'or',
  'not',
  'null',
  'is',
  'true',
  'false',
  'case',
  'when',
  'then',
  'else',
  'end',
  'cast',
  'default',
  'check',
  'user',
  'current_user',
  'session_user',
  'current_date',
  'current_time',
  'current_timestamp',
])

const containsReservedWord = (identifier: string): boolean => {
  const lowerIdentifier = identifier.toLowerCase()
  if (SQL_RESERVED_KEYWORDS.has(lowerIdentifier)) {
    return true
  }
  const tokens = lowerIdentifier.split('_')
  return tokens.some((token) => SQL_RESERVED_KEYWORDS.has(token))
}

const escapeFieldName = (fieldName: string): string =>
  containsReservedWord(fieldName) ? `"${fieldName}"` : fieldName

const volatileSQLFunctions = [
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_TIMESTAMP',
  'NOW()',
  'TIMEOFDAY()',
  'TRANSACTION_TIMESTAMP()',
  'STATEMENT_TIMESTAMP()',
  'CLOCK_TIMESTAMP()',
  'RANDOM()',
  'SETSEED(',
  'DECODE(',
  'CONVERT_FROM(',
  'TO_CHAR(',
  'TO_DATE(',
  'DATE_TRUNC(',
  'ARRAY_TO_STRING(',
]

const volatileTypeCasts = ['::TIMESTAMP', '::TIMESTAMPTZ', '::DATE', '::TIME']

export const isFormulaVolatile = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase()
  return (
    volatileSQLFunctions.some((fn) => upperFormula.includes(fn)) ||
    volatileTypeCasts.some((cast) => upperFormula.includes(cast)) ||
    upperFormula.includes('CREATED_AT') ||
    upperFormula.includes('UPDATED_AT')
  )
}

const formulaReferencesField = (formula: string, fieldName: string): boolean => {
  const regex = new RegExp(`\\b${fieldName}\\b`, 'i')
  return regex.test(formula)
}

export const isFormulaReferencingFormulaField = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): boolean => {
  if (!allFields) return false

  const formulaFields = allFields.filter(
    (f) =>
      f.type === 'formula' &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  )

  if (formulaFields.length === 0) return false

  return formulaFields.some((f) => formulaReferencesField(formula, f.name))
}

export const getFormulaFieldsNeedingTrigger = (
  allFields: readonly { name: string; type: string }[]
): ReadonlySet<string> => {
  const formulaFields = allFields.filter(
    (f): f is { name: string; type: string; formula: string } =>
      f.type === 'formula' &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  ) as readonly { name: string; type: string; formula: string }[]

  if (formulaFields.length === 0) return new Set()

  const directlyNeedsTrigger = new Set(
    formulaFields
      .filter((f) =>
        formulaFields.some(
          (other) => other.name !== f.name && formulaReferencesField(f.formula, other.name)
        )
      )
      .map((f) => f.name)
  )

  if (directlyNeedsTrigger.size === 0) return new Set()

  const expandDependencies = (current: ReadonlySet<string>): ReadonlySet<string> => {
    const expanded = formulaFields.reduce((acc, f) => {
      if (!acc.has(f.name)) return acc
      const referencedFormulaFields = formulaFields
        .filter((other) => !acc.has(other.name) && formulaReferencesField(f.formula, other.name))
        .map((other) => other.name)
      return referencedFormulaFields.length > 0
        ? new Set([...acc, ...referencedFormulaFields])
        : acc
    }, current)

    return expanded.size === current.size ? expanded : expandDependencies(expanded)
  }

  return expandDependencies(directlyNeedsTrigger)
}

const arrayReturningFunctions = ['STRING_TO_ARRAY']

export const isFormulaReturningArray = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase().trim()

  if (upperFormula.startsWith('ARRAY_TO_STRING(')) {
    return false
  }

  if (upperFormula.startsWith('CARDINALITY(')) {
    return false
  }

  return arrayReturningFunctions.some((fn) => upperFormula.includes(fn))
}

const parseRoundArgs = (
  formula: string,
  matchIndex: number,
  matchLength: number
):
  | {
      readonly firstArg: string
      readonly secondArg: string
      readonly start: number
      readonly end: number
    }
  | undefined => {
  const argsStart = matchIndex + matchLength
  const chars = [...formula.slice(argsStart)]

  const state = chars.reduce<{
    depth: number
    firstArgEnd: number
    currentIndex: number
    done: boolean
  }>(
    (acc, char, idx) => {
      if (acc.done) return acc

      const absoluteIndex = argsStart + idx

      if (char === '(') {
        return { ...acc, depth: acc.depth + 1, currentIndex: absoluteIndex }
      }

      if (char === ')') {
        const newDepth = acc.depth - 1
        if (newDepth === 0) {
          return { ...acc, depth: newDepth, currentIndex: absoluteIndex, done: true }
        }
        return { ...acc, depth: newDepth, currentIndex: absoluteIndex }
      }

      if (char === ',' && acc.depth === 1 && acc.firstArgEnd === -1) {
        return { ...acc, firstArgEnd: absoluteIndex, currentIndex: absoluteIndex }
      }

      return { ...acc, currentIndex: absoluteIndex }
    },
    { depth: 1, firstArgEnd: -1, currentIndex: argsStart, done: false }
  )

  if (state.firstArgEnd === -1) return undefined

  return {
    firstArg: formula.slice(argsStart, state.firstArgEnd).trim(),
    secondArg: formula.slice(state.firstArgEnd + 1, state.currentIndex).trim(),
    start: matchIndex,
    end: state.currentIndex + 1,
  }
}

const translateDateCastsToText = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  if (!allFields) return formula

  return formula.replace(/(\w+)::TEXT/gi, (match, fieldName) => {
    const field = allFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
    if (field && (field.type === 'date' || field.type === 'datetime' || field.type === 'time')) {
      if (field.type === 'date') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'YYYY-MM-DD')`
      }
      if (field.type === 'datetime') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
      }
      if (field.type === 'time') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'HH24:MI:SS')`
      }
    }
    return match
  })
}

const translateSubstrToSubstring = (formula: string): string =>
  formula.replace(
    /SUBSTR\s*\(\s*([^,]+?)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
    (_, text, start, length) => {
      const trimmedText = text.trim()
      const escapedText = trimmedText.match(/^\w+$/) ? escapeFieldName(trimmedText) : trimmedText
      return `SUBSTRING(${escapedText} FROM ${start} FOR ${length})`
    }
  )

const addNumericCastsToRound = (formula: string): string => {
  const roundMatches = [...formula.matchAll(/ROUND\s*\(/gi)]
  const replacements = roundMatches
    .map((match) => parseRoundArgs(formula, match.index ?? 0, match[0].length))
    .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== undefined)
    .filter((parsed) => /SQRT|POWER|EXP|LN|LOG/i.test(parsed.firstArg))
    .map((parsed) => ({
      start: parsed.start,
      end: parsed.end,
      replacement: `ROUND((${parsed.firstArg})::NUMERIC, ${parsed.secondArg})`,
    }))

  const sortedReplacements = replacements.toSorted((a, b) => b.start - a.start)

  return sortedReplacements.reduce(
    (result, { start, end, replacement }) =>
      result.slice(0, start) + replacement + result.slice(end),
    formula
  )
}

const escapeReservedFieldNames = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  if (!allFields) return formula

  return allFields.reduce((acc, field) => {
    if (!containsReservedWord(field.name)) {
      return acc
    }

    const fieldRegex = new RegExp(`(?<!["'])\\b${field.name}\\b(?!["'])`, 'gi')
    return acc.replace(fieldRegex, (match) => escapeFieldName(match))
  }, formula)
}

export const translateFormulaToPostgres = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  const withDateToText = translateDateCastsToText(formula, allFields)
  const withSubstring = translateSubstrToSubstring(withDateToText)
  const withRoundCast = addNumericCastsToRound(withSubstring)
  return escapeReservedFieldNames(withRoundCast, allFields)
}

const EXTRACT_KEYWORDS = new Set([
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'dow',
  'doy',
  'week',
  'quarter',
  'decade',
  'century',
  'millennium',
  'epoch',
  'timezone',
  'timezone_hour',
  'timezone_minute',
])

export const qualifyColumnReferences = (
  formula: string,
  allFields: readonly { name: string; type: string }[],
  prefix: string
): string =>
  allFields.reduce((acc, field) => {
    if (EXTRACT_KEYWORDS.has(field.name.toLowerCase())) {
      const extractPattern = new RegExp(`\\bEXTRACT\\s*\\(\\s*${field.name}\\s+FROM\\b`, 'gi')
      if (extractPattern.test(acc)) {
        const fieldRegex = new RegExp(
          `(?<!EXTRACT\\s{0,10}\\(\\s{0,10})(?<![."])\\b${field.name}\\b(?!["'(]|\\s+FROM)`,
          'gi'
        )
        return acc.replace(fieldRegex, `${prefix}.${field.name}`)
      }
    }

    const fieldRegex = new RegExp(`(?<![."])\\b${field.name}\\b(?!["'(])`, 'gi')
    return acc.replace(fieldRegex, `${prefix}.${field.name}`)
  }, formula)
