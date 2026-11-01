/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReadState, ReadStateGate } from './components/read-state-gate'

/**
 * The two computations a read-state gate needs, shared by the server, which
 * draws the button as it stands before any read (`loading`), and the browser,
 * which redraws it after each read. Pure and import-free beyond types, so the
 * browser chunk that applies the gates carries no schema.
 */

/**
 * The state of several reads taken together, as a channel combines its
 * subscribers: `failed` if any failed, else `loading` if any has not settled
 * (or none has announced yet), else `nonEmpty` if any holds a row, else `empty`.
 */
export const combineReadStates = (states: readonly ReadState[]): ReadState =>
  states.includes('failed')
    ? 'failed'
    : states.length === 0 || states.includes('loading')
      ? 'loading'
      : states.includes('nonEmpty')
        ? 'nonEmpty'
        : 'empty'

/** Whether `gate` holds while its source is in `state`. */
export const readGateHolds = (gate: ReadStateGate, state: ReadState): boolean =>
  (typeof gate.state === 'string' ? [gate.state] : gate.state).includes(state)

/**
 * The state of a settled read: `failed` when it was refused or unanswered,
 * else by its row count. `undefined` while no read has settled, which keeps
 * whatever state was announced before.
 */
export const settledReadState = (
  failed: boolean,
  rows: number | undefined
): ReadState | undefined => {
  if (failed) return 'failed'
  if (rows === undefined) return undefined
  return rows > 0 ? 'nonEmpty' : 'empty'
}
