/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `context.log` for a code action: the four levels user code may call, each
 * appending one entry to the step's log in call order. The entries leave the
 * sandbox on the action's outcome and are redacted with the rest of the step
 * before they are persisted, so a secret logged by user code never reaches
 * run history in clear.
 */

import type { StepLogEntry } from './shared'

/** Render one logged argument: strings verbatim, anything else as JSON. */
const renderArgument = (argument: unknown): string => {
  if (typeof argument === 'string') return argument
  if (argument instanceof Error) return argument.message
  try {
    return JSON.stringify(argument) ?? String(argument)
  } catch {
    return String(argument)
  }
}

/** Longest message kept per entry — a runaway log must not bloat run history. */
const MAX_MESSAGE_LENGTH = 2000

/** Most entries kept per step, for the same reason. */
const MAX_ENTRIES = 200

/**
 * A fresh collector: the `log` object handed to user code, and a reader for
 * the entries it gathered.
 */
export const createCodeLogCollector = (): {
  readonly log: Readonly<Record<StepLogEntry['level'], (...args: ReadonlyArray<unknown>) => void>>
  readonly entries: () => readonly StepLogEntry[]
} => {
  // A mutable buffer is the point: user code calls `context.log.*` as a side
  // effect from inside the sandbox, and the only way to observe those calls
  // afterwards is to record them somewhere the caller can read back.
  // eslint-disable-next-line functional/prefer-immutable-types -- the collector's buffer; see above
  const buffer: StepLogEntry[] = []
  const append =
    (level: StepLogEntry['level']) =>
    (...args: ReadonlyArray<unknown>): void => {
      if (buffer.length >= MAX_ENTRIES) return
      const message = args.map(renderArgument).join(' ').slice(0, MAX_MESSAGE_LENGTH)
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- the collector's buffer; see above
      buffer.push({ level, message })
    }
  return {
    log: {
      debug: append('debug'),
      info: append('info'),
      warn: append('warn'),
      error: append('error'),
    },
    entries: () => [...buffer],
  }
}
