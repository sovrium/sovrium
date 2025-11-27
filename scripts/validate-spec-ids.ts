/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validate Spec IDs
 *
 * Scans all E2E test files (.spec.ts) to ensure spec IDs are unique.
 * Duplicate spec IDs cause issues in the TDD automation queue.
 *
 * Usage:
 *   bun run scripts/validate-spec-ids.ts
 *
 * Exit codes:
 *   0 - All spec IDs are unique
 *   1 - Duplicate spec IDs found
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const SPECS_DIR = join(process.cwd(), 'specs')
const SPEC_ID_PATTERN = /'(APP-[A-Z]+-[0-9]{3}):/g

interface SpecLocation {
  file: string
  line: number
  fullMatch: string
}

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        if (entry.name !== '__snapshots__' && entry.name !== 'node_modules') {
          await walk(fullPath)
        }
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files.sort()
}

async function extractSpecIds(filePath: string): Promise<Map<string, SpecLocation>> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const specIds = new Map<string, SpecLocation>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Reset regex state
    SPEC_ID_PATTERN.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = SPEC_ID_PATTERN.exec(line)) !== null) {
      const specId = match[1]
      if (specId) {
        specIds.set(specId, {
          file: relative(process.cwd(), filePath),
          line: i + 1,
          fullMatch: line.trim().slice(0, 100),
        })
      }
    }
  }

  return specIds
}

async function main() {
  console.log('🔍 Validating spec IDs...\n')

  const specFiles = await findSpecFiles(SPECS_DIR)
  console.log(`📁 Found ${specFiles.length} spec files\n`)

  // Collect all spec IDs with their locations
  const allSpecIds = new Map<string, SpecLocation[]>()

  for (const file of specFiles) {
    const fileSpecIds = await extractSpecIds(file)

    for (const [specId, location] of fileSpecIds) {
      if (!allSpecIds.has(specId)) {
        allSpecIds.set(specId, [])
      }
      allSpecIds.get(specId)!.push(location)
    }
  }

  // Find duplicates
  const duplicates: Array<{ specId: string; locations: SpecLocation[] }> = []

  for (const [specId, locations] of allSpecIds) {
    if (locations.length > 1) {
      duplicates.push({ specId, locations })
    }
  }

  // Report results
  if (duplicates.length === 0) {
    console.log(`✅ All ${allSpecIds.size} spec IDs are unique\n`)
    process.exit(0)
  }

  console.log(`❌ Found ${duplicates.length} duplicate spec ID(s):\n`)

  for (const { specId, locations } of duplicates) {
    console.log(`  ${specId} (${locations.length} occurrences):`)
    for (const loc of locations) {
      console.log(`    - ${loc.file}:${loc.line}`)
    }
    console.log('')
  }

  console.log('━'.repeat(60))
  console.log('To fix: Rename duplicate spec IDs to be unique.')
  console.log('Format: APP-{FEATURE}-{NUMBER} (e.g., APP-TABLES-FIELDS-001)')
  console.log('━'.repeat(60))

  process.exit(1)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
