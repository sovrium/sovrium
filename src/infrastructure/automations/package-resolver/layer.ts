/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { PackageResolutionError } from './errors'
import { PackageResolver, type ResolvedPackages } from './service'

/**
 * Strip a version pin from a package specifier. `lodash@4.17.21` ->
 * `lodash`; `@scope/pkg@1.2.3` -> `@scope/pkg`. Mirrors the runtime
 * helper in `application/use-cases/automations/action-handlers/code.ts`
 * so both layers agree on the bare name used as the lookup key.
 */
const stripVersionPin = (spec: string): string => {
  if (spec.startsWith('@')) {
    const slash = spec.indexOf('/')
    if (slash === -1) return spec
    const tail = spec.slice(slash + 1)
    const at = tail.indexOf('@')
    return at === -1 ? spec : `${spec.slice(0, slash + 1)}${tail.slice(0, at)}`
  }
  const at = spec.indexOf('@')
  return at === -1 ? spec : spec.slice(0, at)
}

/**
 * Recursively walk an unknown config value collecting every string
 * appearing inside a `packages: [...]` array nested anywhere under a
 * `type: 'code'` action. Implemented via reduce over a fresh
 * accumulator so the walk stays free of mutation hazards while still
 * handling deeply-nested `path`/`loop` containers.
 */
const collectCodeActionPackages = (root: unknown): ReadonlyArray<string> => {
  const visit = (node: unknown): ReadonlyArray<string> => {
    if (node === null || node === undefined) return []
    if (Array.isArray(node)) {
      return node.flatMap(visit)
    }
    if (typeof node !== 'object') return []
    const obj = node as Record<string, unknown>
    const ownPackages =
      obj['type'] === 'code' &&
      obj['props'] !== null &&
      typeof obj['props'] === 'object' &&
      Array.isArray((obj['props'] as Record<string, unknown>)['packages'])
        ? ((obj['props'] as Record<string, unknown>)['packages'] as ReadonlyArray<unknown>).filter(
            (p): p is string => typeof p === 'string'
          )
        : []
    const childPackages = Object.values(obj).flatMap(visit)
    return [...ownPackages, ...childPackages]
  }
  return visit(root)
}

/**
 * Stable hash of a sorted unique-package list — the cache key for
 * `resolveAll`. Using the JSON of the sorted array keeps the hash
 * deterministic across config edits that re-order but don't change the
 * underlying set of packages.
 */
const hashPackageSet = (packages: ReadonlyArray<string>): string => {
  const unique = [...new Set(packages)]
  const sorted = [...unique].toSorted()
  return JSON.stringify(sorted)
}

/**
 * Resolve a single declared package spec into a [bareName, module]
 * tuple. Surfaced at module scope so it can be created once rather than
 * on every `resolveAll` invocation.
 */
const resolveSinglePackage = (
  spec: string
): Effect.Effect<readonly [string, unknown], PackageResolutionError> => {
  const name = stripVersionPin(spec)
  return Effect.tryPromise({
    try: async () => {
      const mod = (await import(name)) as { default?: unknown } & Record<string, unknown>
      const value = mod.default ?? mod
      return [name, value] as const
    },
    catch: (cause) => new PackageResolutionError({ pkg: spec, cause }),
  })
}

/**
 * Live PackageResolver implementation. Holds an in-process cache keyed
 * by the sorted unique-package set hash so consecutive
 * `startServerWithSchema(sameApp)` calls re-use the previous resolution
 * (Map identity preserved). Cache entries are never evicted — package
 * resolutions don't go stale within a process lifetime.
 */
// Process-scoped state lifted to module scope so EVERY materialization of
// `PackageResolverLive` (e.g. `app-layer.ts` for startup, `runtime-layer.ts`
// for webhook handlers) shares the SAME cache. Without this, startup would
// resolve into one closure's Map and webhook lookups would hit a different
// closure's empty Map — defeating the startup-resolution guarantee.
// eslint-disable-next-line functional/prefer-immutable-types -- intentional mutable holder for cache state
const cache: { current: Map<string, ResolvedPackages> } = { current: new Map() }
// eslint-disable-next-line functional/prefer-immutable-types -- intentional mutable holder for live lookup
const resolved: { current: Map<string, unknown> } = { current: new Map() }
// eslint-disable-next-line functional/prefer-immutable-types -- counter for telemetry
const stats: { hits: number } = { hits: 0 }

export const PackageResolverLive = Layer.effect(
  PackageResolver,
  Effect.sync(() => {
    return PackageResolver.of({
      resolveAll: (app) =>
        Effect.gen(function* () {
          const declared = collectCodeActionPackages(app)
          const key = hashPackageSet(declared)
          const cached = cache.current.get(key)
          if (cached !== undefined) {
            // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- counter increment
            stats.hits += 1
            // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- reset live lookup pointer
            resolved.current = new Map(cached)
            return cached
          }
          const unique = [...new Set(declared)]
          const entries = yield* Effect.all(unique.map(resolveSinglePackage), {
            concurrency: 'unbounded',
          })
          const map: ResolvedPackages = new Map(entries)
          // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- cache set
          cache.current.set(key, map)
          // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- update live lookup
          resolved.current = new Map(map)
          return map
        }),
      lookup: (name) => resolved.current.get(name),
      cacheHitCount: () => stats.hits,
    })
  })
)
