/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pre-publish Validation Script
 *
 * Validates package.json metadata and npm pack output before publishing.
 * Ensures the package meets quality standards for npm registry.
 *
 * Usage:
 *   bun run scripts/prepublish-check.ts
 *   bun run scripts/prepublish-check.ts --max-size=4  # Override max unpacked size (MB)
 *
 * Checks:
 *   1. License is SPDX-compliant (BUSL-1.1)
 *   2. Homepage doesn't point to GitHub
 *   3. engines.bun exists
 *   4. exports field exists
 *   5. No test files in package
 *   6. No CHANGELOG.md in package
 *   7. No schemas in package (generated artifacts, consumers regenerate via `bun run export:schema`)
 *   8. Unpacked size under threshold
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PackInfo {
  readonly files: readonly string[]
  readonly totalFiles: number
  readonly packedSizeKB: number
  readonly unpackedSizeMB: number
}

interface CheckResult {
  readonly label: string
  readonly passed: boolean
  readonly detail: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MAX_UNPACKED_MB = 3
const PROJECT_ROOT = join(import.meta.dir, '..')

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

function parseMaxSize(): number {
  const arg = process.argv.find((a) => a.startsWith('--max-size='))
  if (!arg) return DEFAULT_MAX_UNPACKED_MB
  const value = Number(arg.split('=')[1])
  if (Number.isNaN(value) || value <= 0) {
    console.error(`Invalid --max-size value: ${arg}`)
    process.exit(1)
  }
  return value
}

// ---------------------------------------------------------------------------
// npm pack --dry-run parser
// ---------------------------------------------------------------------------

async function getPackInfo(): Promise<PackInfo> {
  const proc = Bun.spawn(['npm', 'pack', '--dry-run'], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stderr = await new Response(proc.stderr).text()
  await proc.exited

  const lines = stderr.split('\n')
  const fileLines = lines.filter((l) => l.startsWith('npm notice') && !l.includes('Tarball'))

  // Extract files (lines that have a size prefix like "1.2kB")
  const files: string[] = []
  for (const line of fileLines) {
    const match = line.match(/^npm notice\s+[\d.]+[kMG]?B\s+(.+)$/)
    if (match?.[1]) {
      files.push(match[1].trim())
    }
  }

  // Extract total files
  const totalFilesLine = lines.find((l) => l.includes('total files:'))
  const totalFiles = totalFilesLine
    ? Number(totalFilesLine.match(/total files:\s*(\d+)/)?.[1] ?? 0)
    : files.length

  // Extract packed size
  const packedLine = lines.find((l) => l.includes('package size:'))
  const packedSizeKB = parseSize(packedLine, 'package size:')

  // Extract unpacked size
  const unpackedLine = lines.find((l) => l.includes('unpacked size:'))
  const unpackedSizeMB = parseSize(unpackedLine, 'unpacked size:') / 1024

  return { files, totalFiles, packedSizeKB, unpackedSizeMB }
}

function parseSize(line: string | undefined, label: string): number {
  if (!line) return 0
  const match = line.match(new RegExp(`${label}\\s+([\\d.]+)\\s*(B|kB|MB|GB)`))
  if (!match) return 0
  const value = Number(match[1])
  const unit = match[2]
  switch (unit) {
    case 'B':
      return value / 1024
    case 'kB':
      return value
    case 'MB':
      return value * 1024
    case 'GB':
      return value * 1024 * 1024
    default:
      return 0
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkLicense(pkg: Record<string, unknown>): CheckResult {
  const license = pkg['license'] as string | undefined
  const passed = license === 'BUSL-1.1'
  return {
    label: 'License',
    passed,
    detail: passed
      ? `${license} (SPDX)`
      : `"${license}" is not SPDX-compliant — expected "BUSL-1.1"`,
  }
}

function checkHomepage(pkg: Record<string, unknown>): CheckResult {
  const homepage = pkg['homepage'] as string | undefined
  const passed = !!homepage && !homepage.includes('github.com')
  return {
    label: 'Homepage',
    passed,
    detail: passed ? String(homepage) : `"${homepage}" points to GitHub — use project website`,
  }
}

function checkEngines(pkg: Record<string, unknown>): CheckResult {
  const engines = pkg['engines'] as Record<string, string> | undefined
  const bunVersion = engines?.['bun']
  const passed = !!bunVersion
  return {
    label: 'Engines',
    passed,
    detail: passed
      ? `bun ${bunVersion}`
      : 'Missing engines.bun — consumers need to know the runtime',
  }
}

function checkExports(pkg: Record<string, unknown>): CheckResult {
  const exports = pkg['exports'] as Record<string, unknown> | undefined
  const root = exports?.['.'] as Record<string, string> | undefined
  const entry = root?.['import']
  const passed = !!entry
  return {
    label: 'Exports',
    passed,
    detail: passed
      ? String(entry)
      : 'Missing exports["."].import — add entry point for module resolution',
  }
}

function checkNoTestFiles(pack: PackInfo): CheckResult {
  const testFiles = pack.files.filter((f) => /\.(test|spec)\.(ts|tsx)$/.test(f))
  const passed = testFiles.length === 0
  return {
    label: 'No test files in package',
    passed,
    detail: passed
      ? 'Clean'
      : `Found ${testFiles.length} test file(s): ${testFiles.slice(0, 3).join(', ')}`,
  }
}

function checkNoChangelog(pack: PackInfo): CheckResult {
  const has = pack.files.some((f) => f.toLowerCase() === 'changelog.md')
  const passed = !has
  return {
    label: 'No CHANGELOG.md in package',
    passed,
    detail: passed ? 'Excluded (saves ~580 KB)' : 'CHANGELOG.md included — remove from files array',
  }
}

function checkNoSchemas(pack: PackInfo): CheckResult {
  const schemas = pack.files.filter((f) => f.startsWith('schemas/'))
  const passed = schemas.length === 0
  return {
    label: 'No schemas in package',
    passed,
    detail: passed
      ? 'Excluded (consumers regenerate via bun run export:schema)'
      : `Found ${schemas.length} schema file(s) — remove schemas/** from files array`,
  }
}

function checkSize(pack: PackInfo, maxMB: number): CheckResult {
  const passed = pack.unpackedSizeMB <= maxMB
  const sizeFmt = pack.unpackedSizeMB.toFixed(1)
  return {
    label: 'Size',
    passed,
    detail: passed
      ? `${sizeFmt} MB unpacked (< ${maxMB} MB)`
      : `${sizeFmt} MB unpacked — exceeds ${maxMB} MB limit`,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const maxSize = parseMaxSize()

  // Read package.json
  const pkgPath = join(PROJECT_ROOT, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>

  // Run npm pack --dry-run
  const pack = await getPackInfo()

  // Run all checks
  const results: CheckResult[] = [
    checkLicense(pkg),
    checkHomepage(pkg),
    checkEngines(pkg),
    checkExports(pkg),
    checkNoTestFiles(pack),
    checkNoChangelog(pack),
    checkNoSchemas(pack),
    checkSize(pack, maxSize),
  ]

  // Print results
  console.log('')
  console.log('Pre-publish validation')
  console.log('──────────────────────')

  for (const r of results) {
    const icon = r.passed ? '[PASS]' : '[FAIL]'
    console.log(`${icon} ${r.label}: ${r.detail}`)
  }

  console.log('')
  console.log(
    `${pack.totalFiles} files, ${(pack.packedSizeKB / 1024).toFixed(1)} MB packed, ${pack.unpackedSizeMB.toFixed(1)} MB unpacked`
  )

  const failures = results.filter((r) => !r.passed)
  if (failures.length > 0) {
    console.log('')
    console.error(`${failures.length} check(s) failed.`)
    process.exit(1)
  }

  console.log('All checks passed.')
}

await main()
