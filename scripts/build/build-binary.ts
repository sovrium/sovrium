/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build Binary Script - Compiles Sovrium CLI into a standalone executable
 *
 * Uses `bun build --compile` to produce a self-contained binary that embeds
 * the Bun runtime, all JS code, and static assets.
 *
 * Usage:
 *   bun run scripts/build/build-binary.ts                      # Build for current platform
 *   bun run scripts/build/build-binary.ts --target linux-x64   # Cross-compile for Linux x64
 *   bun run scripts/build/build-binary.ts --all                # Build all 5 targets
 *
 * Targets: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64
 *
 * (This line said "4 targets" and omitted windows-x64 for as long as windows-x64
 * had existed. `--all` builds five. Read `TARGETS` below, not this comment.)
 */

import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { CommandServiceLive, spawn } from '../lib/effect/command-service'
import { writeBinaryBuildStamp } from './binary-build-stamp'
import { STORY_ROOTS, docsPayloadPaths, storyCorpusRootsPresent } from './generate-embedded-docs'
import type { CommandService } from '../lib/effect/command-service'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')

/**
 * The one typed failure this script raises — every `printStderr` +
 * `process.exit(1)` pair used to sit at the point of discovery (inside `run`,
 * `getCurrentTarget`, `parseCliArgs`, `compileBinary`); SC4 wants exactly one
 * exit site, so each of those becomes this instead, and `main`'s entry-point
 * guard is the only place that turns one into a `process.exit(1)`.
 */
class BuildBinaryError extends Data.TaggedError('BuildBinaryError')<{
  readonly message: string
}> {}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface Target {
  readonly name: string
  readonly bunTarget: string
  readonly outfile: string
}

const TARGETS: readonly Target[] = [
  { name: 'linux-x64', bunTarget: 'bun-linux-x64', outfile: 'sovrium-linux-x64' },
  { name: 'linux-arm64', bunTarget: 'bun-linux-arm64', outfile: 'sovrium-linux-arm64' },
  { name: 'darwin-x64', bunTarget: 'bun-darwin-x64', outfile: 'sovrium-darwin-x64' },
  { name: 'darwin-arm64', bunTarget: 'bun-darwin-arm64', outfile: 'sovrium-darwin-arm64' },
  { name: 'windows-x64', bunTarget: 'bun-windows-x64', outfile: 'sovrium-windows-x64.exe' },
]

// ---------------------------------------------------------------------------
// Timeouts (SC2) — each named for what the step actually does, not tuned to a
// single measured run. A cold CI runner is several times slower than a warm
// laptop, so these are runaway-catchers (see SC5's sizing rule in
// effect-conventions.md), not targets to shave.
// ---------------------------------------------------------------------------

/**
 * The `generate-*` manifest/preset scripts below do no real compute — they
 * stringify an already-resolved config, copy files verbatim, or wrap another
 * generator's output. One minute is generous for all of them.
 */
const CODEGEN_TIMEOUT_MS = 60_000

/**
 * `generate-css-assets.ts` runs `@tailwindcss/oxide`'s native candidate
 * scanner across the whole `src/` + `apps/*` corpus (~35,700 candidates at
 * last measurement) plus the upstream stylesheet bundle — real work, not a
 * manifest write.
 */
const CSS_ASSETS_TIMEOUT_MS = 120_000

/**
 * `build-runtime-assets.ts` runs `Bun.build` over the client/island entry
 * points (client-bundle, island-entry, island-chunks) — a real bundler pass,
 * not a copy.
 */
const RUNTIME_ASSETS_TIMEOUT_MS = 120_000

/**
 * `build-types.ts` runs a full `ts.createProgram` over the repository to
 * resolve the Effect Schema config types structurally — the same class of
 * work as a `tsc --noEmit` pass, which `command-service.ts`'s own `typecheck`
 * builder budgets at 60s for an *incremental* run; this one is cold every time.
 */
const BUILD_TYPES_TIMEOUT_MS = 120_000

/**
 * `bun build --compile` embeds the whole Bun runtime plus the bundled JS and
 * static assets into a single executable — "a binary build is minutes", per
 * the standing guidance this timeout answers to, and cross-compiling to a
 * non-native target is not faster than compiling for the host.
 */
const COMPILE_TIMEOUT_MS = 300_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run one build step, with its output attached to THIS process's terminal.
 *
 * `inherit: true` is deliberate, not a default left in place: every step this
 * wraps is a multi-second-to-multi-minute generator or bundler whose progress
 * IS the feedback a developer or CI log is watching for, so this preserves
 * the original `Bun.spawnSync(..., { stdout: 'inherit', stderr: 'inherit' })`
 * behaviour exactly rather than buffering it into a post-hoc dump.
 */
const run = (
  cmd: readonly string[],
  label: string,
  timeoutMs: number
): Effect.Effect<void, BuildBinaryError, CommandService> =>
  Effect.gen(function* () {
    console.log(`\n${label}`)
    const result = yield* spawn(cmd, {
      cwd: PROJECT_ROOT,
      inherit: true,
      timeout: timeoutMs,
      throwOnError: false,
    }).pipe(
      Effect.catchTags({
        CommandTimeoutError: () =>
          Effect.fail(new BuildBinaryError({ message: `${label} timed out after ${timeoutMs}ms` })),
        CommandSpawnError: (error) =>
          Effect.fail(
            new BuildBinaryError({
              message: `${label} failed to spawn: ${error.cause ? String(error.cause) : 'unknown error'}`,
            })
          ),
        // Unreachable at runtime under `throwOnError: false` — kept so the
        // Effect's error channel is exhaustively `BuildBinaryError` rather than
        // leaking `CommandFailedError` into every caller's type.
        CommandFailedError: (error) =>
          Effect.fail(
            new BuildBinaryError({ message: `${label} failed (exit ${error.exitCode})` })
          ),
      })
    )
    if (result.exitCode !== 0) {
      return yield* new BuildBinaryError({ message: `${label} failed (exit ${result.exitCode})` })
    }
  })

function getVersion(): string {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'))
  return pkg.version as string
}

const getCurrentTarget = (): Effect.Effect<Target, BuildBinaryError> =>
  Effect.gen(function* () {
    const osMap: Record<string, string> = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
    const os = osMap[process.platform] ?? 'linux'
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const name = `${os}-${arch}`
    const match = TARGETS.find((t) => t.name === name)
    if (!match) {
      return yield* new BuildBinaryError({
        message: `Unsupported platform: ${process.platform}-${process.arch}`,
      })
    }
    return match
  })

const parseCliArgs = (): Effect.Effect<{ readonly targets: readonly Target[] }, BuildBinaryError> =>
  Effect.gen(function* () {
    const args = Bun.argv.slice(2)

    if (args.includes('--all')) {
      return { targets: TARGETS }
    }

    const targetIdx = args.indexOf('--target')
    if (targetIdx !== -1 && args[targetIdx + 1]) {
      const targetName = args[targetIdx + 1]
      const match = TARGETS.find((t) => t.name === targetName)
      if (!match) {
        return yield* new BuildBinaryError({
          message: `Unknown target: ${targetName}\nAvailable: ${TARGETS.map((t) => t.name).join(', ')}`,
        })
      }
      return { targets: [match] }
    }

    // Default: build for current platform, output as 'sovrium' (no platform suffix)
    const current = yield* getCurrentTarget()
    return { targets: [{ ...current, outfile: 'sovrium' }] }
  })

function formatSize(bytes: number): string {
  const MB = 1e6
  const KB = 1e3
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`
  return `${bytes} B`
}

// ---------------------------------------------------------------------------
// Build steps
// ---------------------------------------------------------------------------

/**
 * The Windows PE version resources — product name, publisher, version — that a
 * user sees when Windows asks them to approve an executable.
 *
 * Returned as flags rather than set unconditionally, because Bun can only
 * produce them on a Windows HOST. From bun.com/docs/bundler/executables, in as
 * many words: "Except for `hideConsole`, you do not have access to these flags
 * when cross-compiling because they depend on Windows APIs." Passing them from
 * Linux does not warn — it produces an .exe carrying Bun's own file properties
 * and no version at all.
 *
 * That was cosmetic while the binary was something a developer downloaded
 * deliberately. It stopped being cosmetic when the same file became the sidecar
 * INSIDE a signed desktop installer, where an unnamed, unversioned executable is
 * what a user is shown when SmartScreen asks them to approve it. The Windows
 * lane of `.github/workflows/release.yml` moved to `windows-latest` so that this
 * branch is taken; a cross-compile still succeeds and simply omits them.
 *
 * `--windows-icon` is deliberately absent: the only `.ico` in the tree belongs
 * to the desktop shell, and the engine reaching into `desktop/` for an asset
 * would couple two trees that [internal ref] keeps apart.
 */
export const windowsResourceFlags = (
  target: Target,
  version: string,
  platform: string = process.platform
): readonly string[] => {
  if (!target.bunTarget.includes('windows') || platform !== 'win32') return []
  return [
    '--windows-title=Sovrium',
    '--windows-publisher=ESSENTIAL SERVICES',
    `--windows-version=${version}`,
    '--windows-description=Sovrium — configuration-as-code interpreter',
    '--windows-copyright=Copyright (c) 2025-2026 ESSENTIAL SERVICES',
  ]
}

const compileBinary = (
  target: Target,
  version: string
): Effect.Effect<void, BuildBinaryError, CommandService> =>
  Effect.gen(function* () {
    const outPath = join(PROJECT_ROOT, target.outfile)
    const entryPoint = join(PROJECT_ROOT, 'src', 'cli', 'index.ts')

    const cmd = [
      'bun',
      'build',
      '--compile',
      entryPoint,
      `--target=${target.bunTarget}`,
      `--outfile=${outPath}`,
      '--minify',
      '--sourcemap',
      `--define=__SOVRIUM_VERSION__=${JSON.stringify(version)}`,
      ...windowsResourceFlags(target, version),
    ]

    yield* run(cmd, `Compile binary for ${target.name}`, COMPILE_TIMEOUT_MS)

    // Verify output
    if (!existsSync(outPath)) {
      return yield* new BuildBinaryError({ message: `Binary not found at ${outPath}` })
    }

    const stats = statSync(outPath)
    if (stats.size < 1_000_000) {
      return yield* new BuildBinaryError({
        message: `Binary suspiciously small: ${formatSize(stats.size)}`,
      })
    }

    console.log(`  ${target.outfile} (${formatSize(stats.size)})`)
  })

// ---------------------------------------------------------------------------
// The manual payload: regenerate it, or build from what is committed
// ---------------------------------------------------------------------------

/**
 * Two floors on the committed manual payload, so "the file is there" cannot
 * stand in for "the manual is there".
 *
 * A payload whose walk collected nothing does not throw — it writes a header
 * and an empty object literal, roughly 600 bytes each — and every downstream
 * check of the form "the module parsed" stays green over a binary whose
 * `sovrium docs` renders an empty manual. The floors sit an order of magnitude
 * under the real payloads (41 KB and 1.0 MB at v0.26.0) and an order of
 * magnitude over an empty one, so they catch a stub or a truncation without
 * becoming a second thing to maintain as the corpus grows.
 */
export const DOCS_MANIFEST_MIN_BYTES = 8000
export const DOCS_BEHAVIOUR_MIN_BYTES = 32_000

/** What the build decided to do about the manual, and why. */
export type DocsPayloadPlan =
  { readonly _tag: 'Regenerate' } | { readonly _tag: 'UseCommitted'; readonly reason: string }

/** What `verifyCommittedDocsPayload` measured, for the one line it prints. */
export interface CommittedDocsPayload {
  readonly fragments: number
  readonly articles: number
}

/**
 * Regenerate the manual, or build from the committed payload — decided from the
 * corpus on disk, and never from a swallowed error.
 *
 * `generate-embedded-docs.ts` derives the Behaviour half from the acceptance
 * criteria under `[internal ref]`, which the PUBLIC MIRROR does not carry
 * and must not: the user stories are an internal product contract. The GitHub
 * release lanes build from that mirror, so on them the generator's walk hits
 * ENOENT and — correctly, by design — throws. v0.26.0 tagged and then failed in
 * all four binary lanes on exactly that, leaving a draft release with no assets.
 *
 * The answer is not to make the walk forgiving. Both payloads are COMMITTED and
 * held byte-current by `Generated Assets Drift` on [internal ref], so where the corpus
 * is absent the committed payload is not a fallback — it is the same bytes a
 * green gate already verified, and rebuilding it would be the less trustworthy
 * of the two. Where the corpus IS present the generator runs exactly as before,
 * so a local or [internal ref] build still fails closed on drift.
 *
 * A PARTIAL corpus is a third state and fails loudly: it is neither a checkout
 * nor the mirror, and building either way from it would silently ship a manual
 * missing whole personas' behaviour.
 */
export const planDocsPayload = (root: string): Effect.Effect<DocsPayloadPlan, BuildBinaryError> =>
  Effect.gen(function* () {
    const present = storyCorpusRootsPresent(root)
    if (present.length === STORY_ROOTS.length) return { _tag: 'Regenerate' as const }
    if (present.length === 0) {
      return {
        _tag: 'UseCommitted' as const,
        reason: `no user-story corpus under ${STORY_ROOTS.join(', ')} — this is the public mirror`,
      }
    }
    return yield* new BuildBinaryError({
      message:
        `Partial user-story corpus: ${present.length} of ${STORY_ROOTS.length} roots present ` +
        `(${present.join(', ')}). A partial corpus is neither a full checkout nor the public ` +
        `mirror, and the manual built from it would be short by whole personas. Restore the ` +
        `missing root(s), or remove all of them to build from the committed payload.`,
    })
  })

/**
 * Assert the committed manual payload is present and substantial enough to be
 * worth compiling into a binary.
 *
 * Three checks, each answering a way the payload has actually been wrong:
 * the files exist; each clears its floor above; and every fragment the manifest
 * names still resolves on disk. That last one is the mirror's own failure mode —
 * a fragment the allowlist strips would leave the manifest pointing at nothing,
 * which `bun build --compile` reports as an unresolved import several minutes
 * later and with no mention of the manual.
 *
 * The behaviour module is IMPORTED rather than pattern-matched, because a
 * truncated or half-written payload parses as prose and fails as a module.
 */
export const verifyCommittedDocsPayload = (
  root: string
): Effect.Effect<CommittedDocsPayload, BuildBinaryError> =>
  Effect.gen(function* () {
    const paths = docsPayloadPaths(root)

    for (const [label, path, floor] of [
      ['embedded-docs.generated.ts', paths.manifest, DOCS_MANIFEST_MIN_BYTES],
      ['embedded-docs-behaviour.generated.ts', paths.behaviour, DOCS_BEHAVIOUR_MIN_BYTES],
    ] as const) {
      if (!existsSync(path)) {
        return yield* new BuildBinaryError({
          message: `Committed manual payload missing: ${label}. The binary would ship no manual.`,
        })
      }
      const { size } = statSync(path)
      if (size < floor) {
        return yield* new BuildBinaryError({
          message:
            `Committed manual payload too small: ${label} is ${formatSize(size)}, ` +
            `under the ${formatSize(floor)} floor. An empty payload is what a generator that ` +
            `collected nothing writes, so this is a stub rather than a manual.`,
        })
      }
    }

    const manifest = readFileSync(paths.manifest, 'utf8')
    const fragments = [
      ...manifest.matchAll(/^import _d\d+ from '(.+?)' with \{ type: 'file' \}$/gm),
    ]
      .map((match) => match[1])
      .filter((specifier): specifier is string => specifier !== undefined)
    const missing = fragments
      .map((specifier) => specifier.replace(/^\.\.\/\.\.\/\.\.\//, ''))
      .filter((relativePath) => !existsSync(join(root, relativePath)))
    if (missing.length > 0) {
      return yield* new BuildBinaryError({
        message:
          `${missing.length} documentation fragment(s) named by the committed manifest are not ` +
          `on disk, so the compile would fail on an unresolved import: ` +
          `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`,
      })
    }

    const behaviour = yield* Effect.tryPromise({
      try: () => import(paths.behaviour) as Promise<{ readonly EMBEDDED_DOCS_BEHAVIOUR?: unknown }>,
      catch: (cause) =>
        new BuildBinaryError({
          message: `Committed manual payload does not import: embedded-docs-behaviour.generated.ts — ${String(cause)}`,
        }),
    })
    const { EMBEDDED_DOCS_BEHAVIOUR: payload } = behaviour
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return yield* new BuildBinaryError({
        message:
          'Committed manual payload exports no EMBEDDED_DOCS_BEHAVIOUR object: ' +
          'embedded-docs-behaviour.generated.ts',
      })
    }
    const articles = Object.keys(payload).length
    if (articles === 0) {
      return yield* new BuildBinaryError({
        message:
          'Committed manual payload describes zero articles, so every Behaviour block would be ' +
          'empty: embedded-docs-behaviour.generated.ts',
      })
    }

    return { fragments: fragments.length, articles }
  })

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main: Effect.Effect<void, BuildBinaryError, CommandService> = Effect.gen(function* () {
  console.log('Sovrium Binary Builder')

  const { targets } = yield* parseCliArgs()
  const version = getVersion()

  console.log(`Version: ${version}`)
  console.log(`Targets: ${targets.map((t) => t.name).join(', ')}`)

  // Freeze `src/admin/app.ts` into the embedded console preset. FIRST, and
  // specifically BEFORE the CSS step below: the emitted module lives in `src/`,
  // so the candidate scanner walks it, and the corpus must be built from the
  // settled preset bytes. Reversed, the binary ships a console whose own chrome
  // classes were never compiled — see scripts/build/generate-admin-preset.ts.
  yield* run(
    ['bun', 'run', 'scripts/build/generate-admin-preset.ts'],
    'Generate embedded admin preset',
    CODEGEN_TIMEOUT_MS
  )

  // Refresh embedded CSS assets (candidate list + upstream stylesheets) so the
  // compiled binary can compile theme-aware CSS without native addons. The
  // compiled binary cannot load @tailwindcss/oxide / lightningcss .node files
  // from its virtual filesystem — see scripts/build/generate-css-assets.ts and issue #19.
  yield* run(
    ['bun', 'run', 'scripts/build/generate-css-assets.ts'],
    'Generate embedded CSS assets',
    CSS_ASSETS_TIMEOUT_MS
  )

  // Refresh the embedded static-asset manifest (drizzle migrations, init
  // templates) so `with { type: 'file' }` imports embed the current files
  // into the binary — see scripts/build/generate-embedded-static-assets.ts.
  yield* run(
    ['bun', 'run', 'scripts/build/generate-embedded-static-assets.ts'],
    'Generate embedded static-asset manifest',
    CODEGEN_TIMEOUT_MS
  )

  // Pre-build the client/island/script runtime assets into dist/ and emit the
  // manifest of `with { type: 'file' }` imports so the compiled binary serves
  // them via Bun.file() — see scripts/build/generate-embedded-runtime-assets.ts.
  yield* run(
    ['bun', 'run', 'scripts/build/build-runtime-assets.ts'],
    'Build client/island runtime assets',
    RUNTIME_ASSETS_TIMEOUT_MS
  )
  yield* run(
    ['bun', 'run', 'scripts/build/generate-embedded-runtime-assets.ts'],
    'Generate embedded runtime-asset manifest',
    CODEGEN_TIMEOUT_MS
  )

  // Embed the TypeScript standard-library `.d.ts` corpus so the runTypescript
  // validator's in-binary CompilerHost can resolve `Record<K, V>`, `Promise<T>`,
  // `Map`/`Set` etc. when checking user `execute()` bodies. v0.5.x/v0.6.x
  // binaries shipped without this and rejected every automation referencing a
  // standard-library generic at boot — see
  // `src/infrastructure/automations/typescript-validator/layer.ts`.
  yield* run(
    ['bun', 'run', 'scripts/build/generate-embedded-ts-lib-types.ts'],
    'Generate embedded TypeScript lib.*.d.ts manifest',
    CODEGEN_TIMEOUT_MS
  )

  // Derive the `sovrium types` payload — the ambient `declare module 'sovrium'`
  // declaration plus its minimal tsconfig — and embed it as string constants.
  //
  // Two steps, in this order and both BEFORE the compile: `build-types.ts` runs
  // the TypeScript Compiler API over the whole project to resolve the Effect
  // Schema types into plain structural types, and the generator wraps that output
  // as an ambient module. Running them here rather than trusting the committed
  // copy is what makes the shipped binary's types match the shipped binary's
  // schema — a stale declaration would autocomplete options the engine has
  // dropped, and reject ones it has gained, with nothing to signal either.
  //
  // The generator ALSO fails the build if the declaration acquires a runtime
  // value. That is deliberately enforced at the build boundary and not only in
  // `bun run quality`: the defect it catches (tsc exit 0, binary exit 1) is
  // invisible to every type-level gate, so the last honest place to stop it is
  // immediately before the artifact that would ship it.
  yield* run(
    ['bun', 'run', 'scripts/build/build-types.ts'],
    'Resolve config type declarations',
    BUILD_TYPES_TIMEOUT_MS
  )
  yield* run(
    ['bun', 'run', 'scripts/build/generate-embedded-config-types.ts'],
    'Generate embedded config-types payload',
    CODEGEN_TIMEOUT_MS
  )

  // The in-binary manual, LAST, and the position is load-bearing in
  // one direction only. Its behaviour payload is derived from
  // `[internal ref]`, which no preceding step touches, so ordering buys
  // nothing there. What it buys is the reverse: this step writes two `src/`
  // files, and running it before the CSS candidate harvest would have that
  // harvest read manifests this same build is about to rewrite. Running it
  // after every other generator means the binary compiles from a tree nothing
  // else still intends to change.
  //
  // It is also the ONE step of this pipeline that reads a tree the public
  // mirror strips — measured, not assumed: every other generator above was run
  // against an assembled mirror tree and exited 0. So this is the one step that
  // asks first whether it can run at all; see `planDocsPayload`.
  const docsPlan = yield* planDocsPayload(PROJECT_ROOT)
  if (docsPlan._tag === 'Regenerate') {
    yield* run(
      ['bun', 'run', 'scripts/build/generate-embedded-docs.ts'],
      'Generate embedded documentation payload',
      CODEGEN_TIMEOUT_MS
    )
  } else {
    console.log('\nGenerate embedded documentation payload')
    console.log(`  ${docsPlan.reason}`)
    const payload = yield* verifyCommittedDocsPayload(PROJECT_ROOT)
    console.log(
      `  building from the committed payload: ${payload.fragments} fragment(s), ` +
        `${payload.articles} article(s)`
    )
  }

  // Compile each target
  for (const target of targets) {
    yield* compileBinary(target, version)
  }

  // Record the input fingerprint the DEFAULT (current-platform `./sovrium`) build
  // was produced from, so `scripts/build/ensure-binary.ts` can tell a current
  // binary from a stale one without rebuilding to find out.
  //
  // Written AFTER the compile, deliberately: the asset-generation steps above
  // rewrite inputs in place (`generated-css-assets.ts` and the three
  // `*.generated.ts` embed manifests), so a fingerprint taken earlier would
  // describe a tree that no longer exists and would mark this very binary stale.
  //
  // Only for the default build — `--target` / `--all` emit platform-suffixed
  // artifacts (`sovrium-linux-x64`, …), not `./sovrium`, so stamping them would
  // claim a freshness the un-built `./sovrium` does not have.
  const isDefaultBuild = targets.length === 1 && targets[0]?.outfile === 'sovrium'
  if (isDefaultBuild) {
    const stamp = writeBinaryBuildStamp()
    console.log(`  build stamp ${stamp.fingerprint.slice(0, 12)} (${stamp.platform})`)
  }

  console.log(`\nBuilt ${targets.length} binary/binaries.`)
})

// SC4 — the only `process.exit` in the file.
if (import.meta.main) {
  const MainLayer = Layer.mergeAll(CommandServiceLive)
  Effect.runPromise(main.pipe(Effect.provide(MainLayer)))
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      printStderr(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
