/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build gate for the `@packaging` spec tier: guarantee `./sovrium` exists AND is
 * current before Playwright runs specs that exercise it.
 *
 * ## The failure this closes
 *
 * `[internal ref]*.spec.ts` is tagged
 * `['@packaging', '@regression', '@domain:packaging']`, so `bun test:e2e:regression`
 * (`playwright test --grep='@regression'`) sweeps it in. CI builds the binary
 * inline before the E2E step; nothing local did, so all six packaging specs
 * hard-threw `Compiled binary not found` on any clean checkout.
 *
 * The fix is to make the binary exist and be current — NOT to soften
 * `requireExecutableBinary`, whose hard throw on an
 * absent binary is correct: a silent skip there would let a regressed build step
 * pass unnoticed. This gate runs upstream of it.
 *
 * ## Why staleness matters as much as absence
 *
 * A binary compiled before a `src/` change is worse than a missing one: the
 * packaging tier would validate a stale artifact and report GREEN. Freshness is
 * therefore a content fingerprint of the real build inputs, recorded by the build
 * itself — see `scripts/build/binary-build-stamp.ts` for the signal and for why
 * mtime was rejected.
 *
 * ## Why it does not tax every E2E run
 *
 * The vast majority of E2E invocations touch no packaging spec, and a rebuild on
 * each would make the common case materially worse. The gate therefore runs only
 * when the packaging tier is in scope for THIS invocation — see
 * {@link packagingSpecsInScope}. When it does run and the binary is current, the
 * whole cost is the ~420 ms fingerprint.
 *
 * ## CI
 *
 * `.[internal ref]/workflows/test.yml` still builds the binary concurrently with
 * container startup, deliberately keeping it off the E2E critical path. That
 * build writes the stamp, so this gate finds the binary current and does nothing
 * but re-verify — no second build, no serialisation. If the workflow step ever
 * regresses, the gate rebuilds and says so, which beats six hard throws.
 *
 * ## Usage
 *
 *   bun run build:binary:ensure          # build only if missing or stale
 *   SOVRIUM_SKIP_BINARY_BUILD=1 …        # opt out entirely (gate is a no-op)
 *   SOVRIUM_FORCE_BINARY_BUILD=1 …       # run the gate regardless of scope
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BINARY_PATH, PROJECT_ROOT, checkBinaryFreshness } from './binary-build-stamp'

/** Repo-relative home of the `@packaging` tier. */
export const PACKAGING_SPEC_DIR = 'specs/infrastructure/binary-packaging-tier'

/**
 * Playwright `test` flags that consume the FOLLOWING argv token as their value.
 *
 * Only the separated form (`--grep @regression`) needs this; `--grep=@regression`
 * is a single token and is filtered out by the leading dash. Both forms occur in
 * this repo — `package.json` uses `--grep='@regression'`, `[internal ref]`
 * passes `'--grep', '@regression'` as two array entries.
 */
const VALUE_TAKING_FLAGS = new Set([
  '-c',
  '--config',
  '-g',
  '--grep',
  '--grep-invert',
  '-j',
  '--workers',
  '--project',
  '--reporter',
  '--retries',
  '--repeat-each',
  '--max-failures',
  '--timeout',
  '--global-timeout',
  '--output',
  '--shard',
  '--trace',
  '--test-match',
  '--test-ignore',
  '--tsconfig',
  '--update-source-method',
])

/**
 * Extract the positional file filters from a `playwright test …` argv.
 *
 * Two independent filters, because neither alone is safe:
 *
 *  1. Drop dash-prefixed tokens and the value token following a known
 *     value-taking flag. This is exact for the flags listed, but the list can go
 *     stale as Playwright adds options.
 *  2. Require the token to LOOK like a path filter (contains `/`, or ends in
 *     `.ts`). Playwright treats positionals as regexes matched against file
 *     paths, and every positional this repo actually emits is a literal spec
 *     path. Option values that slipped past (1) — `@regression`, `dot,json`,
 *     `chromium`, `4` — are rejected here.
 *
 * The combination fails toward "no positional filters found", which the caller
 * reads as a full sweep and therefore as IN scope. Erring that way costs a
 * rebuild; erring the other way reinstates the hard throw this gate exists to
 * remove.
 */
export function parsePositionalFilters(argv: readonly string[]): readonly string[] {
  // argv[0] is the runtime, argv[1] the Playwright CLI entry point. Anything
  // before (and including) the `test` subcommand is not a filter.
  const afterCli = argv.slice(2)
  const testIdx = afterCli.indexOf('test')
  const tokens = testIdx === -1 ? afterCli : afterCli.slice(testIdx + 1)

  const positionals: string[] = []
  let skipNext = false
  for (const token of tokens) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (token.startsWith('-')) {
      skipNext = VALUE_TAKING_FLAGS.has(token)
      continue
    }
    if (token.includes('/') || token.endsWith('.ts')) positionals.push(token)
  }
  return positionals
}

/** Repo-relative paths of the packaging spec files, or `[]` if the dir is gone. */
function packagingSpecFiles(): readonly string[] {
  const abs = join(PROJECT_ROOT, PACKAGING_SPEC_DIR)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => `${PACKAGING_SPEC_DIR}/${name}`)
}

/** Does `filter` (a Playwright positional, i.e. a regex) select `specPath`? */
function filterSelects(filter: string, specPath: string): boolean {
  const normalised = filter.replace(/^\.\//, '')
  if (specPath.includes(normalised)) return true
  try {
    return new RegExp(normalised).test(specPath)
  } catch {
    // Not a valid regex — the substring test above was the only meaningful one.
    return false
  }
}

export interface ScopeDecision {
  readonly inScope: boolean
  readonly reason: string
}

/**
 * Will this Playwright invocation run any `@packaging` spec?
 *
 * Answered from the ONE narrowing mechanism that can prove a negative here:
 * positional file filters. Playwright's `FullConfig` does not carry them (it
 * exposes `grep`/`grepInvert` but not the positional list), so argv is the only
 * source — hence {@link parsePositionalFilters}.
 *
 * DELIBERATE LIMITATION: a tag `--grep` alone is treated as in-scope. That is not
 * laziness — every tag grep this repo uses (`@spec`, `@regression`, `@packaging`)
 * genuinely DOES select the packaging tier, and the exotic case (`--grep
 * @domain:tables` with no file filter) is a full-suite sweep where the gate's
 * cost is proportionate. Deciding it precisely would mean re-implementing
 * Playwright's title/tag matching against unparsed spec files, which trades a
 * bounded, one-second waste for a fragile false negative.
 */
export function packagingSpecsInScope(argv: readonly string[]): ScopeDecision {
  const filters = parsePositionalFilters(argv)
  if (filters.length === 0) {
    return { inScope: true, reason: 'no file filters — the whole suite is in scope' }
  }

  const specs = packagingSpecFiles()
  const matched = specs.find((spec) => filters.some((filter) => filterSelects(filter, spec)))
  if (matched) {
    return { inScope: true, reason: `file filter selects ${matched}` }
  }

  return {
    inScope: false,
    reason: `file filters select no @packaging spec (${filters.join(', ')})`,
  }
}

export interface EnsureResult {
  /** `true` when a compile actually ran. */
  readonly rebuilt: boolean
  readonly reason: string
}

/**
 * Build `./sovrium` if — and only if — it is missing or stale.
 *
 * Shells out to `bun run build:binary` rather than importing it: the build script
 * is a top-level-await Bun program that `process.exit()`s on failure, and this
 * function is imported by `[internal ref]`, which runs under NODE (see
 * [internal ref]). A subprocess is the only way to run it from there, and it also keeps
 * the build's own `process.exit(1)` from killing the Playwright runner.
 *
 * No `SOVRIUM_FORCE_NATIVE_FREE_CSS` is set. That override is a RUNTIME flag on
 * the CSS compiler (`src/infrastructure/css/compiler.ts`), not a build-time one;
 * the build-time Tailwind scan goes through `@tailwindcss/oxide`'s native
 * `Scanner` in `generate-css-assets.ts`, which the flag does not reach. Verified
 * on this host (darwin-arm64, git worktree): `bun run build:binary` completes in
 * ~1 s with no OOM.
 */
export function ensureCompiledBinary(): EnsureResult {
  const freshness = checkBinaryFreshness()
  if (freshness.current) {
    return { rebuilt: false, reason: freshness.reason }
  }

  console.log(`Building ./sovrium for the @packaging tier — ${freshness.reason}`)
  const proc = spawnSync('bun', ['run', 'build:binary'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    encoding: 'utf-8',
  })

  if (proc.status !== 0) {
    throw new Error(
      `bun run build:binary failed (exit ${proc.status ?? 'signal ' + String(proc.signal)}).\n` +
        `The @packaging tier (${PACKAGING_SPEC_DIR}) cannot run without ${BINARY_PATH}.\n` +
        `Re-run \`bun run build:binary\` to see the full output, or set ` +
        `SOVRIUM_SKIP_BINARY_BUILD=1 to skip this gate (the packaging specs will then fail).`
    )
  }

  return { rebuilt: true, reason: freshness.reason }
}

/**
 * The entry point `[internal ref]` calls.
 *
 * Never throws for a reason that is not a genuine build failure: an out-of-scope
 * run or an explicit opt-out returns quietly, so this cannot become a new way for
 * an unrelated E2E run to die in globalSetup.
 */
export function ensureBinaryForTestRun(argv: readonly string[] = process.argv): EnsureResult {
  if (process.env.SOVRIUM_SKIP_BINARY_BUILD === '1') {
    return { rebuilt: false, reason: 'SOVRIUM_SKIP_BINARY_BUILD=1' }
  }

  const scope =
    process.env.SOVRIUM_FORCE_BINARY_BUILD === '1'
      ? { inScope: true, reason: 'SOVRIUM_FORCE_BINARY_BUILD=1' }
      : packagingSpecsInScope(argv)

  if (!scope.inScope) {
    return { rebuilt: false, reason: scope.reason }
  }

  return ensureCompiledBinary()
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// `import.meta.main` is Bun-only and undefined under Node 22, so compare paths
// instead — this module is imported by [internal ref] under Node and must
// not self-execute there.
const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  const result = ensureCompiledBinary()
  console.log(
    result.rebuilt
      ? `✓ ./sovrium rebuilt (${result.reason})`
      : `✓ ./sovrium is current — ${result.reason}`
  )
}
