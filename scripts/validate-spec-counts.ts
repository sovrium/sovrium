/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Spec Count Validator
 *
 * Validates that the "Spec Count: X" comment in spec file headers matches
 * the actual number of @spec tests in each file.
 *
 * Usage:
 *   bun run scripts/validate-spec-counts.ts          # Validate only
 *   bun run scripts/validate-spec-counts.ts --fix    # Auto-fix mismatches
 *   bun run validate:spec-counts                     # npm script
 *   bun run validate:spec-counts --fix               # npm script with auto-fix
 *
 * Exit codes:
 *   0 - All spec counts are valid (or fixed with --fix)
 *   1 - One or more spec counts are invalid
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

// =============================================================================
// Types
// =============================================================================

interface ValidationResult {
  file: string
  filePath: string
  headerCount: number | null
  actualCount: number
  isValid: boolean
  error?: string
  fixed?: boolean
}

// =============================================================================
// Constants
// =============================================================================

const SPECS_DIR = join(process.cwd(), 'specs')

// Pattern to match "Spec Count: X" in header comments
const SPEC_COUNT_PATTERN = /\*\s*Spec Count:\s*(\d+)/

// Pattern to match @spec tagged tests (both test() and test.fixme())
const SPEC_TEST_PATTERN =
  /test(?:\.fixme)?\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\{\s*tag:\s*['"`]@spec['"`]/g

// =============================================================================
// Functions
// =============================================================================

async function findSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        // Skip __snapshots__ directories
        if (entry.name !== '__snapshots__') {
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

function extractHeaderSpecCount(content: string): number | null {
  // Only look in the first 50 lines (header comment area)
  const headerLines = content.split('\n').slice(0, 50).join('\n')
  const match = headerLines.match(SPEC_COUNT_PATTERN)
  if (match?.[1]) {
    return parseInt(match[1], 10)
  }
  return null
}

function countActualSpecTests(content: string): number {
  const matches = content.match(SPEC_TEST_PATTERN)
  return matches ? matches.length : 0
}

async function fixSpecCount(filePath: string, actualCount: number): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8')

  // Replace the spec count in the header
  const updatedContent = content.replace(/(\*\s*Spec Count:\s*)\d+/, `$1${actualCount}`)

  if (updatedContent !== content) {
    await writeFile(filePath, updatedContent)
    return true
  }
  return false
}

async function validateFile(
  filePath: string,
  shouldFix: boolean = false
): Promise<ValidationResult> {
  const content = await readFile(filePath, 'utf-8')
  const relativePath = relative(SPECS_DIR, filePath)

  const headerCount = extractHeaderSpecCount(content)
  const actualCount = countActualSpecTests(content)

  if (headerCount === null) {
    return {
      file: relativePath,
      filePath,
      headerCount: null,
      actualCount,
      isValid: true, // No header count means no validation needed
      error: 'No Spec Count header found (optional)',
    }
  }

  let isValid = headerCount === actualCount
  let fixed = false

  // Auto-fix if requested and there's a mismatch
  if (!isValid && shouldFix) {
    fixed = await fixSpecCount(filePath, actualCount)
    if (fixed) {
      isValid = true
    }
  }

  return {
    file: relativePath,
    filePath,
    headerCount,
    actualCount,
    isValid,
    fixed,
    error: isValid ? undefined : `Header says ${headerCount}, actual is ${actualCount}`,
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const shouldFix = args.includes('--fix')

  console.log(shouldFix ? 'Validating and fixing spec counts...' : 'Validating spec counts...')
  console.log('')

  const specFiles = await findSpecFiles(SPECS_DIR)
  console.log(`Found ${specFiles.length} spec files`)
  console.log('')

  const results: ValidationResult[] = []

  for (const filePath of specFiles) {
    const result = await validateFile(filePath, shouldFix)
    results.push(result)
  }

  // Separate results
  const validResults = results.filter((r) => r.isValid && r.headerCount !== null && !r.fixed)
  const fixedResults = results.filter((r) => r.fixed)
  const invalidResults = results.filter((r) => !r.isValid)
  const noHeaderResults = results.filter((r) => r.headerCount === null)

  // Print results
  for (const result of validResults) {
    console.log(`✅ ${result.file} (${result.actualCount} specs)`)
  }

  for (const result of fixedResults) {
    console.log(`🔧 ${result.file} (${result.headerCount} → ${result.actualCount} specs)`)
  }

  if (invalidResults.length > 0) {
    console.log('')
    console.log('─'.repeat(60))
    console.log('❌ MISMATCHES FOUND:')
    console.log('─'.repeat(60))
    for (const result of invalidResults) {
      console.log(`❌ ${result.file}`)
      console.log(`   Header says: ${result.headerCount} specs`)
      console.log(`   Actual count: ${result.actualCount} specs`)
      console.log('')
    }
  }

  if (noHeaderResults.length > 0) {
    console.log('')
    console.log('─'.repeat(60))
    console.log(`ℹ️  ${noHeaderResults.length} files without Spec Count header (optional)`)
    console.log('─'.repeat(60))
  }

  // Summary
  console.log('')
  console.log('━'.repeat(60))
  console.log('SUMMARY')
  console.log('━'.repeat(60))
  console.log(`Total files: ${results.length}`)
  console.log(`Valid: ${validResults.length}`)
  if (fixedResults.length > 0) {
    console.log(`Fixed: ${fixedResults.length}`)
  }
  console.log(`Invalid: ${invalidResults.length}`)
  console.log(`No header: ${noHeaderResults.length}`)
  console.log('━'.repeat(60))

  if (invalidResults.length > 0) {
    console.log('')
    console.log('❌ Spec count validation FAILED')
    console.log('')
    console.log('To fix automatically, run:')
    console.log('  bun run validate:spec-counts --fix')
    process.exit(1)
  }

  if (fixedResults.length > 0) {
    console.log('')
    console.log(`🔧 Fixed ${fixedResults.length} files with incorrect spec counts`)
  }

  console.log('')
  console.log('✅ All spec counts are valid!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
