/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Update Homebrew Formula - Generates a Homebrew formula from template + release checksums
 *
 * Fetches SHA256 checksums from a GitHub Release and produces a ready-to-commit
 * Formula/sovrium.rb file for the sovrium/homebrew-tap repository.
 *
 * Usage:
 *   bun run scripts/build/update-homebrew-formula.ts --version 0.3.0
 *   bun run scripts/build/update-homebrew-formula.ts --version 0.3.0 --output Formula/sovrium.rb
 *   bun run scripts/build/update-homebrew-formula.ts --version 0.3.0 --dry-run
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { assertNoUnresolvedChecksums, fetchChecksum } from '../lib/release-checksums'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TEMPLATE_PATH = join(PROJECT_ROOT, 'scripts', 'build', 'homebrew', 'sovrium.rb.template')

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
    printStderr('Usage: bun run scripts/build/update-homebrew-formula.ts --version <ver>')
    process.exit(1)
  }

  return {
    version,
    output: outputIdx !== -1 ? args[outputIdx + 1] : undefined,
    dryRun,
  }
}

async function main(): Promise<void> {
  const { version, output, dryRun } = parseArgs()

  console.log(`Updating Homebrew formula for v${version}`)

  // Fetch checksums for all platforms
  const [darwinX64, darwinArm64, linuxX64, linuxArm64] = await Promise.all([
    fetchChecksum(version, 'darwin-x64'),
    fetchChecksum(version, 'darwin-arm64'),
    fetchChecksum(version, 'linux-x64'),
    fetchChecksum(version, 'linux-arm64'),
  ])

  console.log(`Checksums:`)
  console.log(`  darwin-x64:   ${darwinX64}`)
  console.log(`  darwin-arm64: ${darwinArm64}`)
  console.log(`  linux-x64:    ${linuxX64}`)
  console.log(`  linux-arm64:  ${linuxArm64}`)

  // Read template and substitute
  const template = readFileSync(TEMPLATE_PATH, 'utf-8')
  const formula = template
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{SHA256_DARWIN_X64}}', darwinX64)
    .replaceAll('{{SHA256_DARWIN_ARM64}}', darwinArm64)
    .replaceAll('{{SHA256_LINUX_X64}}', linuxX64)
    .replaceAll('{{SHA256_LINUX_ARM64}}', linuxArm64)

  // Never print, write, or commit a formula pinning an unresolved checksum.
  assertNoUnresolvedChecksums(formula, `Homebrew formula v${version}`)

  if (dryRun) {
    console.log('\n--- Formula (dry run) ---')
    console.log(formula)
    return
  }

  const outputPath = output || join(PROJECT_ROOT, 'scripts', 'build', 'homebrew', 'sovrium.rb')
  writeFileSync(outputPath, formula)
  console.log(`\nFormula written to ${outputPath}`)
}

main().catch((error) => {
  printStderr(
    `Error: The Homebrew formula was not updated.\n${
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    }`
  )
  process.exit(1)
})
