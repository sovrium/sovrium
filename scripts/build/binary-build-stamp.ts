/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Freshness signal for the compiled `./sovrium` binary.
 *
 * ## Why a stamp exists at all
 *
 * The `@packaging` spec tier
 * exercises the REAL compiled artifact, and `requireExecutableBinary`
 * hard-throws when `./sovrium` is absent — deliberately,
 * because a missing binary means the build step regressed and must be surfaced
 * rather than skipped. CI satisfies that by building the binary inline; nothing
 * local did, so `bun test:e2e:regression` (which greps `@regression` and therefore
 * sweeps the packaging tier in) failed six specs on every clean checkout.
 *
 * "Does the file exist" is not a sufficient gate, though. A binary compiled
 * before a `src/` change is WORSE than a missing one: the packaging tier would
 * validate a stale artifact and report green. So the gate needs to answer
 * "is this binary current with the tree it was built from", which needs a
 * recorded signal — this stamp.
 *
 * ## Why a content hash and not mtime
 *
 * An mtime comparison (binary mtime vs newest input mtime) is cheaper — roughly
 * 100 ms of `stat` against ~420 ms of hashing, measured on this tree — but it can
 * report a STALE binary as fresh, which is the one failure mode that matters
 * here:
 *
 *   - Any tool that restores file content while preserving timestamps writes
 *     older content under an older mtime (`tar -p`, `rsync -t`, `cp -p`, a
 *     restored backup, some editors' atomic-save paths). The binary then looks
 *     newer than inputs it was never built from.
 *   - `bun run build:binary` REGENERATES several inputs in place
 *     (`generated-css-assets.ts`, the three `*.generated.ts` manifests) before
 *     compiling, so the mtime ordering after a build depends on step ordering
 *     inside the build script rather than on anything the gate controls.
 *
 * A content hash cannot false-fresh, and it also avoids the inverse annoyance:
 * `git checkout` stamps mtime = now on every file it rewrites, so an mtime gate
 * rebuilds on every branch switch even when the content round-trips back to a
 * state already built. The 320 ms delta buys correctness in one direction and
 * fewer useless rebuilds in the other.
 *
 * ## What the stamp is NOT
 *
 * It is not a security or tamper signal, and it is not committed
 * (`.sovrium-binary-build.json` is gitignored, like the binary itself). It only
 * answers "was the artifact next to me produced from this exact input tree".
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Repo root, resolved from this module's own location rather than `process.cwd()`
 * — this module is imported from `[internal ref]` (running under Node) as
 * well as executed under Bun, and the two do not share a reliable cwd.
 */
export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The current-platform binary produced by `bun run build:binary` with no flags. */
export const BINARY_PATH = join(PROJECT_ROOT, 'sovrium')

/** Sidecar recording the input fingerprint {@link BINARY_PATH} was compiled from. */
export const STAMP_PATH = join(PROJECT_ROOT, '.sovrium-binary-build.json')

/**
 * Everything whose content can change the compiled binary.
 *
 * Derived from what `scripts/build/build-binary.ts` actually does, not guessed:
 *
 * | Root               | Why it is an input                                                        |
 * | ------------------ | ------------------------------------------------------------------------- |
 * | `src`              | the bundled module graph, plus the four `*.generated.ts` embed manifests   |
 * | `templates`        | embedded verbatim by `generate-embedded-static-assets.ts`, and scanned for |
 * |                    | Tailwind candidates by `generate-css-assets.ts`                           |
 * | `drizzle`          | migration journal + `*.sql`, embedded by the static-asset manifest         |
 * | `scripts/build`    | the generators themselves — a codegen change changes the embedded output   |
 * | `package.json`     | `--define=__SOVRIUM_VERSION__` and the dependency set                      |
 * | `bun.lock`         | resolved dependency versions, incl. the `typescript` whose `lib.*.d.ts`    |
 * |                    | corpus is embedded by `generate-embedded-ts-lib-types.ts`                  |
 *
 * `node_modules` itself is deliberately NOT hashed: it is large, and `bun.lock`
 * is the tractable proxy for it. The residual gap is a hand-edited
 * `node_modules` with an unchanged lockfile, which no gate here would catch and
 * which `bun install` heals anyway.
 *
 * This is a superset — `src/**\/*.test.ts` cannot reach the binary yet is hashed.
 * Over-triggering costs one rebuild; under-triggering ships a stale artifact
 * behind a green gate, so the asymmetry is taken deliberately.
 */
const INPUT_ROOTS = ['src', 'templates', 'drizzle', 'scripts/build'] as const
const INPUT_FILES = ['package.json', 'bun.lock'] as const

/**
 * Directory names never descended into.
 *
 * `.sovrium` is the load-bearing one: `bun run app:template` and the template
 * previews create `templates/<name>/.sovrium/` (SQLite db + lock + storage), so a
 * fingerprint that walked it would change on every preview boot and rebuild the
 * binary for no reason. Dot-directories are skipped wholesale for that reason;
 * none of them is a build input.
 */
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__snapshots__'])

function walk(absDir: string, out: string[]): void {
  const entries = readdirSync(absDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue
    const abs = join(absDir, entry.name)
    if (entry.isDirectory()) {
      walk(abs, out)
    } else if (entry.isFile()) {
      out.push(abs)
    }
  }
}

/**
 * SHA-256 over every build input, path-qualified and order-stable.
 *
 * Paths are folded into the digest alongside content so that a pure RENAME —
 * same bytes, different filename — still changes the fingerprint. Sorting uses
 * the POSIX-normalised relative path so the value is identical on macOS and
 * Linux for the same tree.
 *
 * Measured cost on this repo: ~3.8k files / ~25 MB / ~420 ms warm. That is paid
 * once per E2E run, and only when the packaging tier is in scope.
 */
export function computeBinaryInputFingerprint(): string {
  const absolute: string[] = []

  for (const root of INPUT_ROOTS) {
    const abs = join(PROJECT_ROOT, root)
    if (existsSync(abs)) walk(abs, absolute)
  }
  for (const file of INPUT_FILES) {
    const abs = join(PROJECT_ROOT, file)
    if (existsSync(abs)) absolute.push(abs)
  }

  const relPaths = absolute
    .map((abs) => relative(PROJECT_ROOT, abs).split(sep).join('/'))
    .toSorted()

  const hash = createHash('sha256')
  for (const rel of relPaths) {
    hash.update(rel)
    hash.update('\0')
    hash.update(readFileSync(join(PROJECT_ROOT, rel)))
    hash.update('\0')
  }
  // Fold the file COUNT in as well: without it, two different input sets could in
  // principle stream identical bytes through the digest (path/content boundaries
  // are already NUL-delimited, so this is belt-and-braces, not load-bearing).
  hash.update(String(relPaths.length))

  return hash.digest('hex')
}

export interface BinaryBuildStamp {
  /** {@link computeBinaryInputFingerprint} at the moment the compile finished. */
  readonly fingerprint: string
  /** ISO timestamp — human diagnostics only; never compared. */
  readonly builtAt: string
  /** `package.json` version the binary was stamped with. */
  readonly version: string
  /** `${process.platform}-${process.arch}` — a binary from another host is not ours. */
  readonly platform: string
}

/**
 * Record the fingerprint of the tree the binary was JUST compiled from.
 *
 * Called at the very end of `build-binary.ts`, after the compile, deliberately:
 * the build regenerates inputs in place (`generated-css-assets.ts` and the embed
 * manifests), so a fingerprint taken BEFORE the compile would describe a tree
 * that no longer exists and would report the fresh binary as stale on the very
 * next check.
 */
export function writeBinaryBuildStamp(): BinaryBuildStamp {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')) as {
    version: string
  }
  const stamp: BinaryBuildStamp = {
    fingerprint: computeBinaryInputFingerprint(),
    builtAt: new Date().toISOString(),
    version: pkg.version,
    platform: `${process.platform}-${process.arch}`,
  }
  writeFileSync(STAMP_PATH, `${JSON.stringify(stamp, null, 2)}\n`)
  return stamp
}

function readBinaryBuildStamp(): BinaryBuildStamp | undefined {
  try {
    const parsed = JSON.parse(readFileSync(STAMP_PATH, 'utf-8')) as Partial<BinaryBuildStamp>
    if (typeof parsed.fingerprint !== 'string' || parsed.fingerprint.length === 0) return undefined
    return parsed as BinaryBuildStamp
  } catch {
    // Absent or unparseable stamp is not an error — it means "unknown", which
    // the caller treats exactly like "stale". Never let a corrupt sidecar throw.
    return undefined
  }
}

export interface BinaryFreshness {
  readonly current: boolean
  /** Human-readable justification, printed by the gate so a rebuild is never mysterious. */
  readonly reason: string
}

/**
 * Is `./sovrium` present AND compiled from the tree as it stands right now?
 *
 * Returns a reason string in both directions so the caller can log why it is
 * about to spend a rebuild — a silent rebuild reads as a hang.
 */
export function checkBinaryFreshness(): BinaryFreshness {
  if (!existsSync(BINARY_PATH)) {
    return { current: false, reason: 'no compiled binary at ./sovrium' }
  }

  const stamp = readBinaryBuildStamp()
  if (!stamp) {
    return {
      current: false,
      reason: 'binary present but unstamped (built by an older toolchain, or stamp removed)',
    }
  }

  const platform = `${process.platform}-${process.arch}`
  if (stamp.platform !== platform) {
    return {
      current: false,
      reason: `binary was built for ${stamp.platform}, this host is ${platform}`,
    }
  }

  const fingerprint = computeBinaryInputFingerprint()
  if (fingerprint !== stamp.fingerprint) {
    return {
      current: false,
      reason: `build inputs changed since ${stamp.builtAt} (${stamp.fingerprint.slice(0, 12)} → ${fingerprint.slice(0, 12)})`,
    }
  }

  return { current: true, reason: `built ${stamp.builtAt} from matching inputs` }
}
