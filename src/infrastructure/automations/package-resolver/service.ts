/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { PackageResolutionError } from './errors'

/**
 * Output of `resolveAll` — read-only map of bare package name (without
 * version pin) to its imported module value. Used by the `code` action
 * runtime executor in place of a per-call dynamic `import()`.
 */
export type ResolvedPackages = ReadonlyMap<string, unknown>

/**
 * Effect Context.Tag exposing the package resolution service. Provided by
 * `PackageResolverLive` (see `layer.ts`); consumed at server startup by
 * `startServer` and at runtime by the code action handler.
 */
export class PackageResolver extends Context.Tag('PackageResolver')<
  PackageResolver,
  {
    /**
     * Walk the validated app config, collect every unique package
     * specifier from all `code` actions' `packages: []`, dynamically
     * import each, and cache the resolved Map by config-hash.
     *
     * The HTTP listener does NOT bind unless this Effect succeeds — any
     * resolution failure short-circuits server startup with a
     * `PackageResolutionError`.
     */
    readonly resolveAll: (app: unknown) => Effect.Effect<ResolvedPackages, PackageResolutionError>

    /**
     * Look up an already-resolved package by its bare name (without
     * version pin). Returns `undefined` when the package was not declared
     * in any `code` action — the runtime executor surfaces that as a
     * sandbox `PackageNotDeclared` error.
     */
    readonly lookup: (name: string) => unknown | undefined

    /**
     * Number of cache hits vs cold resolutions, exposed so reproducibility
     * tests can assert "the second startServerWithSchema call with the
     * same packages array reused the cache".
     */
    readonly cacheHitCount: () => number
  }
>() {}
