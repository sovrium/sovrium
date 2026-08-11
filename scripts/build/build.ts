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
 *   bun run scripts/build.ts
 */

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, relative, dirname, posix } from 'node:path'
import { buildRuntimeAssets } from './lib/runtime-assets'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const SRC_DIR = join(PROJECT_ROOT, 'src')

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

function run(cmd: string[], label: string): void {
  console.log(`\n▸ ${label}`)
  const proc = Bun.spawnSync(cmd, { cwd: PROJECT_ROOT, stdout: 'inherit', stderr: 'inherit' })
  if (proc.exitCode !== 0) {
    console.error(`✗ ${label} failed (exit ${proc.exitCode})`)
    process.exit(1)
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
  console.log('\n▸ Cleaning dist/ and the declaration-emit cache')
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
  console.log('\n▸ Bundling dist/index.js')
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
    console.error('✗ Library bundle failed:')
    for (const log of libResult.logs) console.error(log)
    process.exit(1)
  }

  // Bundle CLI entry point
  // The CLI was refactored from a single src/cli.ts file into a src/cli/
  // directory; the entry point is now src/cli/index.ts. An explicit
  // `naming.entry` keeps the output as dist/cli.js (without it Bun would emit
  // dist/index.js from the index.ts basename and collide with the library).
  console.log('▸ Bundling dist/cli.js')
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
    console.error('✗ CLI bundle failed:')
    for (const log of cliResult.logs) console.error(log)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Step 3: Generate .d.ts
// ---------------------------------------------------------------------------

function generateDeclarations(): void {
  run(['bun', 'tsc', '-p', 'tsconfig.build.json'], 'Generating .d.ts declarations')
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
  console.log('\n▸ Fixing @/ path aliases in .d.ts files')

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
  console.log('\n▸ Copying and building runtime assets')
  await buildRuntimeAssets(DIST_DIR, SRC_DIR)
  console.log('  Built client-bundle.js, island-chunks/, and copied client scripts')
}

// ---------------------------------------------------------------------------
// Step 6: Add shebang to CLI
// ---------------------------------------------------------------------------

function addShebang(): void {
  console.log('\n▸ Adding shebang to dist/cli.js')
  const cliPath = join(DIST_DIR, 'cli.js')
  const content = readFileSync(cliPath, 'utf-8')

  if (!content.startsWith('#!')) {
    writeFileSync(cliPath, '#!/usr/bin/env bun\n' + content)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function buildTypesPackage(): void {
  console.log('\n▸ Building @sovrium/types package')
  const proc = Bun.spawnSync(['bun', 'run', 'scripts/build/build-types.ts'], {
    cwd: PROJECT_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (proc.exitCode !== 0) {
    console.error('✗ @sovrium/types build failed')
    process.exit(1)
  }
}

async function main(): Promise<void> {
  console.log('Building Sovrium for npm publishing...')

  clean()
  await bundleJS()
  generateDeclarations()
  fixPathAliases()
  await copyRuntimeAssets()
  addShebang()
  buildTypesPackage()

  // Verify key outputs exist
  const required = ['index.js', 'cli.js', 'index.d.ts']
  const missing = required.filter((f) => !existsSync(join(DIST_DIR, f)))
  if (missing.length > 0) {
    console.error(`\n✗ Missing expected outputs: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('\n✓ Build complete — dist/ ready for publishing')
}

await main()
