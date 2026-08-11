/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live-App store — a module-level handle to the currently-active App
 * configuration.
 *
 * Config is code-only: the live App is whatever was loaded from the
 * `app.ts` / `app.yaml` file at boot. There is no runtime config-mutation
 * surface, so the store is never written to and `getLiveApp` always returns
 * `undefined` — readers (the routes that previously cared about a published
 * live schema, e.g. `/api/health`) therefore fall back to the boot App they
 * were constructed with.
 *
 * The accessor is retained as a stable seam so those callers do not need to
 * branch on whether a live-App concept exists. It returns a loosely-typed
 * `App`-shaped record so this infrastructure helper does not have to import
 * the recursive `App` type.
 */

/** The minimal shape the live-App store and its readers rely on. */
export interface LiveAppShape {
  readonly name: string
  readonly [key: string]: unknown
}

/**
 * Read the currently-live App. Always `undefined` under config-code-only —
 * callers fall back to the boot App. Retained as a stable accessor seam.
 */
export const getLiveApp = (): LiveAppShape | undefined => undefined
