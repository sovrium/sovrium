/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a chat turn keeps of the tool calls it ran.
 *
 * An answer is stored with one line per call: which action ran, how it ended,
 * the table it named and how many rows it answered. Never the call's
 * arguments — they may hold what the person typed, a secret included, and a
 * redaction by key name would miss one typed into a free-text argument — and
 * never its result, which is the rows themselves. Storing neither is the only
 * rule that cannot leak.
 *
 * The console's conversation read adds each call's `tableLabel` from the app
 * as it is declared now ({@link withTableLabels}), so a renamed table reads by
 * its new label.
 */

/** How a call ended, as the agent runtime reports it. */
export type StoredToolCallOutcome =
  'ok' | 'denied' | 'failed' | 'pending-approval' | 'pending-input'

/** One call as an answer stores it. */
export interface StoredToolCall {
  readonly id: string
  readonly name: string
  readonly outcome: StoredToolCallOutcome
  /** The declared table the call named, when it named one. */
  readonly table?: string
  /** How many rows the call answered, when it answered rows. */
  readonly rowCount?: number
}

/** One resolved call, as the turn holds it: its result is read, never kept. */
export interface ToolCallResultSource {
  readonly id: string
  readonly name: string
  readonly outcome: StoredToolCallOutcome
  /** What the model was handed as the call's result. */
  readonly content: string
  readonly table?: string | undefined
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The result text as JSON, or `undefined` when it is prose (a refusal, an error). */
const parsedResult = (content: string): unknown => {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

/**
 * How many rows a call's result answered: the length of a list it answered
 * (`records`, or the result itself), one for a single `record`, and
 * `undefined` for a result that holds no rows — a count, a write's id, prose.
 */
export const rowCountOf = (content: string): number | undefined => {
  const result = parsedResult(content)
  if (Array.isArray(result)) return result.length
  if (!isRecord(result)) return undefined
  const { records, record } = result
  if (Array.isArray(records)) return records.length
  return isRecord(record) ? 1 : undefined
}

/** The line one call is stored as: what ran, how it ended, where, how many rows. */
const storedToolCall = (result: ToolCallResultSource): StoredToolCall => {
  const rowCount = result.outcome === 'ok' ? rowCountOf(result.content) : undefined
  return {
    id: result.id,
    name: result.name,
    outcome: result.outcome,
    ...(result.table === undefined ? {} : { table: result.table }),
    ...(rowCount === undefined ? {} : { rowCount }),
  }
}

/** The lines a turn's calls are stored as, in the order they ran. */
export const storedToolCalls = (
  results: ReadonlyArray<ToolCallResultSource>
): ReadonlyArray<StoredToolCall> => results.map(storedToolCall)

/**
 * A stored `tool_calls` value with each call that names a table labelled by
 * `labelOf`. Anything else — a call naming no table, a table the app no longer
 * declares, a value that is not a list — is answered as it was stored.
 */
export const withTableLabels = (
  toolCalls: unknown,
  labelOf: (table: string) => string | undefined
): unknown => {
  if (!Array.isArray(toolCalls)) return toolCalls
  return toolCalls.map((call: unknown) => {
    if (!isRecord(call) || typeof call['table'] !== 'string') return call
    const tableLabel = labelOf(call['table'])
    return tableLabel === undefined ? call : { ...call, tableLabel }
  })
}

/**
 * The stored calls with `toolLabel` added to each call `labelOf` names: what a
 * reader calls the tool (the console phrases it in the operator's language). A
 * call `labelOf` leaves unnamed keeps only its stored `name`, which is never
 * changed; a payload that is not a list passes through untouched.
 */
export const withToolLabels = (
  toolCalls: unknown,
  labelOf: (name: string) => string | undefined
): unknown => {
  if (!Array.isArray(toolCalls)) return toolCalls
  return toolCalls.map((call: unknown) => {
    if (!isRecord(call) || typeof call['name'] !== 'string') return call
    const toolLabel = labelOf(call['name'])
    return toolLabel === undefined ? call : { ...call, toolLabel }
  })
}
