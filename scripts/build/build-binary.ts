/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')


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


function run(cmd: readonly string[], label: string): void {
  console.log(`\n\u25b8 ${label}`)
  const proc = Bun.spawnSync(cmd as string[], {
    cwd: PROJECT_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if (proc.exitCode !== 0) {
    console.error(`\u2717 ${label} failed (exit ${proc.exitCode})`)
    process.exit(1)
  }
}

function getVersion(): string {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'))
  return pkg.version as string
}

function getCurrentTarget(): Target {
  const osMap: Record<string, string> = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
  const os = osMap[process.platform] ?? 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const name = `${os}-${arch}`
  const match = TARGETS.find((t) => t.name === name)
  if (!match) {
    console.error(`Unsupported platform: ${process.platform}-${process.arch}`)
    process.exit(1)
  }
  return match
}

function parseCliArgs(): { readonly targets: readonly Target[] } {
  const args = Bun.argv.slice(2)

  if (args.includes('--all')) {
    return { targets: TARGETS }
  }

  const targetIdx = args.indexOf('--target')
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    const targetName = args[targetIdx + 1]
    const match = TARGETS.find((t) => t.name === targetName)
    if (!match) {
      console.error(
        `Unknown target: ${targetName}\nAvailable: ${TARGETS.map((t) => t.name).join(', ')}`
      )
      process.exit(1)
    }
    return { targets: [match] }
  }

  return { targets: [{ ...getCurrentTarget(), outfile: 'sovrium' }] }
}

function formatSize(bytes: number): string {
  const MB = 1e6
  const KB = 1e3
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`
  return `${bytes} B`
}


function compileBinary(target: Target, version: string): void {
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
  ]

  run(cmd, `Compile binary for ${target.name}`)

  if (!existsSync(outPath)) {
    console.error(`\u2717 Binary not found at ${outPath}`)
    process.exit(1)
  }

  const stats = statSync(outPath)
  if (stats.size < 1_000_000) {
    console.error(`\u2717 Binary suspiciously small: ${formatSize(stats.size)}`)
    process.exit(1)
  }

  console.log(`  \u2713 ${target.outfile} (${formatSize(stats.size)})`)
}


console.log('Sovrium Binary Builder')
console.log('======================')

const { targets } = parseCliArgs()
const version = getVersion()

console.log(`Version: ${version}`)
console.log(`Targets: ${targets.map((t) => t.name).join(', ')}`)

run(['bun', 'run', 'scripts/build/generate-css-assets.ts'], 'Generate embedded CSS assets')

run(
  ['bun', 'run', 'scripts/build/generate-embedded-static-assets.ts'],
  'Generate embedded static-asset manifest'
)

run(['bun', 'run', 'scripts/build/build-runtime-assets.ts'], 'Build client/island runtime assets')
run(
  ['bun', 'run', 'scripts/build/generate-embedded-runtime-assets.ts'],
  'Generate embedded runtime-asset manifest'
)

for (const target of targets) {
  compileBinary(target, version)
}

console.log(`\n\u2713 Done! Built ${targets.length} binary/binaries.`)
