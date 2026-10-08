/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an automation step reports when a record write is refused: which
 * column, and why.
 *
 * `Failed to create record in windows` is correct and unactionable — the real
 * reason sits on the driver error at the bottom of the `cause` chain. The step
 * reports this in its run history (redacted, operator-only), so an item a loop
 * tolerated still says which column refused it and why, without the operator
 * bisecting the data by hand.
 *
 * It is built HERE, not on the error the write path raises, because that
 * error's message also answers a public form submitter: the driver's sentence
 * echoes values and names relations, and never reaches a client (S4).
 *
 * This only ATTRIBUTES a refusal the database has already made; it never
 * decides validity.
 */

interface ErrorNode {
  readonly message?: unknown
  readonly fieldName?: unknown
  readonly query?: unknown
  readonly params?: unknown
  readonly cause?: unknown
}

const MAX_CAUSE_DEPTH = 8

const causeChain = (error: unknown, depth = 0): readonly ErrorNode[] => {
  if (depth >= MAX_CAUSE_DEPTH || error === null || typeof error !== 'object') return []
  const node = error as ErrorNode
  return [node, ...causeChain(node.cause, depth + 1)]
}

/** Drizzle's `Failed query: <SQL> params: <values>` wrapper: noise, never the reason. */
const isOrmWrapper = (node: ErrorNode): boolean =>
  typeof node.query === 'string' && node.params !== undefined

/** The innermost readable message in the chain: the driver's own sentence. */
const driverReason = (error: unknown): string | undefined =>
  causeChain(error)
    .slice(1)
    .filter((node) => !isOrmWrapper(node))
    .map((node) => node.message)
    .filter((message): message is string => typeof message === 'string' && message.length > 0)
    .at(-1)

/**
 * The submitted column whose value the driver echoed back (PostgreSQL's
 * `invalid input syntax for type …: "<value>"` names the value, not the
 * column). Only an unambiguous match names a column — never a guess.
 */
const columnOfEchoedValue = (
  reason: string,
  fields: Readonly<Record<string, unknown>>
): string | undefined => {
  const echoed = /: "(.*)"$/.exec(reason)?.[1]
  if (echoed === undefined) return undefined
  const matches = Object.entries(fields).filter(
    ([, value]) =>
      (typeof value === 'string' || typeof value === 'number') && String(value) === echoed
  )
  return matches.length === 1 ? matches[0]?.[0] : undefined
}

/**
 * The refused write's own message, followed — when the driver said why — by
 * the column it refused (when it can be told) and the driver's reason.
 */
export const describeWriteFailure = (
  failure: unknown,
  fields: Readonly<Record<string, unknown>>
): string => {
  const base = failure instanceof Error ? failure.message : String(failure)
  const named = (failure as ErrorNode | null)?.fieldName
  const fieldName = typeof named === 'string' ? named : undefined
  const reason = driverReason(failure)
  if (reason === undefined) return fieldName === undefined ? base : `${base}: ${fieldName}`
  const column = fieldName ?? columnOfEchoedValue(reason, fields)
  return column === undefined ? `${base}: ${reason}` : `${base}: ${column} — ${reason}`
}
