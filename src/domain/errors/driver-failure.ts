/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DatabaseDialect } from '@/domain/models/env/database/database-dialect'

/**
 * Constraint classes that Sovrium maps to a DISTINCT HTTP status.
 *
 * Closed on purpose: `sanitizeError` maps this union with
 * `satisfies Record<ConstraintViolationClass, ErrorCode>`, so adding a member
 * here fails to compile until the new class is given a status. That is the
 * whole point — the previous heuristic silently answered "unique constraint"
 * for anything carrying a constraint name, and silently answered nothing at
 * all on SQLite.
 */
export type ConstraintViolationClass = 'unique' | 'check' | 'foreign-key' | 'not-null'

/**
 * THE client-safe wording for each constraint class. One table, no second copy.
 *
 * Never derived from the driver's own message: SQLite echoes the CHECK
 * expression and the `<table>.<column>` a NOT NULL rejection names, Postgres
 * echoes the constraint name, and drizzle wraps both in `Failed query: <SQL>
 * params: <bound values>` — all of which disclose schema, and the last of which
 * also replays the caller's own submitted values (standing rule S4).
 *
 * It lives in the DOMAIN rather than beside the HTTP sanitizer because "what may
 * we tell a client about a constraint failure" is a policy about the failure,
 * not about the transport. Two layers need it: the API boundary answers with it
 * when a driver failure reaches `sanitizeError`, and the batch write path — which
 * catches the driver error deep inside a transaction, where it must convert to a
 * typed failure immediately — answers with it there. Only the HTTP STATUS for
 * each class stays in the presentation layer.
 *
 * `satisfies Record<ConstraintViolationClass, string>` is load-bearing: adding a
 * constraint class fails to compile until it has been given wording, so a new
 * class can never fall through to echoing the driver.
 */
export const CONSTRAINT_MESSAGES = {
  unique: 'Resource already exists',
  check: 'A submitted value is not allowed by this resource',
  'foreign-key': 'A submitted value references a resource that does not exist',
  'not-null': 'A required value is missing',
} satisfies Record<ConstraintViolationClass, string>

/**
 * Ways the database rejects the CALLER'S OWN INPUT — a field that does not
 * exist, or a literal it cannot parse into the column's type.
 *
 * Split out of the driver bucket because collapsing them into "infrastructure"
 * pages the operator for ordinary bad input: scanners and bots posting garbage
 * into record-id path segments produce `22P02` indefinitely, and every one of
 * those was an alertable 500. These are client errors and map to 400.
 *
 * They are NOT 404. Answering "not found" for an unparseable id would restore
 * exactly the disguise this module exists to remove — the fault stops being
 * reported as OUR failure without pretending the resource is absent.
 */
export type CallerInputRejectionClass = 'undefined-column' | 'data-exception'

/**
 * Where a thrown value came from, relative to the database driver.
 *
 * - `constraint` — the driver rejected the statement against a declared rule,
 *   and we recognise WHICH rule. Caller error.
 * - `caller-input` — the driver rejected the caller's own field name or value.
 *   Caller error (400), not an operator fault.
 * - `operator` — the driver raised, and it is not the caller's fault (dropped
 *   table, connection loss, resources exhausted) OR we do not recognise the
 *   code at all. This MUST surface as 500 so monitoring alerts, and must never
 *   be disguised as a 404. The unmatched-code DEFAULT lands here deliberately:
 *   an unknown failure belongs on the safe, alertable side.
 * - `application` — the value never came from the driver at all. It is one of
 *   Sovrium's own semantic failures (absent record, permission denial, empty
 *   payload) and the caller decides what it means.
 */
export type DriverFailure =
  | { readonly origin: 'constraint'; readonly violation: ConstraintViolationClass }
  | { readonly origin: 'caller-input'; readonly rejection: CallerInputRejectionClass }
  | { readonly origin: 'operator' }
  | { readonly origin: 'application' }

/** Structural view of any error-like node in a `cause` chain. */
interface DriverErrorLike {
  readonly name?: unknown
  readonly code?: unknown
  readonly errno?: unknown
  readonly query?: unknown
  readonly params?: unknown
  readonly cause?: unknown
  /** PostgreSQL names the violated constraint here; SQLite never does. */
  readonly constraint?: unknown
  /** SQLite carries the constraint name in its wire text instead. */
  readonly message?: unknown
  /** PostgreSQL FK detail: `Key (col)=(value) is not present in table "ref".` */
  readonly detail?: unknown
}

/**
 * PostgreSQL SQLSTATE → constraint class.
 *
 * All four are integrity-constraint-violation (class 23) codes. `23514`
 * (check_violation) is the member the previous heuristic got wrong: Postgres
 * attaches a `constraint` NAME to CHECK and FK violations too, not only to
 * unique violations, so `!!error.constraint` reported a CHECK failure as a
 * uniqueness conflict ("Resource already exists" — false on both halves).
 */
const POSTGRES_SQLSTATE_CONSTRAINTS = {
  '23502': 'not-null',
  '23503': 'foreign-key',
  '23505': 'unique',
  '23514': 'check',
} satisfies Record<string, ConstraintViolationClass>

/**
 * SQLite extended result code → constraint class.
 *
 * Measured against `bun:sqlite` (2026-07-26): every constraint failure carries
 * a `SQLITE_CONSTRAINT_*` string on `code` and an `errno`, and carries NO
 * `constraint` field. Its wire text is upper-case (`UNIQUE constraint failed:
 * t.c`), which is why the previous case-SENSITIVE `message.includes('unique
 * constraint')` test missed every real conflict on the zero-config default
 * engine and answered 500 where the contract says 409.
 */
const SQLITE_RESULT_CODE_CONSTRAINTS = {
  SQLITE_CONSTRAINT_CHECK: 'check',
  SQLITE_CONSTRAINT_FOREIGNKEY: 'foreign-key',
  SQLITE_CONSTRAINT_NOTNULL: 'not-null',
  SQLITE_CONSTRAINT_PRIMARYKEY: 'unique',
  SQLITE_CONSTRAINT_UNIQUE: 'unique',
} satisfies Record<string, ConstraintViolationClass>

/** A SQLSTATE is exactly five upper-case alphanumerics (e.g. `23505`, `42P01`). */
const SQLSTATE_PATTERN = /^[\dA-Z]{5}$/

/**
 * Read the PostgreSQL SQLSTATE off a driver error, whichever property the
 * driver in use puts it on.
 *
 * MEASURED against `bun:sql` (2026-07-26), because this is the detail the
 * previous heuristic got wrong and nothing caught it:
 *
 * ```
 * PostgresError { code: 'ERR_POSTGRES_SERVER_ERROR', errno: '23505', constraint: 'idx_tasks_code' }
 * ```
 *
 * `code` carries a BUN error code, not the SQLSTATE — so the pre-existing
 * `error.code === '23505'` test could never fire on Sovrium's actual Postgres
 * driver. Every 409 the API returned came from the `!!error.constraint`
 * catch-all instead, which is exactly why CHECK violations (which also carry a
 * constraint name) were reported as "Resource already exists".
 *
 * `code` is still consulted second so `pg` / `postgres.js` — which do put the
 * SQLSTATE on `code` — keep working if a driver is ever swapped in.
 */
const readSqlState = (node: DriverErrorLike): string | undefined =>
  [node.errno, node.code].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && SQLSTATE_PATTERN.test(candidate)
  )

/**
 * PostgreSQL SQLSTATEs that mean "the CALLER sent this".
 *
 * Deliberately an ALLOWLIST rather than a "not an operator code" test: that
 * shape structurally guarantees the operator classes — `42P01` undefined_table,
 * class `08` connection exceptions, class `53` insufficient resources, and every
 * code nobody has classified yet — keep falling through to `operator`/500. A
 * denylist would silently demote a new operator fault to a 400 the day Postgres
 * adds a code.
 *
 * Class `22` (data exception) is matched by PREFIX because it is uniformly
 * caller-input: `22P02` invalid_text_representation (`'abc'` into an integer
 * column — the scanner-traffic case), `22003` numeric_value_out_of_range,
 * `22007` invalid_datetime_format, and so on.
 */
const POSTGRES_CALLER_INPUT_SQLSTATES = {
  '42703': 'undefined-column',
} satisfies Record<string, CallerInputRejectionClass>

const POSTGRES_DATA_EXCEPTION_CLASS = '22'

/**
 * SQLite result codes that mean "the CALLER sent this".
 *
 * DELIBERATE DIALECT ASYMMETRY, measured 2026-07-26: SQLite reports BOTH
 * `no such table: x` and `no such column: x` as `SQLiteError` with `errno: 1`
 * and NO `code` at all — they are indistinguishable by result code. So SQLite's
 * undefined-column stays on the `operator` default rather than being separated
 * by message text. That is the safe side (an alertable 500 rather than a 400
 * that could swallow a dropped table), and it is the reason this map is smaller
 * than its Postgres counterpart.
 *
 * The Postgres-only operational problem does not arise on SQLite anyway: a
 * `WHERE id = 'test-record-id'` against an INTEGER key returns zero ROWS on
 * SQLite instead of raising, because SQLite is dynamically typed.
 */
const SQLITE_CALLER_INPUT_RESULT_CODES = {
  SQLITE_MISMATCH: 'data-exception',
  SQLITE_CONSTRAINT_DATATYPE: 'data-exception',
} satisfies Record<string, CallerInputRejectionClass>

/** How a single dialect's driver identifies itself and classifies its failures. */
interface DialectDriverMarkers {
  /** True when this node is an error object raised by THIS dialect's driver. */
  readonly isDriverError: (node: DriverErrorLike) => boolean
  /** The constraint class this node denotes, or `undefined` if it denotes none. */
  readonly constraintOf: (node: DriverErrorLike) => ConstraintViolationClass | undefined
  /** The caller-input rejection this node denotes, or `undefined` if it denotes none. */
  readonly callerInputOf: (node: DriverErrorLike) => CallerInputRejectionClass | undefined
}

const asCode = (node: DriverErrorLike): string | undefined =>
  typeof node.code === 'string' ? node.code : undefined

/**
 * TOTAL per-dialect marker table.
 *
 * `satisfies Record<DatabaseDialect, DialectDriverMarkers>` is load-bearing:
 * adding an engine to `DatabaseDialectType` breaks THIS file at compile time,
 * so a new dialect cannot silently inherit Postgres-shaped assumptions the way
 * SQLite did when it became the default engine.
 *
 * The vocabularies are mutually exclusive (five-char SQLSTATE vs `SQLITE_*`),
 * so classification does not need to know which engine is live — which keeps
 * it correct in mixed-dialect test harnesses and on any future read replica.
 */
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

/**
 * Drizzle's own query wrappers, used as a dialect-independent BACKSTOP.
 *
 * Every statement in the request path goes through drizzle, which rethrows as
 * `DrizzleQueryError` (own `query` + `params` properties, message `Failed
 * query: …`) or `DrizzleError` (`name === 'DrizzleError'`), carrying the real
 * driver error on `cause`. Recognising the wrapper means a driver failure is
 * still classified as infrastructure even if a future driver stops exposing a
 * result code — the safe direction, since the fallback is an alertable 500.
 */
const isOrmQueryWrapper = (node: DriverErrorLike): boolean =>
  node.name === 'DrizzleError' || (typeof node.query === 'string' && node.params !== undefined)

/** Guard against a self-referential `cause` chain. */
const MAX_CAUSE_DEPTH = 8

/**
 * Flatten `error` and its transitive `cause` chain into error-like nodes.
 *
 * The chain matters: the class that reaches the API is a Sovrium wrapper
 * (`DatabaseError`), the drizzle wrapper sits under it, and the real
 * driver error — the only node carrying the result code — sits under that.
 */
function collectCauseChain(error: unknown, depth = 0): readonly DriverErrorLike[] {
  if (depth >= MAX_CAUSE_DEPTH || error === null || typeof error !== 'object') return []
  const node = error as DriverErrorLike
  return [node, ...collectCauseChain(node.cause, depth + 1)]
}

/** First non-undefined result of applying `pick` across every node × dialect. */
function firstMarkerHit<T>(
  chain: readonly DriverErrorLike[],
  pick: (markers: DialectDriverMarkers, node: DriverErrorLike) => T | undefined
): T | undefined {
  return chain
    .flatMap((node) => DRIVER_MARKERS.map((markers) => pick(markers, node)))
    .find((candidate): candidate is T => candidate !== undefined)
}

/**
 * Classify any thrown value against the database driver.
 *
 * TOTAL by construction: every input lands in exactly one `DriverFailure` arm.
 *
 * Order is the contract. A recognised constraint wins over a caller-input
 * rejection (a CHECK failure is a declared-rule violation, not a parse error),
 * and both win over the bare "came from a driver" test. Unrecognised driver
 * codes fall to `operator` — an alertable 500 — rather than to a guessed
 * caller-input or constraint class: misreporting an operator fault as a client
 * error is the failure mode this module exists to prevent, in both directions.
 */
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

/**
 * Suffixes Sovrium's own CHECK-constraint generator appends to a column name.
 *
 * Every generated constraint is `check_<column>_<suffix>`
 * (`sql-check-constraints.ts`), which is the whole reason a column name can be
 * recovered from a rejection at all: the name is OURS, not the driver's.
 *
 * `satisfies readonly string[]` is not enough to keep this honest, so the list
 * is asserted against the generator by unit test rather than by the compiler —
 * adding a constraint family without adding it here silently stops naming that
 * family's column, which degrades the message but breaks nothing.
 */
const CHECK_CONSTRAINT_SUFFIXES = [
  'enum',
  'format',
  'range',
  'max_length',
  'max_items',
  'max_files',
] as const

/**
 * Ways each dialect names the NOT-NULL column in prose rather than in a
 * constraint name. Both capture the column in group 1.
 */
const NULL_COLUMN_PATTERNS: readonly RegExp[] = [
  // SQLite: `NOT NULL constraint failed: tasks.title`
  /NOT NULL constraint failed: [^\s.]+\.(\w+)/,
  // PostgreSQL: `null value in column "title" of relation "tasks" …`
  /null value in column "([^"]+)"/,
  // PostgreSQL FK detail: `Key (owner_id)=(7) is not present in table "users".`
  /Key \(([^)]+)\)=/,
]

/** True when `source` — a constraint name or driver message — names `column`. */
function sourceNamesColumn(source: string, column: string): boolean {
  return (
    CHECK_CONSTRAINT_SUFFIXES.some((suffix) => source.includes(`check_${column}_${suffix}`)) ||
    source.includes(`_${column}_fkey`) ||
    source.endsWith(`_${column}_fk`) ||
    NULL_COLUMN_PATTERNS.some((pattern) => pattern.exec(source)?.[1] === column)
  )
}

/**
 * Recover the COLUMN a constraint rejection was about, restricted to columns
 * the caller actually submitted.
 *
 * Recovery is by TRANSLATION, never by re-validating the payload ahead of the
 * write: the column's own constraint stays the single decider, and this only
 * reads back which one fired. The driver hands the name over on `constraint`
 * under PostgreSQL and inside the message text under SQLite, so both are
 * searched across the whole `cause` chain — the real driver error sits two
 * wrappers below the class that reaches the API.
 *
 * `submittedFields` is the S4 guard and is NOT optional. Two things depend on
 * it. First, echoing a column the caller never sent turns an error answer into
 * schema discovery, while naming one they DID send only replays their own
 * input back at them. Second, it is what makes recovery UNAMBIGUOUS: column
 * names may contain underscores, so `check_max_length_enum` cannot be parsed
 * apart on its own — but testing each submitted name against the templates has
 * exactly one answer. Longest candidate first, so a table with both `id` and
 * `user_id` attributes `orders_user_id_fkey` to `user_id`.
 *
 * Returns `undefined` when nothing can be attributed confidently — the caller
 * then answers with the class-level wording and names no field at all, which
 * is the safe direction in both the disclosure and the correctness sense.
 */
export function findConstraintFieldName(
  error: unknown,
  submittedFields: readonly string[]
): string | undefined {
  const sources = collectCauseChain(error).flatMap((node) =>
    [node.constraint, node.message, node.detail].filter(
      (candidate): candidate is string => typeof candidate === 'string'
    )
  )
  if (sources.length === 0) return undefined
  return submittedFields
    .toSorted((a, b) => b.length - a.length)
    .find((column) => sources.some((source) => sourceNamesColumn(source, column)))
}

/**
 * The constraint class `error` denotes, or `undefined` when it denotes none.
 * Convenience over {@link classifyDriverFailure} for the two call sites that
 * only care about one class.
 */
export function findConstraintViolation(error: unknown): ConstraintViolationClass | undefined {
  const failure = classifyDriverFailure(error)
  return failure.origin === 'constraint' ? failure.violation : undefined
}

/**
 * True when `error` was raised by the database driver at all — an operator
 * fault, a constraint rejection, OR a caller-input rejection — and never one of
 * Sovrium's own semantic outcomes.
 *
 * This is the discriminator the API layer was missing. `DatabaseError`
 * is currently overloaded: application programs construct it to mean "absent"
 * or "forbidden", while `wrapDatabaseError` constructs it to wrap a driver
 * failure. Matching on the CLASS NAME therefore read a dropped table as an
 * authorization denial and answered 404. Excluding driver-raised failures
 * first makes the remaining name check sound.
 *
 * Note this spans `caller-input` TOO, on purpose. A malformed id is a 400, not
 * a 404: narrowing this to operator faults alone would let an unparseable id
 * fall back into the authorization branch and re-create the disguise.
 */
export function isDriverOriginatedFailure(error: unknown): boolean {
  return classifyDriverFailure(error).origin !== 'application'
}
