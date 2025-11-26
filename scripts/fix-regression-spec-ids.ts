/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Script to add spec IDs to regression tests that are missing them.
 *
 * Usage: bun run scripts/fix-regression-spec-ids.ts [--dry-run]
 *
 * This script:
 * 1. Finds all .spec.ts files in specs/
 * 2. Identifies regression tests without spec IDs
 * 3. Determines the prefix from existing @spec tests in the file
 * 4. Assigns the next sequential ID after the last @spec test
 */

import { Glob } from 'bun'
import { readFile, writeFile } from 'node:fs/promises'

const DRY_RUN = process.argv.includes('--dry-run')

interface RegressionTestInfo {
  file: string
  lineNumber: number
  testName: string
  prefix: string
  nextId: number
}

// Extract spec ID from test name
function extractSpecId(testName: string): { prefix: string; number: number } | null {
  // Match patterns like "API-ADMIN-BAN-USER-001:" or "APP-VERSION-001:"
  const match = testName.match(/^([A-Z]+-[A-Z0-9-]+-?)(\d{3}):/)
  if (match) {
    return {
      prefix: match[1],
      number: parseInt(match[2], 10),
    }
  }
  return null
}

// Find the prefix and highest ID from @spec tests in a file
function analyzeSpecTests(content: string): { prefix: string; highestId: number } | null {
  const specTestPattern = /test(?:\.fixme)?\(\s*['"`]([A-Z]+-[A-Z0-9-]+-?)(\d{3}):[^'"`]*['"`],\s*\{\s*tag:\s*['"`]@spec['"`]/g

  let prefix: string | null = null
  let highestId = 0

  let match
  while ((match = specTestPattern.exec(content)) !== null) {
    const testPrefix = match[1]
    const testNumber = parseInt(match[2], 10)

    if (!prefix) {
      prefix = testPrefix
    }

    if (testNumber > highestId) {
      highestId = testNumber
    }
  }

  return prefix ? { prefix, highestId } : null
}

// Find regression tests without spec IDs
function findRegressionWithoutId(content: string): Array<{ lineNumber: number; testName: string; originalLine: string }> {
  const lines = content.split('\n')
  const results: Array<{ lineNumber: number; testName: string; originalLine: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match test or test.fixme with a name that doesn't start with a spec ID
    const testMatch = line.match(/^\s*(test(?:\.fixme)?)\(\s*$/)
    if (testMatch) {
      // Look at next line for test name
      const nextLine = lines[i + 1]
      if (nextLine) {
        const nameMatch = nextLine.match(/^\s*['"`]([^'"`]+)['"`],\s*$/)
        if (nameMatch) {
          const testName = nameMatch[1]
          // Check if this test has @regression tag
          const tagLine = lines[i + 2]
          if (tagLine && tagLine.includes("'@regression'") || tagLine?.includes('"@regression"') || tagLine?.includes('`@regression`')) {
            // Check if it already has a spec ID
            if (!extractSpecId(testName)) {
              results.push({
                lineNumber: i + 2, // 1-indexed, point to the name line
                testName,
                originalLine: nextLine,
              })
            }
          }
        }
      }
    }

    // Also match single-line pattern: test.fixme('name', { tag: '@regression' },
    const singleLineMatch = line.match(/^\s*(test(?:\.fixme)?)\(\s*['"`]([^'"`]+)['"`],\s*\{\s*tag:\s*['"`]@regression['"`]/)
    if (singleLineMatch) {
      const testName = singleLineMatch[2]
      if (!extractSpecId(testName)) {
        results.push({
          lineNumber: i + 1,
          testName,
          originalLine: line,
        })
      }
    }
  }

  return results
}

// Add spec ID to a regression test
function addSpecIdToRegression(
  content: string,
  testName: string,
  prefix: string,
  nextId: number
): string {
  const paddedId = String(nextId).padStart(3, '0')
  const newId = `${prefix}${paddedId}`
  const newTestName = `${newId}: ${testName}`

  // Replace the test name in the content
  // Handle both single and double quotes
  const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(['"\`])${escapedName}\\1`, 'g')

  return content.replace(pattern, `$1${newTestName}$1`)
}

async function main() {
  console.log(DRY_RUN ? '🔍 Dry run - no files will be modified\n' : '🔧 Fixing regression tests without spec IDs\n')

  const glob = new Glob('specs/**/*.spec.ts')
  const files = await Array.fromAsync(glob.scan('.'))

  let totalFixed = 0
  const fixedFiles: string[] = []

  for (const file of files) {
    let content = await readFile(file, 'utf-8')
    const originalContent = content

    // Analyze @spec tests to get prefix and highest ID
    const specInfo = analyzeSpecTests(content)
    if (!specInfo) {
      continue // No @spec tests in this file, skip
    }

    // Find regression tests without IDs
    const regressionTests = findRegressionWithoutId(content)
    if (regressionTests.length === 0) {
      continue
    }

    let nextId = specInfo.highestId + 1

    for (const regression of regressionTests) {
      console.log(`📝 ${file}:${regression.lineNumber}`)
      console.log(`   Before: "${regression.testName}"`)
      console.log(`   After:  "${specInfo.prefix}${String(nextId).padStart(3, '0')}: ${regression.testName}"`)

      content = addSpecIdToRegression(content, regression.testName, specInfo.prefix, nextId)
      nextId++
      totalFixed++
    }

    if (content !== originalContent) {
      if (!DRY_RUN) {
        await writeFile(file, content)
      }
      fixedFiles.push(file)
      console.log('')
    }
  }

  console.log('═'.repeat(60))
  console.log(`\n✅ ${totalFixed} regression tests ${DRY_RUN ? 'would be' : 'have been'} fixed in ${fixedFiles.length} files`)

  if (DRY_RUN) {
    console.log('\nRun without --dry-run to apply changes')
  }
}

main().catch(console.error)
