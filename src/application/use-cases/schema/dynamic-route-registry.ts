/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Ref } from 'effect'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export interface DynamicRouteEntry {
  readonly name: string
  readonly register: (app: App, hono: Hono) => void
  readonly unregister: (hono: Hono) => void
}

export interface DynamicRouteRegistry {
  readonly addEntry: (entry: DynamicRouteEntry) => Effect.Effect<void>
  readonly entries: () => Effect.Effect<readonly DynamicRouteEntry[]>
  readonly replaceAll: (entries: readonly DynamicRouteEntry[]) => Effect.Effect<void>
}

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

export const reRegisterDynamicRoutes = (
  registry: DynamicRouteRegistry,
  newApp: App,
  hono: Hono
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const entries = yield* registry.entries()
    for (const entry of entries) {
      entry.unregister(hono)

      entry.register(newApp, hono)
    }
  })
