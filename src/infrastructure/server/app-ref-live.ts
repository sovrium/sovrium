/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Ref } from 'effect'
import { AppRef } from '@/application/ports/services/app-ref'
import type { App } from '@/domain/models/app'

/**
 * AppRef Live Layer
 *
 * Builds an `AppRef` Layer backed by an internal `Ref<App>` initialised
 * with the provided `initialApp`. The `Ref` is created lazily inside
 * the Layer so each Layer construction yields its own isolated Ref
 * (enabling per-test fixtures and per-server-instance state).
 *
 * Boot order at server startup:
 *
 *   1. CLI loads + validates the App config from disk (or env / built-in
 *      bootstrap-mode default).
 *   2. `start-server.ts` calls `createAppRefLayer(initialApp)`.
 *   3. The Hono app is built with `Effect.provide(appRefLayer)`.
 *   4. Per-request handlers `yield* AppRef` and read `current` for the
 *      live App snapshot — they no longer close over the original
 *      `App` parameter, so a future `swap(newApp)` is observed
 *      immediately on the next request.
 *
 * The port deliberately exposes only `current` and `swap` — callers
 * cannot reach into the underlying `Ref` and mutate it bypassing the
 * `swapApp` use case (which fires post-swap callbacks like dynamic
 * route re-registration).
 *
 * @param initialApp the App to seed the Ref with at boot
 * @public
 */
export const createAppRefLayer = (initialApp: App): Layer.Layer<AppRef> =>
  Layer.effect(
    AppRef,
    Effect.gen(function* () {
      const ref = yield* Ref.make<App>(initialApp)
      return AppRef.of({
        current: Ref.get(ref),
        swap: (newApp: App) => Ref.set(ref, newApp),
      })
    })
  )
