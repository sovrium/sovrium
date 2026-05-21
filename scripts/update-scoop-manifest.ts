/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..')
const TEMPLATE_PATH = join(PROJECT_ROOT, 'scripts', 'scoop', 'sovrium.json.template')
const GITHUB_REPO = 'sovrium/sovrium'

interface CliArgs {
  readonly version: string
  readonly output?: string
  readonly dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = Bun.argv.slice(2)
  const versionIdx = args.indexOf('--version')
  const outputIdx = args.indexOf('--output')
  const dryRun = args.includes('--dry-run')

  const version = versionIdx !== -1 ? args[versionIdx + 1] : undefined
  if (!version) {
    console.error('Usage: bun run scripts/update-scoop-manifest.ts --version <ver>')
    process.exit(1)
  }

  return {
    version,
    output: outputIdx !== -1 ? args[outputIdx + 1] : undefined,
    dryRun,
  }
}

async function fetchChecksum(version: string, target: string): Promise<string> {
  const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/sovrium-${version}-${target}.sha256`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const text = await response.text()
    return text.trim().split(/\s+/)[0] ?? 'CHECKSUM_NOT_AVAILABLE'
  } catch (error) {
    console.error(`Warning: Could not fetch checksum for ${target}: ${error}`)
    return 'CHECKSUM_NOT_AVAILABLE'
  }
}

async function main(): Promise<void> {
  const { version, output, dryRun } = parseArgs()

  console.log(`Updating Scoop manifest for v${version}`)

  const windowsX64 = await fetchChecksum(version, 'windows-x64')

  console.log(`Checksums:`)
  console.log(`  windows-x64: ${windowsX64}`)

  const template = readFileSync(TEMPLATE_PATH, 'utf-8')
  const manifest = template
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{SHA256_WINDOWS_X64}}', windowsX64)

  if (dryRun) {
    console.log('\n--- Manifest (dry run) ---')
    console.log(manifest)
    return
  }

  const outputPath = output || join(PROJECT_ROOT, 'scripts', 'scoop', 'sovrium.json')
  writeFileSync(outputPath, manifest)
  console.log(`\nManifest written to ${outputPath}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
