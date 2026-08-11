/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { App } from '@/domain/models/app'

/**
 * AppRef — Mutable In-Memory App Reference
 *
 * Provides a runtime-swappable handle to the active App configuration.
 * Backed internally by `Effect.Ref<App>` (see `src/infrastructure/server/app-ref-live.ts`),
 * but the port intentionally narrows the surface to two operations:
 *
 *   - `current`: read the currently-live App
 *   - `swap(newApp)`: atomically replace the live App
 *
 * Why a port (not just `Ref<App>` directly)?
 *
 *  1. Layer-architecture rule: the application layer must depend only on
 *     ports it owns, not on a specific Effect primitive. A future migration
 *     to a different storage strategy (e.g. distributed config) is a
 *     drop-in Layer change.
 *  2. Test seam: tests can provide a Layer that returns a fixed App from
 *     `current` without instantiating a real Ref.
 *  3. Encapsulation: callers cannot accidentally mutate the Ref outside
 *     the documented `swap` flow (no `Ref.modify`, no `Ref.update`).
 *
 * The post-swap callback chain (re-registering dynamic routes, etc.) is
 * the responsibility of the `swapApp` use case, not of this port.
 */
export class AppRef extends Context.Tag('AppRef')<
  AppRef,
  {
    /** Read the currently-active App snapshot. Always succeeds. */
    readonly current: Effect.Effect<App>
    /**
     * Atomically replace the live App with `newApp`. The caller is
     * responsible for validating `newApp` against `AppSchema` BEFORE
     * invoking swap — the port itself does not validate.
     */
    readonly swap: (newApp: App) => Effect.Effect<void>
  }
>() {}
