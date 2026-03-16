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

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
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
// Step 5: Add shebang to CLI
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
