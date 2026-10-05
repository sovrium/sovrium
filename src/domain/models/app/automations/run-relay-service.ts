/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The relay of a run: which run handed it its trigger data.
 *
 * A call (`automation:call`) and a failure handler (`automation-failure`) start
 * a run whose trigger data is what another run handed on. That data was read
 * with the engine's authority, so who may read it is judged by what the run
 * that handed it on had read before handing it on — its trigger data and its
 * first `through` steps. The relay records that run by id, never a value.
 *
 * A run whose data came from outside the app — a replay an admin supplied new
 * trigger data for — records `outside`: nobody's authority read it, so it is
 * shown as captured.
 */

/** Which run fed this one, and how many of its steps had run when it did. */
export type RunRelay =
  { readonly run: string; readonly through: number } | { readonly outside: true }

/** How many runs back a relay is followed before it is withheld. */
export const RELAY_MAX_HOPS = 10

/** How many records the runs of a relay may have read before it is withheld. */
export const RELAY_MAX_RECORDS = 1000

/** The relay of a run fed by `run` once its first `through` steps had run. */
export const relayFrom = (run: string, through: number): RunRelay => ({
  run,
  through: Math.max(0, Math.floor(through)),
})

/** The relay of a run whose trigger data came from outside the app. */
export const OUTSIDE_RELAY: RunRelay = { outside: true }

/** A relay as persisted, or `undefined` when the run recorded none. */
export const parseRelay = (value: unknown): RunRelay | undefined => {
  if (value === null || typeof value !== 'object') return undefined
  const relay = value as {
    readonly run?: unknown
    readonly through?: unknown
    readonly outside?: unknown
  }
  if (relay.outside === true) return OUTSIDE_RELAY
  if (typeof relay.run !== 'string' || relay.run === '') return undefined
  const through = typeof relay.through === 'number' ? relay.through : 0
  return relayFrom(relay.run, through)
}

/**
 * True when a run of this trigger type is started by another run, which
 * hands it its trigger data: a call or a failure handler.
 */
export const isRelayedTriggerType = (type: string | undefined): boolean =>
  type === 'automation-call' || type === 'automation-failure'
