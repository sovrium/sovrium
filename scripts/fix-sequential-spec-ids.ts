/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fix non-sequential spec IDs by renumbering them
 *
 * Transforms category-based IDs like:
 *   API-ADMIN-BAN-USER-SUCCESS-001
 *   API-ADMIN-BAN-USER-SUCCESS-WITH-REASON-001
 *   API-ADMIN-BAN-USER-VALIDATION-REQUIRED-USER-ID-001
 *
 * Into sequential IDs like:
 *   API-ADMIN-BAN-USER-001
 *   API-ADMIN-BAN-USER-002
 *   API-ADMIN-BAN-USER-003
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const SPECS_DIR = join(process.cwd(), 'specs')

// Pattern to match spec IDs in test names
// Captures: prefix (e.g., API-ADMIN-BAN-USER), middle parts, and number
const SPEC_ID_PATTERN = /^([A-Z]+-[A-Z0-9-]+?)-(\d{3}):/

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory() && entry.name !== '__snapshots__') {
        await walk(fullPath)
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files.sort()
}

function extractBasePrefix(specId: string): string {
  // Extract base prefix by finding common patterns
  // E.g., API-ADMIN-BAN-USER-SUCCESS-001 -> API-ADMIN-BAN-USER
  // E.g., APP-THEME-COLORS-APPLICATION-001 -> APP-THEME-COLORS

  // Remove the trailing number
  const withoutNumber = specId.replace(/-\d{3}$/, '')

  // Common category suffixes to remove
  const categorySuffixes = [
    '-SUCCESS-WITH-REASON',
    '-SUCCESS-PRE-VERIFIED',
    '-SUCCESS-PARTIAL-UPDATE',
    '-SUCCESS-REVOKE-SESSIONS',
    '-SUCCESS-AUTO-SLUG',
    '-SUCCESS-PAGINATION',
    '-SUCCESS-SINGLE-SESSION',
    '-SUCCESS-FILTER-PENDING',
    '-SUCCESS-EMPTY',
    '-SUCCESS',
    '-VALIDATION-REQUIRED-USER-ID',
    '-VALIDATION-REQUIRED-NEW-EMAIL',
    '-VALIDATION-REQUIRED-NEW-PASSWORD',
    '-VALIDATION-REQUIRED-EMAIL',
    '-VALIDATION-REQUIRED-TOKEN',
    '-VALIDATION-REQUIRED-SESSION-ID',
    '-VALIDATION-REQUIRED-ORGANIZATION-ID',
    '-VALIDATION-REQUIRED-INVITATION-ID',
    '-VALIDATION-REQUIRED-FIELDS',
    '-VALIDATION-REQUIRED-NAME',
    '-VALIDATION',
    '-PERMISSIONS-UNAUTHORIZED-NO-TOKEN',
    '-PERMISSIONS-UNAUTHORIZED',
    '-PERMISSIONS-FORBIDDEN-NON-ADMIN',
    '-PERMISSIONS-FORBIDDEN-MEMBER',
    '-PERMISSIONS-FORBIDDEN',
    '-SECURITY-NONEXISTENT-EMAIL',
    '-SECURITY',
    '-NOT-FOUND',
    '-EDGE-CASE-ALREADY-BANNED',
    '-EDGE-CASE',
    '-APPLICATION',
    '-INTEGRATION',
    '-FIELDS',
    '-SCHEMA-CREATE',
    '-SCHEMA-FIELDS',
    '-DELETE',
    '-BATCH',
  ]

  let result = withoutNumber
  for (const suffix of categorySuffixes) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length)
      break
    }
  }

  return result
}

function renumberSpecIds(content: string, filePath: string): { content: string; changes: number } {
  let changes = 0
  const lines = content.split('\n')

  // Find all spec IDs and their base prefixes
  const specIdMatches: { line: number; fullId: string; basePrefix: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match test definitions with spec IDs
    const testMatch = line.match(/(['"`])([A-Z]+-[A-Z0-9-]+-\d{3}):/)
    if (testMatch) {
      const fullId = testMatch[2]
      const basePrefix = extractBasePrefix(fullId)
      specIdMatches.push({ line: i, fullId, basePrefix })
    }
  }

  if (specIdMatches.length === 0) return { content, changes: 0 }

  // Group by base prefix to detect if all IDs in file share same prefix
  const prefixCounts = new Map<string, number>()
  for (const match of specIdMatches) {
    prefixCounts.set(match.basePrefix, (prefixCounts.get(match.basePrefix) || 0) + 1)
  }

  // Find the most common prefix (the file's base prefix)
  let fileBasePrefix = ''
  let maxCount = 0
  for (const [prefix, count] of prefixCounts) {
    if (count > maxCount) {
      maxCount = count
      fileBasePrefix = prefix
    }
  }

  // Renumber sequentially
  let counter = 1
  for (const match of specIdMatches) {
    const newNumber = counter.toString().padStart(3, '0')
    const newId = `${fileBasePrefix}-${newNumber}`

    if (match.fullId !== newId) {
      const oldPattern = new RegExp(escapeRegex(match.fullId), 'g')
      lines[match.line] = lines[match.line].replace(oldPattern, newId)
      changes++
    }
    counter++
  }

  return { content: lines.join('\n'), changes }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function main() {
  console.log('🔧 Fixing non-sequential spec IDs...')
  console.log('')

  const files = await findSpecFiles(SPECS_DIR)
  let totalChanges = 0
  let filesChanged = 0

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8')
    const { content: newContent, changes } = renumberSpecIds(content, filePath)

    if (changes > 0) {
      await writeFile(filePath, newContent)
      const relativePath = filePath.replace(SPECS_DIR + '/', '')
      console.log(`✅ ${relativePath}: ${changes} IDs renumbered`)
      totalChanges += changes
      filesChanged++
    }
  }

  console.log('')
  console.log('━'.repeat(60))
  console.log(`Total: ${totalChanges} IDs renumbered in ${filesChanged} files`)
  console.log('━'.repeat(60))
}

main().catch(console.error)
