/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DatabaseDialect } from '@/domain/models/env/database/database-dialect'

export type ConstraintViolationClass = 'unique' | 'check' | 'foreign-key' | 'not-null'

export type CallerInputRejectionClass = 'undefined-column' | 'data-exception'

export type DriverFailure =
  | { readonly origin: 'constraint'; readonly violation: ConstraintViolationClass }
  | { readonly origin: 'caller-input'; readonly rejection: CallerInputRejectionClass }
  | { readonly origin: 'operator' }
  | { readonly origin: 'application' }

interface DriverErrorLike {
  readonly name?: unknown
  readonly code?: unknown
  readonly errno?: unknown
  readonly query?: unknown
  readonly params?: unknown
  readonly cause?: unknown
}

const POSTGRES_SQLSTATE_CONSTRAINTS = {
  '23502': 'not-null',
  '23503': 'foreign-key',
  '23505': 'unique',
  '23514': 'check',
} satisfies Record<string, ConstraintViolationClass>

const SQLITE_RESULT_CODE_CONSTRAINTS = {
  SQLITE_CONSTRAINT_CHECK: 'check',
  SQLITE_CONSTRAINT_FOREIGNKEY: 'foreign-key',
  SQLITE_CONSTRAINT_NOTNULL: 'not-null',
  SQLITE_CONSTRAINT_PRIMARYKEY: 'unique',
  SQLITE_CONSTRAINT_UNIQUE: 'unique',
} satisfies Record<string, ConstraintViolationClass>

const SQLSTATE_PATTERN = /^[\dA-Z]{5}$/

const readSqlState = (node: DriverErrorLike): string | undefined =>
  [node.errno, node.code].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && SQLSTATE_PATTERN.test(candidate)
  )

const POSTGRES_CALLER_INPUT_SQLSTATES = {
  '42703': 'undefined-column',
} satisfies Record<string, CallerInputRejectionClass>

const POSTGRES_DATA_EXCEPTION_CLASS = '22'

const SQLITE_CALLER_INPUT_RESULT_CODES = {
  SQLITE_MISMATCH: 'data-exception',
  SQLITE_CONSTRAINT_DATATYPE: 'data-exception',
} satisfies Record<string, CallerInputRejectionClass>

interface DialectDriverMarkers {
  readonly isDriverError: (node: DriverErrorLike) => boolean
  readonly constraintOf: (node: DriverErrorLike) => ConstraintViolationClass | undefined
  readonly callerInputOf: (node: DriverErrorLike) => CallerInputRejectionClass | undefined
}

const asCode = (node: DriverErrorLike): string | undefined =>
  typeof node.code === 'string' ? node.code : undefined

const DIALECT_DRIVER_MARKERS = {
  postgres: {
    isDriverError: (node) => node.name === 'PostgresError' || readSqlState(node) !== undefined,
    constraintOf: (node) => {
      const sqlState = readSqlState(node)
      return sqlState === undefined
        ? undefined
        : (POSTGRES_SQLSTATE_CONSTRAINTS as Record<string, ConstraintViolationClass | undefined>)[
            sqlState
          ]
    },
    callerInputOf: (node) => {
      const sqlState = readSqlState(node)
      if (sqlState === undefined) return undefined
      if (sqlState.startsWith(POSTGRES_DATA_EXCEPTION_CLASS)) return 'data-exception'
      return (
        POSTGRES_CALLER_INPUT_SQLSTATES as Record<string, CallerInputRejectionClass | undefined>
      )[sqlState]
    },
  },
  sqlite: {
    isDriverError: (node) =>
      node.name === 'SQLiteError' || (asCode(node)?.startsWith('SQLITE_') ?? false),
    constraintOf: (node) => {
      const code = asCode(node)
      return code === undefined
        ? undefined
        : (SQLITE_RESULT_CODE_CONSTRAINTS as Record<string, ConstraintViolationClass | undefined>)[
            code
          ]
    },
    callerInputOf: (node) => {
      const code = asCode(node)
      return code === undefined
        ? undefined
        : (
            SQLITE_CALLER_INPUT_RESULT_CODES as Record<
              string,
              CallerInputRejectionClass | undefined
            >
          )[code]
    },
  },
} satisfies Record<DatabaseDialect, DialectDriverMarkers>

const DRIVER_MARKERS: readonly DialectDriverMarkers[] = Object.values(DIALECT_DRIVER_MARKERS)

const isOrmQueryWrapper = (node: DriverErrorLike): boolean =>
  node.name === 'DrizzleError' || (typeof node.query === 'string' && node.params !== undefined)

const MAX_CAUSE_DEPTH = 8

function collectCauseChain(error: unknown, depth = 0): readonly DriverErrorLike[] {
  if (depth >= MAX_CAUSE_DEPTH || error === null || typeof error !== 'object') return []
  const node = error as DriverErrorLike
  return [node, ...collectCauseChain(node.cause, depth + 1)]
}

function firstMarkerHit<T>(
  chain: readonly DriverErrorLike[],
  pick: (markers: DialectDriverMarkers, node: DriverErrorLike) => T | undefined
): T | undefined {
  return chain
    .flatMap((node) => DRIVER_MARKERS.map((markers) => pick(markers, node)))
    .find((candidate): candidate is T => candidate !== undefined)
}

export function classifyDriverFailure(error: unknown): DriverFailure {
  const chain = collectCauseChain(error)

  const violation = firstMarkerHit(chain, (markers, node) => markers.constraintOf(node))
  if (violation !== undefined) return { origin: 'constraint', violation }

  const rejection = firstMarkerHit(chain, (markers, node) => markers.callerInputOf(node))
  if (rejection !== undefined) return { origin: 'caller-input', rejection }

  const raisedByDriver = chain.some(
    (node) =>
      isOrmQueryWrapper(node) || DRIVER_MARKERS.some((markers) => markers.isDriverError(node))
  )
  return raisedByDriver ? { origin: 'operator' } : { origin: 'application' }
}

export function findConstraintViolation(error: unknown): ConstraintViolationClass | undefined {
  const failure = classifyDriverFailure(error)
  return failure.origin === 'constraint' ? failure.violation : undefined
}

export function isDriverOriginatedFailure(error: unknown): boolean {
  return classifyDriverFailure(error).origin !== 'application'
}
