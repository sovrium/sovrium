/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Auto-fix missing GIVEN/WHEN/THEN comments in spec files
 *
 * Usage: bun run scripts/fix-spec-comments.ts
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const indent = line.match(/^(\s*)/)?.[1] || ''

    // Check if this is a page.goto line without a preceding WHEN comment
    if (
      trimmed.startsWith('await page.goto(') &&
      i > 0 &&
      !lines[i - 1].includes('// WHEN') &&
      !lines[i - 1].includes('// when') &&
      // Don't add if already has WHEN nearby (within 3 lines)
      !lines.slice(Math.max(0, i - 3), i).some((l) => l.includes('// WHEN'))
    ) {
      // Check if there's a GIVEN comment in the test (meaning we're in a test block)
      const testStart = findTestStart(lines, i)
      if (testStart >= 0) {
        const hasGiven = lines.slice(testStart, i).some((l) => l.includes('// GIVEN'))
        if (hasGiven) {
          result.push(`${indent}// WHEN: user navigates to the page`)
          fixes++
        }
      }
    }

    result.push(line)

    // Check if this is an expect line without a preceding THEN comment
    if (
      (trimmed.startsWith('await expect(') || trimmed.startsWith('expect(')) &&
      !trimmed.includes('.toHaveScreenshot') && // Visual snapshots are assertions but contextual
      i > 0 &&
      !lines[i - 1].includes('// THEN') &&
      !lines[i - 1].includes('// then') &&
      // Don't add if it's continuation of assertions (another expect right before)
      !lines[i - 1].trim().startsWith('await expect(') &&
      !lines[i - 1].trim().startsWith('expect(') &&
      // Don't add if already has THEN nearby (within 3 lines)
      !lines.slice(Math.max(0, i - 3), i).some((l) => l.includes('// THEN'))
    ) {
      // Check if there's a WHEN comment before this
      const testStart = findTestStart(lines, i)
      if (testStart >= 0) {
        const hasWhen = lines.slice(testStart, i).some((l) => l.includes('// WHEN'))
        // Only add THEN if there's already a structure (GIVEN + WHEN)
        const hasGiven = lines.slice(testStart, i).some((l) => l.includes('// GIVEN'))
        if (hasGiven && hasWhen && i > 0 && !lines[i - 1].includes('// THEN')) {
          // Insert THEN before this line (we need to modify the result array)
          const lastLine = result.pop()! // Remove the current line we just added
          result.push(`${indent}// THEN: assertion`)
          result.push(lastLine)
          fixes++
        }
      }
    }
  }

  return { content: result.join('\n'), fixes }
}

function findTestStart(lines: string[], currentIndex: number): number {
  // Walk backwards to find the start of the test
  for (let i = currentIndex; i >= 0; i--) {
    if (lines[i].includes('test(') || lines[i].includes('test.fixme(')) {
      return i
    }
    // If we hit a test.describe, stop
    if (lines[i].includes('test.describe(')) {
      return -1
    }
  }
  return -1
}

async function main() {
  console.log('🔧 Fixing spec comments...')
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
