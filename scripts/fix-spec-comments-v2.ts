/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Auto-fix missing GIVEN/WHEN/THEN comments in spec files - V2
 *
 * This version adds comments to tests that have none at all.
 *
 * Usage: bun run scripts/fix-spec-comments-v2.ts
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const SPECS_DIR = join(process.cwd(), 'specs')

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

function fixSpecComments(content: string): { content: string; fixes: number } {
  let fixes = 0
  const lines = content.split('\n')
  const result: string[] = []

  // Pattern to detect test function start
  const testStartPattern = /^\s*(test\.fixme|test)\s*\(\s*$/
  const testNamePattern = /^\s*['"`]([^'"`]+)['"`],?\s*$/
  const tagPattern = /^\s*\{\s*tag:\s*['"`]@(spec|regression)['"`]\s*\},?\s*$/
  const asyncFnPattern = /^\s*async\s*\(\s*\{.*\}\s*\)\s*=>\s*\{\s*$/

  // Track state while processing
  let inTestBlock = false
  let testStartLine = -1
  let foundAsync = false
  let hasGiven = false
  let hasWhen = false
  let hasThen = false
  let awaitLineIndex = -1
  let firstExpectIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const indent = line.match(/^(\s*)/)?.[1] || ''

    // Detect start of a test block
    if (trimmed.match(/^(test\.fixme|test)\s*\(/) && !trimmed.includes('test.describe')) {
      inTestBlock = true
      testStartLine = i
      foundAsync = false
      hasGiven = false
      hasWhen = false
      hasThen = false
      awaitLineIndex = -1
      firstExpectIndex = -1
    }

    // Track existing comments
    if (inTestBlock) {
      if (/\/\/\s*GIVEN/i.test(line)) hasGiven = true
      if (/\/\/\s*(WHEN|GIVEN\/WHEN)/i.test(line)) hasWhen = true
      if (/\/\/\s*(THEN|WHEN\/THEN)/i.test(line)) hasThen = true

      // Track async function start
      if (trimmed.startsWith('async (') && trimmed.includes('=>')) {
        foundAsync = true
      }

      // Track first await startServerWithSchema or other setup
      if (
        foundAsync &&
        awaitLineIndex === -1 &&
        (trimmed.startsWith('await startServerWithSchema') ||
          trimmed.startsWith('await generateStaticSite'))
      ) {
        awaitLineIndex = i
      }

      // Track first await page.goto
      if (foundAsync && trimmed.startsWith('await page.goto(')) {
        if (awaitLineIndex === -1) awaitLineIndex = i
      }

      // Track first expect
      if (
        foundAsync &&
        firstExpectIndex === -1 &&
        (trimmed.startsWith('await expect(') || trimmed.startsWith('expect('))
      ) {
        firstExpectIndex = i
      }
    }

    result.push(line)

    // Detect end of test block and add missing comments
    if (inTestBlock && trimmed === '}') {
      // Count braces to know when we're at the end of the test
      let braceCount = 0
      for (let j = testStartLine; j <= i; j++) {
        const testLine = lines[j]
        for (const char of testLine) {
          if (char === '{') braceCount++
          if (char === '}') braceCount--
        }
      }

      if (braceCount === 0) {
        // End of test block - check if we need to add comments
        if (!hasGiven && !hasWhen && !hasThen && foundAsync) {
          // Need to add all three comments
          // We'll need to rebuild this section
          const testSection = result.slice(result.length - (i - testStartLine + 1))
          result.splice(result.length - (i - testStartLine + 1))

          // Process test section and add comments
          let addedGiven = false
          let addedWhen = false

          for (let k = 0; k < testSection.length; k++) {
            const testLine = testSection[k]
            const testTrimmed = testLine.trim()
            const testIndent = testLine.match(/^(\s*)/)?.[1] || ''

            // Add GIVEN before first await startServerWithSchema
            if (
              !addedGiven &&
              (testTrimmed.startsWith('await startServerWithSchema') ||
                testTrimmed.startsWith('await generateStaticSite'))
            ) {
              result.push(`${testIndent}// GIVEN: app configuration`)
              addedGiven = true
              fixes++
            }

            // Add WHEN before page.goto
            if (!addedWhen && addedGiven && testTrimmed.startsWith('await page.goto(')) {
              result.push(`${testIndent}// WHEN: user navigates to the page`)
              addedWhen = true
              fixes++
            }

            // Add THEN before first expect (if we already have WHEN)
            if (
              addedWhen &&
              (testTrimmed.startsWith('await expect(') || testTrimmed.startsWith('expect(')) &&
              k > 0 &&
              !testSection[k - 1].includes('// THEN')
            ) {
              result.push(`${testIndent}// THEN: assertion`)
              fixes++
              // Only add THEN once
              addedWhen = false // Prevent adding more THENs
            }

            result.push(testLine)
          }
        }

        inTestBlock = false
      }
    }
  }

  return { content: result.join('\n'), fixes }
}

async function main() {
  console.log('🔧 Fixing spec comments (v2)...')
  console.log('')

  const files = await findSpecFiles(SPECS_DIR)
  let totalFixes = 0
  let filesFixed = 0

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8')
    const { content: fixedContent, fixes } = fixSpecComments(content)

    if (fixes > 0) {
      await writeFile(filePath, fixedContent)
      console.log(`✅ ${filePath.replace(SPECS_DIR + '/', '')}: ${fixes} fixes`)
      totalFixes += fixes
      filesFixed++
    }
  }

  console.log('')
  console.log('━'.repeat(60))
  console.log(`Total: ${totalFixes} fixes in ${filesFixed} files`)
  console.log('━'.repeat(60))
}

main().catch(console.error)
