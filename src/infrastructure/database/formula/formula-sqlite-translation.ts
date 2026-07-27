/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { UnsupportedInSqliteError } from '@/infrastructure/database/unsupported-in-sqlite'
import { escapeReservedFieldNames } from './formula-utils'


const SQLITE_SCALAR_EQUIVALENTS: Readonly<Record<string, string>> = {
  greatest: 'max',
  least: 'min',
}

const SQLITE_UNSUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set([
  'overlay',
  'repeat',
  'strpos',
  'chr',
  'ascii',
  'encode',
  'decode',
  'initcap',
  'extract',
  'date_trunc',
  'to_char',
  'to_date',
  'to_timestamp',
  'age',
  'year',
  'month',
  'day',
  'hour',
  'date_diff',
  'now',
  'array_length',
  'cardinality',
  'unnest',
  'regexp_match',
  'regexp_replace',
  'convert_from',
])

const FUNCTION_CALL_PATTERN = /\b([a-z_][a-z0-9_]*)\s*\(/gi

const findUnsupportedFunctions = (formula: string): readonly string[] => {
  const called = [...formula.matchAll(FUNCTION_CALL_PATTERN)].map((match) =>
    (match[1] ?? '').toLowerCase()
  )
  return [...new Set(called.filter((name) => SQLITE_UNSUPPORTED_FUNCTIONS.has(name)))]
}

const rejectUnsupportedSqliteFunctions = (formula: string): void => {
  const unsupported = findUnsupportedFunctions(formula)
  if (unsupported.length === 0) return
  const names = unsupported.join(', ')
  throw new UnsupportedInSqliteError({
    feature: `formula-function:${unsupported.join('+')}`,
    message:
      `Formula "${formula}" calls ${names}, which the SQLite runtime does not provide. ` +
      `SQLite resolves function names at statement time, so emitting this formula would ` +
      `create a view that then rejects every read and write. Rewrite the formula using ` +
      `functions available on both engines, or run this app on PostgreSQL by setting DATABASE_URL.`,
  })
}

const applyScalarEquivalents = (formula: string): string =>
  Object.entries(SQLITE_SCALAR_EQUIVALENTS).reduce(
    (acc, [postgresName, sqliteName]) =>
      acc.replace(new RegExp(`\\b${postgresName}\\s*\\(`, 'gi'), `${sqliteName}(`),
    formula
  )

export const translateFormulaToSqlite = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  rejectUnsupportedSqliteFunctions(formula)
  return escapeReservedFieldNames(applyScalarEquivalents(formula), allFields)
}
