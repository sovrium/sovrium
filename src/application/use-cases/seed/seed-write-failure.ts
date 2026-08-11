/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Explain a rejected seed row: which FIELD, which VALUE, and why.
 *
 * ## The defect this exists to close
 *
 * A rejected row used to report `Failed to create record in companies` — the
 * message of the outermost `DatabaseError` wrapper. The real reason was never
 * missing; it sat on `.cause` and was discarded. A template author then had to
 * bisect a data set field-by-field with throwaway seed files to find out which
 * value the database objected to. A refusal that is CORRECT and unactionable
 * still costs the ten minutes.
 *
 * ## What this does NOT do
 *
 * It does not validate. The database decides, through the CHECK constraints
 * `sql-check-constraints.ts` generated from the very same field config read
 * here. This module only ATTRIBUTES a rejection the driver has already made:
 * the driver names the constraint, Sovrium generated that constraint's name
 * from a field name, and the seed run still holds the value it submitted for
 * that field. Nothing here re-decides validity, so nothing here can disagree
 * with the rule that actually fired.
 *
 * A pre-flight check against `options` / `min` / `max` was the tempting
 * alternative and it is a second decoder: it would drift from the DDL the
 * moment either side changed, and its failure mode is refusing a row the
 * database would have accepted.
 *
 * ## Why the raw driver reason is always appended
 *
 * The friendly half is derived from config, so a config/DDL divergence could in
 * principle make it inaccurate. Carrying the driver's own sentence alongside it
 * means the ground truth is never lost, and a wrong explanation is visibly
 * wrong instead of quietly authoritative.
 *
 * ## Why this is not in `domain/errors/driver-failure.ts`
 *
 * That module deliberately never derives wording from a driver message —
 * SQLite echoes the CHECK expression, Postgres echoes the constraint name, and
 * drizzle's wrapper replays the SQL *and the bound parameter values* (standing
 * rule S4). That policy is right for the API boundary, where the reader is an
 * untrusted client. Here the reader is the operator seeding their own files
 * from their own terminal, and their own values are exactly what they need
 * back. Keeping the message-deriving code out of that module keeps the two
 * disclosure rules from sitting next to each other and being imported by
 * mistake. The drizzle wrapper is skipped regardless — it is noise, not signal.
 */

import { findConstraintViolation } from '@/domain/errors/driver-failure'
import type { SeedField, SeedTableConfig } from './seed-config'

/** Structural view of one node in an error `cause` chain. */
interface ErrorNode {
  readonly name?: unknown
  readonly message?: unknown
  readonly code?: unknown
  readonly constraint?: unknown
  readonly query?: unknown
  readonly params?: unknown
  readonly cause?: unknown
}

/** Guard against a self-referential `cause` chain. */
const MAX_CAUSE_DEPTH = 8

const causeChain = (error: unknown, depth = 0): readonly ErrorNode[] => {
  if (depth >= MAX_CAUSE_DEPTH || error === null || typeof error !== 'object') return []
  const node = error as ErrorNode
  return [node, ...causeChain(node.cause, depth + 1)]
}

/**
 * Drizzle's query wrapper — `Failed query: <SQL> params: <bound values>`.
 *
 * Skipped on both dialects: it is the least readable node in the chain and the
 * only one that replays the whole statement.
 */
const isOrmWrapper = (node: ErrorNode): boolean =>
  typeof node.query === 'string' && node.params !== undefined

/** The node the DATABASE DRIVER raised, as opposed to a wrapper around it. */
const isDriverNode = (node: ErrorNode): boolean =>
  node.name === 'PostgresError' ||
  node.name === 'SQLiteError' ||
  typeof node.constraint === 'string' ||
  (typeof node.code === 'string' && node.code.startsWith('SQLITE_'))

const messageOf = (node: ErrorNode | undefined): string | undefined =>
  typeof node?.message === 'string' && node.message.length > 0 ? node.message : undefined

/**
 * The constraint the driver named.
 *
 * Postgres puts it on `.constraint`; SQLite only says
 * `CHECK constraint failed: check_size_enum`, so the trailing identifier is
 * read off the message. Attribution is best-effort by design — an unreadable
 * name simply means no field is named, never a wrong field.
 */
const constraintNameOf = (node: ErrorNode | undefined): string | undefined => {
  if (typeof node?.constraint === 'string' && node.constraint.length > 0) return node.constraint
  const tail = messageOf(node)?.split(': ').at(-1)?.trim()
  return tail !== undefined && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tail) ? tail : undefined
}

/**
 * The declared field a generated constraint name refers to.
 *
 * Sovrium builds these names itself (`check_<field>_range`,
 * `check_<field>_enum`, `<table>_<column>_fkey`), so this reads its own
 * convention rather than guessing. Matching is by whole `_`-delimited segment
 * and resolves to the LONGEST match, so `check_annual_revenue_range` picks
 * `annual_revenue` over a sibling field named `revenue`. Ambiguity yields
 * nothing rather than a coin flip.
 */
const attributeField = (
  constraintName: string | undefined,
  table: SeedTableConfig | undefined
): SeedField | undefined => {
  if (constraintName === undefined || table === undefined) return undefined
  const padded = `_${constraintName}_`
  const matches = table.fields.filter((field) => padded.includes(`_${field.name}_`))
  const longest = matches.reduce<SeedField | undefined>(
    (best, field) => (best === undefined || field.name.length > best.name.length ? field : best),
    undefined
  )
  const ties = matches.filter((field) => field.name.length === longest?.name.length)
  return ties.length === 1 ? longest : undefined
}

/** Declared option values, flattening the `{ value }` object form. */
const optionValues = (field: SeedField): readonly string[] =>
  (field.options ?? []).flatMap((option) =>
    typeof option === 'string' ? [option] : option.value === undefined ? [] : [option.value]
  )

/** Render a submitted value so its TYPE is visible: `201` is not `"201-1000"`. */
const renderValue = (value: unknown): string => {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * The expectation the field's own config declares.
 *
 * Purely descriptive. The numeric branch compares against `min`/`max` only to
 * pick which half of the declared range to name — the database already decided
 * the value was out of it.
 */
const rangeExpectation = (field: SeedField, value: unknown): string | undefined => {
  const { min, max } = field
  const bounded = typeof min === 'number' || typeof max === 'number'
  if (!bounded) return undefined
  // A non-numeric value becomes NaN, which compares false against both bounds
  // and so falls through to the neutral sentence rather than claiming a side.
  const numeric = typeof value === 'number' ? value : Number.NaN
  if (typeof max === 'number' && numeric > max) {
    return `is above the maximum of ${max} for this ${field.type} field`
  }
  if (typeof min === 'number' && numeric < min) {
    return `is below the minimum of ${min} for this ${field.type} field`
  }
  return `is outside the range this ${field.type} field accepts (${min ?? '-'}..${max ?? '-'})`
}

const expectationFor = (field: SeedField, value: unknown): string | undefined => {
  const options = optionValues(field)
  return options.length > 0
    ? `is not one of the declared options (${options.map((option) => `'${option}'`).join(', ')})`
    : rangeExpectation(field, value)
}

/**
 * A number handed to a field whose declared options are all strings.
 *
 * This is a type observation, not a pattern guess: `size: 201-1000` unquoted is
 * valid YAML for the NUMBER 201, so the seed file looks right and the value is
 * wrong. Naming the type mismatch is what turns the option list from a hint
 * into an answer.
 */
const coercionHint = (field: SeedField, value: unknown): string | undefined =>
  typeof value === 'number' && optionValues(field).length > 0
    ? ' — the submitted value is a number; quote it in YAML to keep it a string'
    : undefined

/** What the seed run submitted for the row the database rejected. */
export interface RejectedRow {
  readonly table: SeedTableConfig | undefined
  readonly fields: Readonly<Record<string, unknown>>
}

/**
 * One line naming the field, the value and the reason — falling back to the
 * driver's own sentence, and finally to the wrapper message, so the operator is
 * never told less than they are told today.
 */
export const explainWriteFailure = (error: unknown, row: RejectedRow): string => {
  const chain = causeChain(error)
  const driverNode = chain.find((node) => isDriverNode(node))
  const reason =
    messageOf(driverNode) ??
    messageOf(chain.find((node) => !isOrmWrapper(node) && node !== chain[0])) ??
    messageOf(chain[0]) ??
    String(error)

  if (findConstraintViolation(error) === undefined) return reason

  const field = attributeField(constraintNameOf(driverNode), row.table)
  if (field === undefined || !(field.name in row.fields)) return reason

  const value = row.fields[field.name]
  const expectation = expectationFor(field, value) ?? 'was rejected by this field'
  return (
    `field "${field.name}" — ${renderValue(value)} ${expectation}` +
    `${coercionHint(field, value) ?? ''} [${reason}]`
  )
}
