/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readSqlState } from './driver-failure'

/**
 * The internal errors that are the OPERATOR'S to fix rather than Sovrium's:
 * their environment, their database, the state of their own services.
 *
 * Only an engine defect offers a bug report. A failure the operator can fix is
 * told its fix instead, because a report would send it to a public tracker and
 * hide what to do. The vocabulary is closed on purpose: adding a code is a
 * compile-checked decision here, never a pattern added at a call site.
 */
export type OperatorFix =
  | 'missing-env'
  | 'invalid-env'
  | 'database-schema-drift'
  | 'database-unreachable'
  | 'database-resources'

/** Every code, in the order the union declares them. */
export const OPERATOR_FIXES = [
  'missing-env',
  'invalid-env',
  'database-schema-drift',
  'database-unreachable',
  'database-resources',
] as const satisfies readonly OperatorFix[]

/**
 * What the operator is told to do for each code, in English, for the terminal
 * and the server's log. The console words its own copy, keyed by the code.
 */
export const OPERATOR_FIX_GUIDANCE = {
  'missing-env': 'Set the environment variable the error names, then start Sovrium again.',
  'invalid-env': 'Correct the environment variable the error names, then start Sovrium again.',
  'database-schema-drift':
    'A table the app declares is missing from its database: restore it, or restart Sovrium so it migrates the schema.',
  'database-unreachable': 'Check the database is running and that DATABASE_URL is right.',
  'database-resources':
    'The database ran out of room: free disk space or connections, or fix the permissions of the database file.',
} satisfies Record<OperatorFix, string>

/** Structural view of one node of a failure chain. */
interface FailureNode {
  readonly _tag?: unknown
  readonly code?: unknown
  readonly errno?: unknown
  readonly message?: unknown
  readonly cause?: unknown
  readonly failure?: unknown
}

/** The tagged errors a boot refuses an environment with, by tag. */
const ENV_TAG_FIXES: Readonly<Record<string, OperatorFix>> = {
  MissingRequiredEnvVarError: 'missing-env',
  InvalidEnvVarError: 'invalid-env',
  InvalidOperatorTimezoneError: 'invalid-env',
}

/**
 * PostgreSQL SQLSTATE CLASSES (first two characters) the operator fixes:
 * `08` connection exception, `28` invalid authorisation (wrong credentials),
 * `53` insufficient resources (disk full, out of memory, too many connections).
 */
const POSTGRES_CLASS_FIXES: Readonly<Record<string, OperatorFix>> = {
  '08': 'database-unreachable',
  '28': 'database-unreachable',
  '53': 'database-resources',
}

/** `42P01` undefined_table: a table the app declares is gone. */
const POSTGRES_UNDEFINED_TABLE = '42P01'

/**
 * Driver and socket codes the operator fixes. `bun:sql` reports a refused or
 * unresolvable host as `ERR_POSTGRES_CONNECTION_REFUSED`; the libuv codes cover
 * the other drivers. `SQLITE_NOTADB` and `SQLITE_CORRUPT` are deliberately
 * absent: Sovrium writes that file, so its corruption may be a defect.
 */
const DRIVER_CODE_FIXES: Readonly<Record<string, OperatorFix>> = {
  ERR_POSTGRES_CONNECTION_REFUSED: 'database-unreachable',
  ECONNREFUSED: 'database-unreachable',
  ENOTFOUND: 'database-unreachable',
  ETIMEDOUT: 'database-unreachable',
  SQLITE_FULL: 'database-resources',
  SQLITE_READONLY: 'database-resources',
  SQLITE_CANTOPEN: 'database-resources',
}

/**
 * SQLite reports a missing table and a missing column with the same result
 * code, so the table is told by its message. Used to CLASSIFY only, never
 * shown: a missing column stays a defect, since it cannot be told from a bad
 * field name.
 */
const SQLITE_NO_SUCH_TABLE = /^no such table: /

/** Guard against a self-referential chain. */
const MAX_DEPTH = 8

/** The failure and everything it wraps, through `cause` and an engine failure's `failure`. */
const chainOf = (error: unknown, depth = 0): readonly FailureNode[] => {
  if (depth >= MAX_DEPTH || error === null || typeof error !== 'object') return []
  const node = error as FailureNode
  return [
    node,
    ...chainOf(node.cause, depth + 1),
    ...(node.failure === undefined ? [] : chainOf(node.failure, depth + 1)),
  ]
}

const codeOf = (node: FailureNode): string | undefined =>
  typeof node.code === 'string' ? node.code : undefined

/** The fix one node of the chain names, if any. */
const fixOfNode = (node: FailureNode): OperatorFix | undefined => {
  if (typeof node._tag === 'string' && Object.hasOwn(ENV_TAG_FIXES, node._tag)) {
    return ENV_TAG_FIXES[node._tag]
  }
  const sqlState = readSqlState(node)
  if (sqlState === POSTGRES_UNDEFINED_TABLE) return 'database-schema-drift'
  const byClass = sqlState === undefined ? undefined : POSTGRES_CLASS_FIXES[sqlState.slice(0, 2)]
  if (byClass !== undefined) return byClass
  const code = codeOf(node)
  if (code !== undefined && Object.hasOwn(DRIVER_CODE_FIXES, code)) return DRIVER_CODE_FIXES[code]
  return typeof node.message === 'string' && SQLITE_NO_SUCH_TABLE.test(node.message)
    ? 'database-schema-drift'
    : undefined
}

/**
 * The fix `error` is the operator's to apply, or `undefined` when it is an
 * engine defect. Walks the whole chain — the class that reaches a boundary is
 * a Sovrium wrapper, and the driver error that decides sits beneath it. The
 * default is a defect: an unrecognised code, an untagged throw.
 */
export const operatorFixOf = (error: unknown): OperatorFix | undefined =>
  chainOf(error)
    .map(fixOfNode)
    .find((fix): fix is OperatorFix => fix !== undefined)

/** Whether `value` is one of the codes, for a value read back from disk. */
export const isOperatorFix = (value: unknown): value is OperatorFix =>
  typeof value === 'string' && (OPERATOR_FIXES as readonly string[]).includes(value)
