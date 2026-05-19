/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { PackageResolutionError } from './errors'
import { PackageResolver, type ResolvedPackages } from './service'

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

const hashPackageSet = (packages: ReadonlyArray<string>): string => {
  const unique = [...new Set(packages)]
  const sorted = [...unique].toSorted()
  return JSON.stringify(sorted)
}

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

const cache: { current: Map<string, ResolvedPackages> } = { current: new Map() }
const resolved: { current: Map<string, unknown> } = { current: new Map() }
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
            stats.hits += 1
            resolved.current = new Map(cached)
            return cached
          }
          const unique = [...new Set(declared)]
          const entries = yield* Effect.all(unique.map(resolveSinglePackage), {
            concurrency: 'unbounded',
          })
          const map: ResolvedPackages = new Map(entries)
          cache.current.set(key, map)
          resolved.current = new Map(map)
          return map
        }),
      lookup: (name) => resolved.current.get(name),
      cacheHitCount: () => stats.hits,
    })
  })
)
