/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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

import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, relative, dirname, posix } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const SRC_DIR = join(PROJECT_ROOT, 'src')

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

function clean(): void {
  console.log('\n▸ Cleaning dist/')
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true })
  }
}

// ---------------------------------------------------------------------------
// Step 2: Bundle JS
// ---------------------------------------------------------------------------

async function bundleJS(): Promise<void> {
  const externals = getExternalDeps()

  // Bundle library entry point
  console.log('\n▸ Bundling dist/index.js')
  const libResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'index.ts')],
    outdir: DIST_DIR,
    target: 'bun',
    format: 'esm',
    external: [...externals],
  })
  if (!libResult.success) {
    console.error('✗ Library bundle failed:')
    for (const log of libResult.logs) console.error(log)
    process.exit(1)
  }

  // Bundle CLI entry point
  console.log('▸ Bundling dist/cli.js')
  const cliResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'cli.ts')],
    outdir: DIST_DIR,
    target: 'bun',
    format: 'esm',
    external: [...externals],
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

  // 1. Copy client-side static scripts
  const clientScriptsDir = join(DIST_DIR, 'client-scripts')
  mkdirSync(clientScriptsDir, { recursive: true })

  const clientScriptsSrc = join(SRC_DIR, 'presentation', 'scripts', 'client')
  const scripts = ['scroll-animation.js', 'language-switcher.js', 'banner-dismiss.js']

  for (const script of scripts) {
    const src = join(clientScriptsSrc, script)
    if (existsSync(src)) {
      copyFileSync(src, join(clientScriptsDir, script))
    }
  }
  console.log(`  Copied ${scripts.length} client script(s)`)

  // 2. Pre-build client runtime bundle (src/presentation/client.ts → dist/client-bundle.js)
  console.log('  Building client runtime bundle...')
  const clientResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'presentation', 'client.ts')],
    outdir: DIST_DIR,
    target: 'browser',
    format: 'esm',
    minify: true,
    naming: { entry: 'client-bundle.js' },
  })
  if (!clientResult.success) {
    console.error('  ✗ Client bundle build failed:')
    for (const log of clientResult.logs) console.error(log)
    process.exit(1)
  }
  console.log('  Built dist/client-bundle.js')

  // 3. Pre-build island entry bundle with code splitting
  console.log('  Building island entry bundle...')
  const islandOutDir = join(DIST_DIR, 'island-chunks')
  mkdirSync(islandOutDir, { recursive: true })

  const islandResult = await Bun.build({
    entrypoints: [join(SRC_DIR, 'presentation', 'islands', 'island-client.tsx')],
    outdir: islandOutDir,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: true,
    naming: {
      entry: 'island-entry.js',
      chunk: '[name]-[hash].js',
    },
  })
  if (!islandResult.success) {
    console.error('  ✗ Island bundle build failed:')
    for (const log of islandResult.logs) console.error(log)
    process.exit(1)
  }
  console.log(`  Built island entry + ${islandResult.outputs.length - 1} chunk(s)`)
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

async function main(): Promise<void> {
  console.log('Building Sovrium for npm publishing...')

  clean()
  await bundleJS()
  generateDeclarations()
  fixPathAliases()
  await copyRuntimeAssets()
  addShebang()

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
