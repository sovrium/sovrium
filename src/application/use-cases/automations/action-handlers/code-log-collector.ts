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

import { MutableRef } from 'effect'
import type { StepLogEntry } from './shared'

/** Render one logged argument: strings verbatim, anything else as JSON. */
export const renderArgument = (argument: unknown): string => {
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
  // A cell is the point: user code calls `context.log.*` as a side effect from
  // inside the sandbox, synchronously, and the only way to observe those calls
  // afterwards is to record them somewhere the caller can read back. Each entry
  // replaces the list, never edits it.
  const buffer = MutableRef.make<readonly StepLogEntry[]>([])
  const append =
    (level: StepLogEntry['level']) =>
    (...args: ReadonlyArray<unknown>) =>
      MutableRef.update(buffer, (entries) =>
        entries.length >= MAX_ENTRIES
          ? entries
          : [
              ...entries,
              { level, message: args.map(renderArgument).join(' ').slice(0, MAX_MESSAGE_LENGTH) },
            ]
      )
  return {
    log: {
      debug: append('debug'),
      info: append('info'),
      warn: append('warn'),
      error: append('error'),
    },
    entries: () => MutableRef.get(buffer),
  }
}
