/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: the desktop app's third-party notices.
 *
 * The desktop shell (`desktop/`, [internal ref]) ships two dependency trees the engine
 * binary does not: the Rust crates of its Tauri host, and the npm packages its
 * webview front end is bundled from. This writes one plain-text file,
 * `licenses/desktop/THIRD-PARTY-NOTICES.txt`, attributing every one of them
 * with its version, its copyright line(s) and its license text, identical texts
 * printed once. `tauri.conf.json` bundles `licenses/` as a resource, so the
 * installer carries it; the public mirror carries it too.
 *
 * ## Inputs
 *
 *   - Crates: `cargo metadata --format-version 1 --locked` (cargo is already
 *     the desktop toolchain, so no new tool), walked from the root over NORMAL
 *     dependencies only — build and dev dependencies never reach the bundle —
 *     and across EVERY target, so the one file covers the macOS, Windows and
 *     Linux installers alike. Each crate's own license file(s) are read from
 *     its source directory in the cargo registry.
 *   - Front end: `desktop/package.json` `dependencies`, walked through
 *     `desktop/node_modules` the same way the engine's closure is.
 *   - A dependency that ships no license file is attributed from
 * `licenses/supplements/`;
 *     one with neither fails the run — never an empty notice.
 *
 * ## Freshness without cargo
 *
 * The file's header records the sha256 of every input that decides its
 * content (both lockfiles, `desktop/package.json`, the supplements table and
 * this generator). `Third-Party License Drift` recomputes them, so a lockfile
 * bump without a regeneration fails the gate on a machine with no Rust
 * toolchain at all — the CI quality job, for one.
 *
 * Two of those inputs also carry the desktop app's OWN version — the
 * `"version"` of `desktop/package.json` and the `sovrium-desktop` block of
 * `Cargo.lock` — and every release rewrites both (`sync-desktop-version.ts`)
 * on a runner with no cargo to regenerate this file. That number decides
 * nothing here (the root crate is Sovrium's own code and is never attributed),
 * so it is normalised out before hashing, with the SAME anchored rewrites the
 * release uses: a version-only bump leaves
 * every hash unchanged, while any dependency change still moves one. A file
 * those rewrites cannot anchor in is hashed raw, which reads as stale — loud,
 * never silently current.
 *
 *   bun run build:desktop-notices           (needs cargo + `bun install --cwd desktop`)
 *   bun run build:desktop-notices --check   (exit 1 when the committed file is stale)
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as Effect from 'effect/Effect'
import { printStderr } from '@/infrastructure/logging/cli-output'
import {
  DESKTOP_CARGO_LOCK,
  DESKTOP_PACKAGE_JSON,
  rewriteCargoLockVersion,
  rewriteJsonVersion,
} from '../lib/desktop-version'
import { REPO_ROOT } from '../lib/drift/walk'
import { CommandServiceLive, spawn } from '../lib/effect/command-service'
import { bytesToLf, sameIgnoringCrlf } from '../lib/line-endings'
import { LICENSE_SUPPLEMENTS } from '../lib/third-party-license-supplements'
import {
  classifyLicense,
  groupNotices,
  resolveNotice,
  walkProductionClosure,
  type AttributedComponent,
} from '../lib/third-party-licenses'

/** Where the file lives, relative to the repository root. */
export const DESKTOP_NOTICES_PATH = 'licenses/desktop/THIRD-PARTY-NOTICES.txt'

/** The inputs whose bytes decide the file, in header order. */
export const DESKTOP_NOTICE_INPUTS = [
  'desktop/src-tauri/Cargo.lock',
  'desktop/package.json',
  'desktop/bun.lock',
  'scripts/lib/third-party-license-supplements.ts',
  'scripts/lib/third-party-licenses.ts',
  'scripts/build/generate-desktop-notices.ts',
] as const

/** The placeholder the app's own version is rewritten to before hashing. */
export const NORMALISED_VERSION = '0.0.0'

/** Inputs carrying the desktop app's own version, and how to normalise it out. */
const VERSION_NORMALISERS: ReadonlyMap<string, (content: string) => string> = new Map([
  [
    DESKTOP_PACKAGE_JSON,
    (content: string) => rewriteJsonVersion(content, NORMALISED_VERSION, DESKTOP_PACKAGE_JSON),
  ],
  [DESKTOP_CARGO_LOCK, (content: string) => rewriteCargoLockVersion(content, NORMALISED_VERSION)],
])

/**
 * The bytes of one input as they are hashed: CRLF folded to LF first, then the
 * app's own version normalised out where the input carries it — and the
 * LF-folded bytes alone when the version normaliser cannot anchor, so a
 * malformed manifest reads stale.
 *
 * The fold comes first and applies to every input, because a Windows checkout
 * under `core.autocrlf` hands back all six as CRLF: unfolded, every recorded
 * hash moves and the version rewrites (anchored on `\n`) stop matching, on a
 * tree whose content nobody changed. On an LF tree the fold is the identity, so
 * the hashes the committed header records do not move.
 */
export const hashableContent = (path: string, bytes: Buffer): Buffer => {
  const lf = bytesToLf(bytes)
  const normalise = VERSION_NORMALISERS.get(path)
  if (normalise === undefined) return lf
  try {
    return Buffer.from(normalise(lf.toString('utf8')), 'utf8')
  } catch {
    return lf
  }
}

/** `sha256` of each input, as the header records it. */
export const hashInputs = (
  root: string
): readonly { readonly path: string; readonly sha256: string }[] =>
  DESKTOP_NOTICE_INPUTS.map((path) => ({
    path,
    sha256: existsSync(join(root, path))
      ? createHash('sha256')
          .update(hashableContent(path, readFileSync(join(root, path))))
          .digest('hex')
      : 'missing',
  }))

/**
 * Whether the committed file matches the rendered one, its CRLF folded: the
 * rendered side is always LF (every text it embeds is read through
 * `readTextLf`), so a Windows checkout's line endings are not a content change,
 * while an edited text or a moved hash still is.
 */
export const isDesktopNoticesCurrent = (committed: string, rendered: string): boolean =>
  sameIgnoringCrlf(committed, rendered)

/** The `input:` lines a committed file's header carries. */
export const parseRecordedInputs = (text: string): ReadonlyMap<string, string> =>
  new Map(
    [...text.matchAll(/^input: (\S+) sha256=(\S+)$/gm)].map(
      (m) => [m[1] ?? '', m[2] ?? ''] as const
    )
  )

interface CargoPackage {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly license: string | null
  readonly manifest_path: string
  readonly source: string | null
}

interface CargoMetadata {
  readonly packages: readonly CargoPackage[]
  readonly resolve: {
    readonly root: string
    readonly nodes: readonly {
      readonly id: string
      readonly deps: readonly {
        readonly pkg: string
        readonly dep_kinds: readonly { readonly kind: string | null }[]
      }[]
    }[]
  }
}

/** The crates a desktop build links: normal dependencies of the root, every target. */
export const shippedCrates = (metadata: CargoMetadata): readonly CargoPackage[] => {
  const packages = new Map(metadata.packages.map((p) => [p.id, p] as const))
  const nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n] as const))
  const seen = new Set<string>()
  const queue = [metadata.resolve.root]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (seen.has(id)) continue
    seen.add(id)
    for (const dep of nodes.get(id)?.deps ?? []) {
      if (dep.dep_kinds.some((kind) => kind.kind === null)) queue.push(dep.pkg)
    }
  }
  seen.delete(metadata.resolve.root)
  return [...seen].flatMap((id) => {
    const pkg = packages.get(id)
    // A path dependency (`source: null`) is Sovrium's own code, not a third party.
    return pkg === undefined || pkg.source === null ? [] : [pkg]
  })
}

/** Thrown when a dependency cannot be attributed. */
export class DesktopNoticesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesktopNoticesError'
  }
}

interface Tagged extends AttributedComponent {
  readonly ecosystem: 'cargo' | 'npm'
}

/** Attribute every crate and front-end package, or throw naming what failed. */
export const attributeDesktop = (root: string, metadata: CargoMetadata): readonly Tagged[] => {
  const supplements = join(root, 'licenses', 'supplements')
  const failures: string[] = []
  const crates = shippedCrates(metadata).flatMap((crate): Tagged[] => {
    const license = crate.license ?? undefined
    if (classifyLicense(license) === 'unknown') {
      failures.push(
        `cargo ${crate.name}@${crate.version}: license not classifiable (${license ?? 'none'})`
      )
    }
    const found = resolveNotice('cargo', crate.name, dirname(crate.manifest_path), supplements)
    if (found === undefined) {
      failures.push(`cargo ${crate.name}@${crate.version}: no license file and no supplement`)
      return []
    }
    return [
      {
        ecosystem: 'cargo',
        name: crate.name,
        version: crate.version,
        declared: license ?? 'UNKNOWN',
        notice: found.notice,
      },
    ]
  })
  const front = walkProductionClosure(join(root, 'desktop')).flatMap((pkg): Tagged[] => {
    if (classifyLicense(pkg.license) === 'unknown') {
      failures.push(
        `npm ${pkg.name}@${pkg.version}: license not classifiable (${pkg.license ?? 'none'})`
      )
    }
    const found = resolveNotice('npm', pkg.name, pkg.dir, supplements)
    if (found === undefined) {
      failures.push(`npm ${pkg.name}@${pkg.version}: no license file and no supplement`)
      return []
    }
    return [
      {
        ecosystem: 'npm',
        name: pkg.name,
        version: pkg.version,
        declared: pkg.license ?? 'UNKNOWN',
        notice: found.notice,
      },
    ]
  })
  const crateNames = new Set(crates.map((c) => c.name))
  for (const row of LICENSE_SUPPLEMENTS.filter((r) => r.ecosystem === 'cargo')) {
    const unused = row.packages.filter((name) => !crateNames.has(name))
    if (unused.length > 0)
      failures.push(`supplement for crate(s) no longer in the graph: ${unused.join(', ')}`)
  }
  if (failures.length > 0) {
    throw new DesktopNoticesError(
      [`${failures.length} desktop dependency problem(s):`, ...failures.map((f) => `  ${f}`)].join(
        '\n'
      )
    )
  }
  return [...crates, ...front]
}

/** The file, as the exact bytes to commit. */
export const renderDesktopNotices = (root: string, components: readonly Tagged[]): string => {
  const ecosystemOf = new Map(
    components.map((c) => [`${c.name}@${c.version}`, c.ecosystem] as const)
  )
  const grouped = groupNotices(components)
  const cargo = grouped.components.filter(
    (c) => ecosystemOf.get(`${c.name}@${c.version}`) === 'cargo'
  )
  const groups = grouped.texts
    .map((text) => ({ ...text, members: grouped.components.filter((c) => c.textId === text.id) }))
    .toSorted((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id, 'en'))
  return [
    'Sovrium desktop app — third-party notices',
    '',
    'The desktop app bundles the Sovrium engine (run `sovrium licenses` for its own',
    'notices) inside a Tauri shell. This file attributes the shell: its Rust crates',
    'and the npm packages its window is built from. Each license text is printed once,',
    'after the components it covers, each with its version and copyright line(s).',
    '',
    `Rust crates: ${cargo.length}; front-end npm packages: ${grouped.components.length - cargo.length}; distinct license texts: ${groups.length}.`,
    '',
    'Generated by scripts/build/generate-desktop-notices.ts from (the app version',
    'normalised out of desktop/package.json and Cargo.lock, so a release bump keeps it current):',
    ...hashInputs(root).map((input) => `input: ${input.path} sha256=${input.sha256}`),
    '',
    ...groups.flatMap((group, index) => [
      // A blank line above each heading, never a ruled line (terminal language T14).
      '',
      `Text ${index + 1} of ${groups.length} — ${[...new Set(group.members.map((m) => m.spdx))].sort().join(', ')}`,
      '',
      ...group.members.map(
        (m) =>
          `- [${ecosystemOf.get(`${m.name}@${m.version}`) === 'cargo' ? 'crate' : 'npm'}] ${m.name} ${m.version}${m.copyright.length === 0 ? '' : ` — ${m.copyright.join('; ')}`}`
      ),
      '',
      group.text,
      '',
    ]),
  ].join('\n')
}

const cargoMetadata = (root: string): Effect.Effect<CargoMetadata, unknown> =>
  spawn(
    [
      'cargo',
      'metadata',
      '--format-version',
      '1',
      '--locked',
      '--manifest-path',
      join(root, 'desktop', 'src-tauri', 'Cargo.toml'),
    ],
    { timeout: 300_000 }
  ).pipe(
    Effect.map((result) => JSON.parse(result.stdout) as CargoMetadata),
    Effect.provide(CommandServiceLive)
  )

const main = (argv: readonly string[]): Effect.Effect<number, unknown> =>
  Effect.gen(function* () {
    if (!existsSync(join(REPO_ROOT, 'desktop', 'node_modules'))) {
      throw new DesktopNoticesError(
        'desktop/node_modules is absent — run `bun install --cwd desktop` first.'
      )
    }
    const metadata = yield* cargoMetadata(REPO_ROOT)
    const rendered = renderDesktopNotices(REPO_ROOT, attributeDesktop(REPO_ROOT, metadata))
    const target = join(REPO_ROOT, DESKTOP_NOTICES_PATH)
    const summary = rendered.split('\n').find((line) => line.startsWith('Rust crates:')) ?? ''
    if (argv.includes('--check')) {
      const committed = existsSync(target) ? readFileSync(target, 'utf8') : ''
      if (!isDesktopNoticesCurrent(committed, rendered)) {
        console.log(
          `${DESKTOP_NOTICES_PATH} is stale — run \`bun run build:desktop-notices\` and commit it.`
        )
        return 1
      }
      console.log(`${DESKTOP_NOTICES_PATH} is current — ${summary}`)
      return 0
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, rendered)
    console.log(`${DESKTOP_NOTICES_PATH} — ${summary} ${Buffer.byteLength(rendered)} bytes`)
    return 0
  })

if (import.meta.main) {
  Effect.runPromise(main(process.argv.slice(2))).then(
    (code) => process.exit(code),
    (error: unknown) => {
      printStderr(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  )
}
