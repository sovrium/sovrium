/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build a GitHub dependency-submission snapshot from the lockfiles the tree ships.
 *
 * ## Why this exists
 *
 * GitHub's dependency graph reads this repository's manifests by STATIC
 * analysis, and static analysis has two blind spots here:
 *
 *   1. It does not read `bun.lock`, so for npm it knows only the ranges written
 *      in `package.json` (direct dependencies, no transitive ones).
 *   2. It can stop re-parsing. On the public repository the static graph stayed
 *      frozen on one release's manifests for several releases afterwards, while
 *      every pushed `package.json` named newer pins. Dependabot alerts are
 *      computed from the graph, so an alert opened against the old pin never
 *      closed, although the shipped tree was patched.
 *
 * A submitted snapshot fixes both. GitHub shows one entry per manifest path,
 * and a user submission takes precedence over static analysis for the same
 * path, so submitting `desktop/package.json` here replaces whatever the static
 * parser last stored for it. The snapshot carries exact versions resolved from
 * the lockfile, transitive dependencies included.
 *
 * ## What this file does, and what it does not
 *
 * It is pure: it reads the lockfiles and writes the snapshot JSON. It never
 * talks to GitHub. The release workflow posts the file with
 * `gh api --method POST repos/<owner>/<repo>/dependency-graph/snapshots`.
 *
 * Every release submits again under the same correlator, which replaces the
 * previous snapshot. If the submission ever stops, the submitted data goes
 * stale in turn and still outranks static analysis, so the job must keep
 * running on every release.
 *
 * ## Fail closed
 *
 * A missing lockfile, an unknown lockfile version, or a direct dependency that
 * the lockfile does not resolve exits 1. A snapshot that quietly omitted a
 * manifest would leave the stale static data in charge without saying so.
 *
 * Usage:
 *   bun run scripts/build/build-dependency-snapshot.ts --sha <commit> \
 *     [--ref refs/heads/main] [--job-id <id>] [--out <file>]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ── Snapshot shape (GitHub dependency submission API, version 0) ──

export type Relationship = 'direct' | 'indirect'
export type Scope = 'runtime' | 'development'

export interface ResolvedDependency {
  readonly package_url: string
  readonly relationship: Relationship
  readonly scope: Scope
  readonly dependencies: readonly string[]
}

export interface SnapshotManifest {
  readonly name: string
  readonly file: { readonly source_location: string }
  readonly resolved: Readonly<Record<string, ResolvedDependency>>
}

export interface Snapshot {
  readonly version: 0
  readonly sha: string
  readonly ref: string
  readonly job: { readonly correlator: string; readonly id: string }
  readonly detector: { readonly name: string; readonly version: string; readonly url: string }
  readonly scanned: string
  readonly manifests: Readonly<Record<string, SnapshotManifest>>
}

/** One correlator for every release: a new submission replaces the last. */
export const SNAPSHOT_CORRELATOR = 'sovrium-release/lockfile-snapshot'

/**
 * The manifests submitted, each keyed by the path GitHub's static graph uses
 * for it, so the submission supersedes that entry. All of them ship in the
 * public tree; a missing one is an error, never a skip.
 */
export const SNAPSHOT_SOURCES = [
  { manifest: 'package.json', lockfile: 'bun.lock', kind: 'bun' },
  { manifest: 'desktop/package.json', lockfile: 'desktop/bun.lock', kind: 'bun' },
  {
    manifest: 'desktop/src-tauri/Cargo.lock',
    lockfile: 'desktop/src-tauri/Cargo.lock',
    kind: 'cargo',
  },
] as const

// ── Shared helpers ──

interface Node {
  readonly purl: string
  direct: boolean
  runtime: boolean
  readonly dependencies: Set<string>
}

/** `pkg:npm/%40scope/name@1.2.3` — the namespace's `@` is percent-encoded. */
export const npmPurl = (name: string, version: string): string =>
  `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`

export const cargoPurl = (name: string, version: string): string => `pkg:cargo/${name}@${version}`

const isRegistryVersion = (version: string): boolean => /^\d/.test(version)

function toManifest(path: string, nodes: ReadonlyMap<string, Node>): SnapshotManifest {
  const resolved: Record<string, ResolvedDependency> = {}
  for (const key of [...nodes.keys()].sort()) {
    const node = nodes.get(key)!
    resolved[key] = {
      package_url: node.purl,
      relationship: node.direct ? 'direct' : 'indirect',
      scope: node.runtime ? 'runtime' : 'development',
      dependencies: [...node.dependencies].filter((dep) => nodes.has(dep)).sort(),
    }
  }
  return { name: path, file: { source_location: path }, resolved }
}

// ── bun.lock (text lockfile) ──

type DepMap = Readonly<Record<string, string>>

interface BunWorkspace {
  readonly dependencies?: DepMap
  readonly devDependencies?: DepMap
  readonly optionalDependencies?: DepMap
  readonly peerDependencies?: DepMap
}

interface BunPackageInfo {
  readonly dependencies?: DepMap
  readonly optionalDependencies?: DepMap
  readonly peerDependencies?: DepMap
}

export interface BunLock {
  readonly lockfileVersion: number
  readonly workspaces: Readonly<Record<string, BunWorkspace>>
  readonly packages: Readonly<Record<string, readonly unknown[]>>
}

/**
 * The text-lockfile versions whose `workspaces` / `packages` shape this reader
 * was checked against (the root tree is on 1, `desktop/` on 2). A new version
 * fails the run so the reader is re-checked rather than trusted.
 */
export const SUPPORTED_BUN_LOCKFILE_VERSIONS: readonly number[] = [1, 2]

/** `@babel/core/semver` → `['@babel/core', 'semver']`. */
const keySegments = (key: string): readonly string[] => {
  const parts = key.split('/')
  const segments: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (part.startsWith('@') && i + 1 < parts.length) {
      segments.push(`${part}/${parts[i + 1]}`)
      i++
    } else {
      segments.push(part)
    }
  }
  return segments
}

/**
 * Bun nests a non-hoisted copy under its dependent's key (`parent/child`).
 * A dependency named `dep` of the package at `key` therefore resolves to the
 * nearest of `key/dep`, `parent-of-key/dep`, … `dep`.
 */
export function resolveBunKey(
  packages: BunLock['packages'],
  fromKey: string,
  dep: string
): string | undefined {
  const segments = keySegments(fromKey)
  for (let depth = segments.length; depth >= 0; depth--) {
    const candidate = [...segments.slice(0, depth), dep].join('/')
    if (candidate in packages) return candidate
  }
  return undefined
}

/** `vite@8.3.5` / `@tauri-apps/api@2.12.4` → name and version. */
const splitSpec = (spec: string): { readonly name: string; readonly version: string } => {
  const at = spec.lastIndexOf('@')
  if (at <= 0) throw new Error(`Unreadable bun.lock package spec: ${spec}`)
  return { name: spec.slice(0, at), version: spec.slice(at + 1) }
}

export function npmManifestFromBunLock(manifestPath: string, lock: BunLock): SnapshotManifest {
  if (!SUPPORTED_BUN_LOCKFILE_VERSIONS.includes(lock.lockfileVersion)) {
    throw new Error(
      `${manifestPath}: unsupported bun.lock lockfileVersion ${String(lock.lockfileVersion)}`
    )
  }
  const root = lock.workspaces['']
  if (root === undefined) throw new Error(`${manifestPath}: bun.lock has no root workspace`)

  const nodes = new Map<string, Node>()
  const nodeKeyOf = new Map<string, string | null>()

  // Lock key → snapshot key (`name@version`), or null for a non-registry entry.
  const nodeFor = (lockKey: string): string | null => {
    const cached = nodeKeyOf.get(lockKey)
    if (cached !== undefined) return cached
    const entry = lock.packages[lockKey]
    const spec = entry?.[0]
    if (typeof spec !== 'string')
      throw new TypeError(`${manifestPath}: bun.lock entry ${lockKey} has no spec`)
    const { name, version } = splitSpec(spec)
    const id = isRegistryVersion(version) ? `${name}@${version}` : null
    if (id !== null && !nodes.has(id)) {
      nodes.set(id, {
        purl: npmPurl(name, version),
        direct: false,
        runtime: false,
        dependencies: new Set(),
      })
    }
    nodeKeyOf.set(lockKey, id)
    return id
  }

  const infoOf = (lockKey: string): BunPackageInfo => {
    const entry = lock.packages[lockKey] ?? []
    const info = entry.find((item, i) => i > 0 && typeof item === 'object' && item !== null)
    return (info ?? {}) as BunPackageInfo
  }

  // Walk from each direct dependency, once per scope, so a package reachable
  // from any runtime dependency is runtime and the rest development.
  const walk = (startKey: string, runtime: boolean): void => {
    const seen = new Set<string>()
    const queue = [startKey]
    while (queue.length > 0) {
      const lockKey = queue.shift()!
      if (seen.has(lockKey)) continue
      seen.add(lockKey)
      const id = nodeFor(lockKey)
      if (id !== null && runtime) nodes.get(id)!.runtime = true
      const info = infoOf(lockKey)
      const deps = {
        ...info.peerDependencies,
        ...info.optionalDependencies,
        ...info.dependencies,
      }
      for (const dep of Object.keys(deps)) {
        const childKey = resolveBunKey(lock.packages, lockKey, dep)
        // Optional and peer dependencies may legitimately be absent.
        if (childKey === undefined) continue
        const childId = nodeFor(childKey)
        if (id !== null && childId !== null && childId !== id)
          nodes.get(id)!.dependencies.add(childId)
        queue.push(childKey)
      }
    }
  }

  const groups: readonly (readonly [DepMap | undefined, boolean, boolean])[] = [
    // [map, runtime, required]
    [root.dependencies, true, true],
    [root.optionalDependencies, true, false],
    [root.peerDependencies, true, false],
    [root.devDependencies, false, true],
  ]
  for (const [map, runtime, required] of groups) {
    for (const dep of Object.keys(map ?? {})) {
      if (!(dep in lock.packages)) {
        if (required)
          throw new Error(
            `${manifestPath}: direct dependency ${dep} is not resolved in its bun.lock`
          )
        continue
      }
      const id = nodeFor(dep)
      if (id !== null) nodes.get(id)!.direct = true
      walk(dep, runtime)
    }
  }
  return toManifest(manifestPath, nodes)
}

// ── Cargo.lock ──

interface CargoPackage {
  readonly name: string
  readonly version: string
  readonly source?: string
  readonly dependencies?: readonly string[]
}

export interface CargoLock {
  readonly package?: readonly CargoPackage[]
}

const cargoId = (p: CargoPackage): string => `${p.name}@${p.version}`
const isRegistry = (p: CargoPackage): boolean => p.source?.startsWith('registry+') === true

export function cargoManifestFromCargoLock(
  manifestPath: string,
  lock: CargoLock
): SnapshotManifest {
  const packages = lock.package ?? []
  if (packages.length === 0) throw new Error(`${manifestPath}: Cargo.lock lists no packages`)

  // A dependency entry is `name`, `name version` or `name version (source)`.
  const find = (entry: string): CargoPackage | undefined => {
    const [name, version] = entry.split(' ')
    const matches = packages.filter(
      (p) => p.name === name && (version === undefined || p.version === version)
    )
    return matches.length === 1 ? matches[0] : undefined
  }
  const nodes = new Map<string, Node>()
  for (const p of packages.filter(isRegistry)) {
    nodes.set(cargoId(p), {
      purl: cargoPurl(p.name, p.version),
      direct: false,
      runtime: true,
      dependencies: new Set(),
    })
  }
  for (const p of packages) {
    const resolved = (p.dependencies ?? []).map((entry) => {
      const dep = find(entry)
      if (dep === undefined)
        throw new Error(`${manifestPath}: cannot resolve ${entry} (needed by ${p.name})`)
      return dep
    })
    if (p.source === undefined) {
      // A workspace member: its registry dependencies are the direct ones.
      for (const dep of resolved.filter(isRegistry)) nodes.get(cargoId(dep))!.direct = true
    } else if (isRegistry(p)) {
      for (const dep of resolved.filter(isRegistry))
        nodes.get(cargoId(p))!.dependencies.add(cargoId(dep))
    }
  }
  return toManifest(manifestPath, nodes)
}

// ── Assembly ──

export interface SnapshotInput {
  readonly sha: string
  readonly ref: string
  readonly jobId: string
  readonly scanned: string
  readonly manifests: readonly SnapshotManifest[]
}

export function buildSnapshot(input: SnapshotInput): Snapshot {
  if (!/^[0-9a-f]{40}$/.test(input.sha))
    throw new Error(`--sha must be a full 40-hex commit id, got: ${input.sha}`)
  if (!input.ref.startsWith('refs/'))
    throw new Error(`--ref must be fully qualified (refs/heads/…), got: ${input.ref}`)
  const manifests: Record<string, SnapshotManifest> = {}
  for (const manifest of input.manifests) manifests[manifest.name] = manifest
  return {
    version: 0,
    sha: input.sha,
    ref: input.ref,
    job: { correlator: SNAPSHOT_CORRELATOR, id: input.jobId },
    detector: {
      name: 'sovrium-lockfile-snapshot',
      version: '1',
      url: 'https://github.com/sovrium/sovrium/blob/main/scripts/build/build-dependency-snapshot.ts',
    },
    scanned: input.scanned,
    manifests,
  }
}

export function readManifests(root: string): readonly SnapshotManifest[] {
  return SNAPSHOT_SOURCES.map(({ manifest, lockfile, kind }) => {
    const path = join(root, lockfile)
    if (!existsSync(path))
      throw new Error(`${lockfile} not found; refusing to submit a snapshot without ${manifest}`)
    const text = readFileSync(path, 'utf8')
    return kind === 'bun'
      ? npmManifestFromBunLock(manifest, Bun.JSONC.parse(text) as BunLock)
      : cargoManifestFromCargoLock(manifest, Bun.TOML.parse(text) as CargoLock)
  })
}

function argValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    const sha = argValue(args, '--sha') ?? process.env.GITHUB_SHA ?? ''
    const snapshot = buildSnapshot({
      sha,
      ref: argValue(args, '--ref') ?? 'refs/heads/main',
      jobId: argValue(args, '--job-id') ?? process.env.GITHUB_RUN_ID ?? 'local',
      scanned: new Date().toISOString(),
      manifests: readManifests(join(import.meta.dir, '..', '..')),
    })
    const json = `${JSON.stringify(snapshot)}\n`
    const out = argValue(args, '--out')
    if (out === undefined) {
      process.stdout.write(json)
    } else {
      writeFileSync(out, json)
    }
    for (const manifest of Object.values(snapshot.manifests)) {
      const count = Object.keys(manifest.resolved).length
      process.stderr.write(`${manifest.name}: ${count} resolved packages\n`)
    }
  } catch (error) {
    process.stderr.write(
      `build-dependency-snapshot: ${error instanceof Error ? error.message : String(error)}\n`
    )
    process.exit(1)
  }
}
