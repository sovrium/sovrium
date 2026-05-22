/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, relative, dirname, posix } from 'node:path'
import { buildRuntimeAssets } from './lib/runtime-assets'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const SRC_DIR = join(PROJECT_ROOT, 'src')


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


function clean(): void {
  console.log('\n▸ Cleaning dist/')
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true })
  }
}


async function bundleJS(): Promise<void> {
  const externals = [...getExternalDeps(), '*/embedded-runtime-assets.generated']

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


function generateDeclarations(): void {
  run(['bun', 'tsc', '-p', 'tsconfig.build.json'], 'Generating .d.ts declarations')
}


function resolveAlias(aliasPath: string, fileDir: string): string {
  const fromDir = relative(DIST_DIR, fileDir)
  let relativePath = posix.relative(fromDir, aliasPath)

  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath
  }

  return relativePath
}

function fixPathAliases(): void {
  console.log('\n▸ Fixing @/ path aliases in .d.ts files')

  const glob = new Bun.Glob('**/*.d.ts')
  let fixCount = 0

  const fromPattern = /(from\s+['"])@\/([^'"]+)(['"])/g
  const importTypePattern = /(import\(["'])@\/([^'"]+)(["']\))/g

  for (const file of glob.scanSync({ cwd: DIST_DIR })) {
    const filePath = join(DIST_DIR, file)
    const content = readFileSync(filePath, 'utf-8')

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


async function copyRuntimeAssets(): Promise<void> {
  console.log('\n▸ Copying and building runtime assets')
  await buildRuntimeAssets(DIST_DIR, SRC_DIR)
  console.log('  Built client-bundle.js, island-chunks/, and copied client scripts')
}


function addShebang(): void {
  console.log('\n▸ Adding shebang to dist/cli.js')
  const cliPath = join(DIST_DIR, 'cli.js')
  const content = readFileSync(cliPath, 'utf-8')

  if (!content.startsWith('#!')) {
    writeFileSync(cliPath, '#!/usr/bin/env bun\n' + content)
  }
}


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

  const required = ['index.js', 'cli.js', 'index.d.ts']
  const missing = required.filter((f) => !existsSync(join(DIST_DIR, f)))
  if (missing.length > 0) {
    console.error(`\n✗ Missing expected outputs: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('\n✓ Build complete — dist/ ready for publishing')
}

await main()
