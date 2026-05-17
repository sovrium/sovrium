/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dynamic Route Registry — Schema-Swap Re-Registration Plumbing
 *
 * When `swapApp(newApp)` replaces the live `App` configuration via
 * `AppRef.swap`, certain Hono routes need to be torn down and rebuilt
 * because they were generated FROM the old App's data shape:
 *
 *   - `/api/tables/:tableId/records` — handlers per user-defined table
 *   - Page handlers driven by `app.pages[]`
 *   - Automation webhook triggers driven by `app.automations[]`
 *
 * The registry is the seam between the application-layer `swapApp`
 * use case and the infrastructure-layer Hono app. Each entry is a pair
 * of pure callbacks:
 *
 *   - `register(newApp, hono)`   — mount routes from the new App
 *   - `unregister(hono)`         — tear down routes from the old App
 *
 * Phase 1 ships **only the registry plumbing** — the actual table-CRUD
 * / page / automation re-registration callbacks are NOT wired up yet.
 * That's a Phase 3 concern (e2e-test-fixer) so the foundation can land
 * without dragging the entire route-rebuilding refactor into worktree A.
 *
 * Until Phase 3 wires concrete entries, `swapApp` calls a registry
 * containing zero entries and the swap is a pure `Ref.set`. The system
 * is fully correct in this state — every per-request handler reads the
 * App via `AppRef.current`, so any handler that just looks up
 * `app.tables[id]` or `app.pages[name]` already sees the new App
 * without re-mounting. Only handlers whose URL PATTERN depends on the
 * App (e.g. one route per page slug) need this registry.
 */

import { Effect, Ref } from 'effect'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * One entry in the dynamic route registry. `name` is for diagnostics;
 * `register` and `unregister` are the lifecycle callbacks.
 */
export interface DynamicRouteEntry {
  readonly name: string
  /**
   * Mount routes derived from `app` onto the live `hono` instance.
   * Should be idempotent — `register(app, hono)` followed by another
   * `register(sameApp, hono)` should not double-mount handlers.
   */
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  readonly register: (app: App, hono: Hono) => void
  /**
   * Tear down routes previously registered. Implementations typically
   * track the routes they own (Hono itself doesn't expose unmounting),
   * so unregister will usually re-create the chain on a fresh sub-app.
   */
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  readonly unregister: (hono: Hono) => void
}

/**
 * Opaque registry handle. Backed by `Ref<readonly DynamicRouteEntry[]>`
 * but consumers interact only via `addEntry`, `entries`, and
 * `replaceAll` — they cannot reach into the underlying Ref.
 */
export interface DynamicRouteRegistry {
  readonly addEntry: (entry: DynamicRouteEntry) => Effect.Effect<void>
  readonly entries: () => Effect.Effect<readonly DynamicRouteEntry[]>
  readonly replaceAll: (entries: readonly DynamicRouteEntry[]) => Effect.Effect<void>
}

/**
 * Construct an empty registry. Each call yields its own Ref so the
 * Hono app, the test fixture, etc. each have isolated state.
 */
export const makeDynamicRouteRegistry = (): Effect.Effect<DynamicRouteRegistry> =>
  Effect.gen(function* () {
    const ref = yield* Ref.make<readonly DynamicRouteEntry[]>([])
    const registry: DynamicRouteRegistry = {
      addEntry: (entry) => Ref.update(ref, (current) => [...current, entry]),
      entries: () => Ref.get(ref),
      replaceAll: (next) => Ref.set(ref, next),
    }
    return registry
  })

/**
 * Re-register every entry in the given registry against the new App.
 * Iterates `unregister(hono)` then `register(newApp, hono)` for each
 * entry, in registration order.
 *
 * Returns an Effect so future logging/metrics around per-entry timing
 * can be added without changing call sites.
 */
export const reRegisterDynamicRoutes = (
  registry: DynamicRouteRegistry,
  newApp: App,
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono types are mutable by library design
  hono: Hono
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const entries = yield* registry.entries()
    // eslint-disable-next-line functional/no-loop-statements -- ordered side-effect dispatch (unregister/register pair per entry)
    for (const entry of entries) {
      entry.unregister(hono)

      entry.register(newApp, hono)
    }
  })
