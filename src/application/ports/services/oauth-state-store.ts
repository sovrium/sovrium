/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Error for OAuth state-store operations.
 *
 * Currently only used for unexpected internal failures — the public
 * `consume` returns `undefined` for unknown/expired states (the
 * indistinguishability is intentional, see `consume` docstring) rather
 * than failing the Effect.
 */
export class OAuthStateError extends Data.TaggedError('OAuthStateError')<{
  readonly cause: unknown
}> {}

/**
 * Companion data stored alongside an OAuth `state` value during the
 * authorization-code flow's authorize→callback hop.
 *
 * `expiresAt` is set by the store at write time (`Date.now() + TTL`);
 * callers do not provide it on `save`.
 */
export interface OAuthStateEntry {
  readonly connectionName: string
  readonly userId: string
  readonly codeVerifier: string | undefined
  readonly redirectUri: string
  readonly expiresAt: number
}

/**
 * OAuth State Store Port.
 *
 * In-memory `state` store with TTL for the OAuth2 authorization-code
 * flow. The state must survive the single authorize→callback hop within
 * one server process; persisting to the database would widen the surface
 * area without buying anything because the data is short-lived and
 * single-use.
 *
 * Implementation in `src/infrastructure/connections/oauth-state-store-live.ts`.
 *
 * The Live impl keeps a module-level Map of state values; this is the
 * deliberate design (per-process state for OAuth's per-process flow).
 * Per-process Maps are also used by `infrastructure/realtime/channel-manager.ts`
 * and `infrastructure/server/route-setup/auth-route-utils.ts` for similar
 * short-lived state.
 */
export class OAuthStateStore extends Context.Tag('OAuthStateStore')<
  OAuthStateStore,
  {
    /**
     * Save a fresh state token. The store appends an absolute `expiresAt`
     * timestamp using the configured TTL.
     */
    readonly save: (
      state: string,
      entry: Omit<OAuthStateEntry, 'expiresAt'>
    ) => Effect.Effect<void, OAuthStateError>

    /**
     * Consume (read-and-delete) a state token. Returns `undefined` when
     * the state is unknown OR expired — callers MUST treat both as
     * indistinguishable to avoid leaking information about which states
     * have been issued.
     */
    readonly consume: (state: string) => Effect.Effect<OAuthStateEntry | undefined, OAuthStateError>

    /**
     * Test-only utility: clear all stored states. Used by specs that
     * exercise multiple OAuth flows in one server process.
     */
    readonly clear: () => Effect.Effect<void, OAuthStateError>
  }
>() {}
