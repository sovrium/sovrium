/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build Script - Produces dist/ for npm publishing
 *
 * Steps:
 *   1. Clean dist/
 *   2. Bundle JS via `bun build` (library + CLI entry points)
 *   3. Generate .d.ts via `tsc -p tsconfig.build.json`
 *   4. Fix path aliases in .d.ts files (@/ → relative paths)
 *   5. Add shebang to dist/cli.js
 *
 * Usage:
 * bun run [internal ref]
 */

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, relative, dirname, posix } from 'node:path'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { CommandServiceLive, spawn } from '../lib/effect/command-service'
import { buildRuntimeAssets } from '../lib/runtime-assets'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const SRC_DIR = join(PROJECT_ROOT, 'src')

/**
 * The one typed failure this script raises.
 *
 * Most of this file spawns nothing and holds no scoped resource — `Bun.build`
 * is an in-process bundler call, not a child process, so SC1 keeps `bundleJS`,
 * `fixPathAliases` and `addShebang` plain `async`/sync functions rather than
 * `Effect.gen` programs. `run()` below is the one exception: it is the only
 * place in the file that spawns a process (`tsc -p tsconfig.build.json`), so
 * it is the only function built on `CommandService` (SC2). Every failure site
 * — inside `run()` and outside it — throws this instead of calling
 * `printStderr` + `process.exit(1)` at the point of discovery, so `main()`'s
 * entry-point guard can be the SINGLE exit site SC4 asks for.
 */
class BuildScriptError extends Data.TaggedError('BuildScriptError')<{
  readonly message: string
}> {}

/** Re-throw an unknown value as a `BuildScriptError`, preserving its message. */
const toBuildScriptError = (error: unknown): BuildScriptError =>
  error instanceof BuildScriptError
    ? error
    : new BuildScriptError({ message: error instanceof Error ? error.message : String(error) })

/**
 * `tsc -p tsconfig.build.json` emits `.d.ts` declarations for the WHOLE
 * `src/` tree. The incremental cache (`BUILD_TSBUILDINFO`) makes a warm
 * re-run cheap, but `clean()` deletes that cache on every invocation of this
 * script by design (see its own comment), so this budget is sized for the
 * cold case a release build always pays.
 */
const DECLARATION_EMIT_TIMEOUT_MS = 180_000

/**
 * Incremental cache for the declaration emit (`tsconfig.build.json`).
 *
 * Kept in lockstep with the `tsBuildInfoFile` set there — if that path moves,
 * move this one too, or `clean()` silently stops cleaning and the bug in its
 * comment returns.
 */
const BUILD_TSBUILDINFO = join(PROJECT_ROOT, 'node_modules/.cache/tsc/tsconfig.build.tsbuildinfo')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run one build step, with its output attached to THIS process's terminal —
 * `inherit: true` reproduces the original `Bun.spawnSync(cmd, { stdout:
 * 'inherit', stderr: 'inherit' })` exactly, rather than buffering a
 * multi-minute `tsc` declaration emit into a post-hoc dump.
 *
 * The only spawn in this file, and therefore the only function that touches
 * `CommandService` — see the class comment on `BuildScriptError` for why the
 * rest of the pipeline stays plain `async`/sync (SC1).
 */
async function run(cmd: readonly string[], label: string, timeoutMs: number): Promise<void> {
  console.log(`\n${label}`)
  const program = spawn(cmd, {
    cwd: PROJECT_ROOT,
    inherit: true,
    timeout: timeoutMs,
    throwOnError: false,
  }).pipe(
    Effect.catchTags({
      CommandTimeoutError: () =>
        Effect.fail(new BuildScriptError({ message: `${label} timed out after ${timeoutMs}ms` })),
      CommandSpawnError: (error) =>
        Effect.fail(
          new BuildScriptError({
            message: `${label} failed to spawn: ${error.cause ? String(error.cause) : 'unknown error'}`,
          })
        ),
      // Unreachable under `throwOnError: false` — kept so the Effect's error
      // channel is exhaustively `BuildScriptError`.
      CommandFailedError: (error) =>
        Effect.fail(new BuildScriptError({ message: `${label} failed (exit ${error.exitCode})` })),
    })
  )

  let result: { readonly exitCode: number }
  try {
    result = await Effect.runPromise(program.pipe(Effect.provide(CommandServiceLive)))
  } catch (error) {
    throw toBuildScriptError(error)
  }
  if (result.exitCode !== 0) {
    throw new BuildScriptError({ message: `${label} failed (exit ${result.exitCode})` })
  }
}

function getExternalDeps(): readonly string[] {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'))
  const deps = Object.keys(pkg.dependencies ?? {})
  const peers = Object.keys(pkg.peerDependencies ?? {})
  return [...new Set([...deps, ...peers])]
}

// ---------------------------------------------------------------------------
// Step 1: Clean
// ---------------------------------------------------------------------------

/**
 * Remove `dist/` AND the declaration-emit incremental cache.
 *
 * The cache half is not housekeeping — without it the build is broken on the
 * second run. `tsc` decides whether to emit by consulting `.tsbuildinfo`, which
 * records that the outputs are already current. Deleting `dist/` does not tell
 * it otherwise, so step 3 no-ops, nothing writes `dist/index.d.ts`, and the
 * final output check fails with `Missing expected outputs: index.d.ts`.
 *
 * Reproduced: `bun run build` twice in a row, or `tsc -p tsconfig.build.json`
 * followed by any `dist/` removal. The first build always succeeds, which is
 * why this survived — the failure needs the cache to already exist.
 *
 * Only the BUILD cache is removed. `tsconfig.json`'s typecheck cache is a
 * separate file (see the `tsBuildInfoFile` note in `tsconfig.build.json`) and
 * is deliberately left warm, so building does not cold-bust `bun run quality`.
 */
function clean(): void {
  console.log('\nCleaning dist/ and the declaration-emit cache')
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true })
  }
  rmSync(BUILD_TSBUILDINFO, { force: true })
}

// ---------------------------------------------------------------------------
// Step 2: Bundle JS
// ---------------------------------------------------------------------------

async function bundleJS(): Promise<void> {
  // The embedded runtime-asset manifest (with { type: 'file' } imports of built
  // dist/ artifacts) is for the COMPILED BINARY only. npm-bundled mode reads
  // dist/ directly (the isBundled path) and never calls getRuntimeAssets(), so
  // exclude the manifest from the npm bundle — otherwise Bun's bundler follows
  // its dynamic import and fails to resolve dist/ files that aren't built yet.
  const externals = [...getExternalDeps(), '*/embedded-runtime-assets.generated']

  // Bundle library entry point
  // define process.env.NODE_ENV to force production JSX transform (jsx/jsxs
  // from react/jsx-runtime instead of jsxDEV from react/jsx-dev-runtime).
  // Code that needs runtime NODE_ENV detection (e.g. CSS compiler) uses an
  // indirect read pattern to avoid static replacement by define.
  console.log('\nBundling dist/index.js')
  const libResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'index.ts')],
    outdir: DIST_DIR,
    target: 'bun',
    format: 'esm',
    external: [...externals],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  })
  if (!libResult.success) {
    throw new BuildScriptError({
      message: ['Library bundle failed:', ...libResult.logs.map((log) => String(log))].join('\n'),
    })
  }

  // Bundle CLI entry point
  // The CLI was refactored from a single src/cli.ts file into a src/cli/
  // directory; the entry point is now src/cli/index.ts. An explicit
  // `naming.entry` keeps the output as dist/cli.js (without it Bun would emit
  // dist/index.js from the index.ts basename and collide with the library).
  console.log('Bundling dist/cli.js')
  const cliResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'cli', 'index.ts')],
    outdir: DIST_DIR,
    target: 'bun',
    format: 'esm',
    external: [...externals],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    naming: { entry: 'cli.js' },
  })
  if (!cliResult.success) {
    throw new BuildScriptError({
      message: ['CLI bundle failed:', ...cliResult.logs.map((log) => String(log))].join('\n'),
    })
  }
}

// ---------------------------------------------------------------------------
// Step 3: Generate .d.ts
// ---------------------------------------------------------------------------

async function generateDeclarations(): Promise<void> {
  // Addressed by path, not as `tsc`: node_modules/.bin/tsc is TypeScript 7
  // (tsgo's compiler, installed under the `@typescript/native` alias), and TS 7
  // rejects this repo's tsconfig outright. The release declaration emit must
  // stay on TypeScript 6. See `TSC_BIN` in
  // [internal ref].
  await run(
    ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    'Generating .d.ts declarations',
    DECLARATION_EMIT_TIMEOUT_MS
  )
}

// ---------------------------------------------------------------------------
// Step 4: Fix path aliases in .d.ts files
// ---------------------------------------------------------------------------

function resolveAlias(aliasPath: string, fileDir: string): string {
  // Target path relative to dist/ root (since @/ maps to src/ which maps to dist/ root)
  const fromDir = relative(DIST_DIR, fileDir)
  let relativePath = posix.relative(fromDir, aliasPath)

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  return relativePath
}

function fixPathAliases(): void {
  console.log('\nFixing @/ path aliases in .d.ts files')

  const glob = new Bun.Glob('**/*.d.ts')
  let fixCount = 0

  // Patterns to fix:
  // 1. from "@/..."  (import/export statements)
  // 2. import("@/...")  (dynamic import type expressions)
  const fromPattern = /(from\s+['"])@\/([^'"]+)(['"])/g
  const importTypePattern = /(import\(["'])@\/([^'"]+)(["']\))/g

  for (const file of glob.scanSync({ cwd: DIST_DIR })) {
    const filePath = join(DIST_DIR, file)
    const content = readFileSync(filePath, 'utf-8')

    // Quick check: skip files with no @/ references at all
    if (!content.includes('@/')) continue

    const fileDir = dirname(filePath)

    const fixed = content
      .replace(fromPattern, (_match, prefix, aliasPath, suffix) => {
        return `${prefix}${resolveAlias(aliasPath, fileDir)}${suffix}`
      })
      .replace(importTypePattern, (_match, prefix, aliasPath, suffix) => {
        return `${prefix}${resolveAlias(aliasPath, fileDir)}${suffix}`
      })

    if (fixed !== content) {
      writeFileSync(filePath, fixed)
      fixCount++
    }
  }

  console.log(`  Fixed aliases in ${fixCount} file(s)`)
}

// ---------------------------------------------------------------------------
// Step 5: Copy runtime assets needed by the npm package
// ---------------------------------------------------------------------------

/**
 * Copy and pre-build runtime assets for the npm package.
 *
 * When running as an npm package, only dist/ is available. The server
 * detects bundled mode via package-paths.ts and serves pre-built assets
 * from dist/ instead of building from src/ at runtime.
 *
 * Assets:
 * - dist/client-scripts/*.js  — Static JS files served as /assets/*.js
 * - dist/client-bundle.js     — Pre-built client runtime (forms, modals, etc.)
 * - dist/island-entry.js      — Pre-built island entry (React islands bootstrap)
 * - dist/island-chunks/*.js   — Code-split island component chunks
 */
async function copyRuntimeAssets(): Promise<void> {
  console.log('\nCopying and building runtime assets')
  await buildRuntimeAssets(DIST_DIR, SRC_DIR)
  console.log('  Built client-bundle.js, island-chunks/, and copied client scripts')
}

// ---------------------------------------------------------------------------
// Step 6: Add shebang to CLI
// ---------------------------------------------------------------------------

function addShebang(): void {
  console.log('\nAdding shebang to dist/cli.js')
  const cliPath = join(DIST_DIR, 'cli.js')
  const content = readFileSync(cliPath, 'utf-8')

  if (!content.startsWith('#!')) {
    writeFileSync(cliPath, '#!/usr/bin/env bun\n' + content)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Building Sovrium for npm publishing…')

  clean()
  await bundleJS()
  // `run()` is now async (it awaits a spawned `tsc` through CommandService),
  // where the original `Bun.spawnSync`-backed version blocked synchronously —
  // this `await` is load-bearing: `fixPathAliases()` reads the very `.d.ts`
  // files this step emits, and dropping it would let the two race.
  await generateDeclarations()
  fixPathAliases()
  await copyRuntimeAssets()
  addShebang()
  // Config types are not built here. `scripts/build/build-types.ts` is an INPUT to
  // the BINARY — `build-binary.ts` runs it, then wraps its output as the ambient
  // `declare module 'sovrium'` payload `sovrium types` writes out. Running it during
  // the npm build would produce an artifact nothing consumes, and nothing is
  // published to npm in any case.

  // Verify key outputs exist
  const required = ['index.js', 'cli.js', 'index.d.ts']
  const missing = required.filter((f) => !existsSync(join(DIST_DIR, f)))
  if (missing.length > 0) {
    throw new BuildScriptError({ message: `\nMissing expected outputs: ${missing.join(', ')}` })
  }

  console.log('\nBuild complete — dist/ ready for publishing')
}

// SC4 — the only `process.exit` in the file.
if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    printStderr(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
