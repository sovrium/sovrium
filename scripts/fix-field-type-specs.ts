/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fix GIVEN/WHEN/THEN comments in field-type spec files
 *
 * Pattern for field-type tests:
 * - await startServerWithSchema({...}) -> GIVEN
 * - const xxx = await executeQuery(...) -> WHEN
 * - expect(...) -> THEN
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const FIELD_TYPES_DIR = join(process.cwd(), 'specs/app/tables/field-types')

async function findSpecFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.spec.ts'))
    .map((e) => join(dir, e.name))
}

function addCommentsToTest(content: string): { content: string; fixes: number } {
  let fixes = 0
  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const indent = line.match(/^(\s*)/)?.[1] || ''

    // Check if previous line already has a comment
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const hasPrevComment = prevLine.startsWith('//')

    // Add GIVEN before startServerWithSchema or executeQuery array setup (if no comment exists)
    if (
      (trimmed.startsWith('await startServerWithSchema(') ||
        (trimmed.startsWith('await executeQuery([') && !prevLine.includes('// GIVEN'))) &&
      !hasPrevComment
    ) {
      result.push(`${indent}// GIVEN: table configuration`)
      fixes++
    }

    // Add WHEN before executeQuery after GIVEN (if no comment exists)
    const isExecuteQuery =
      (trimmed.startsWith('const ') && trimmed.includes('await executeQuery(')) ||
      (trimmed.startsWith('await executeQuery(') && !trimmed.startsWith('await executeQuery(['))

    // Combined WHEN/THEN for await expect(...).rejects patterns
    // Check if this is start of multi-line expect().rejects/resolves
    let isExpectRejects = false
    if (trimmed.startsWith('await expect(')) {
      // Check if .rejects/.resolves is on this line or a following line
      if (trimmed.includes('.rejects') || trimmed.includes('.resolves')) {
        isExpectRejects = true
      } else {
        // Look ahead for .rejects/.resolves within next few lines (multi-line expect)
        for (let k = i + 1; k < Math.min(lines.length, i + 5); k++) {
          const nextLine = lines[k].trim()
          if (nextLine.includes('.rejects') || nextLine.includes('.resolves')) {
            isExpectRejects = true
            break
          }
          if (nextLine.startsWith('expect(') || nextLine.startsWith('await ')) break
        }
      }
    }

    if (isExecuteQuery && !hasPrevComment) {
      // Look back to test start to find GIVEN/WHEN
      let hasGiven = false
      let hasWhen = false
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].includes('// GIVEN')) hasGiven = true
        if (lines[j].includes('// WHEN')) hasWhen = true
        if (lines[j].includes('test.fixme(') || lines[j].includes('test(')) break
      }

      if (hasGiven && !hasWhen) {
        result.push(`${indent}// WHEN: executing query`)
        fixes++
      }
    }

    // Add combined WHEN/THEN for expect(...).rejects patterns
    if (isExpectRejects && !hasPrevComment) {
      let hasGiven = false
      let hasWhen = false
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].includes('// GIVEN')) hasGiven = true
        if (lines[j].includes('// WHEN')) hasWhen = true
        if (lines[j].includes('test.fixme(') || lines[j].includes('test(')) break
      }

      if (hasGiven && !hasWhen) {
        result.push(`${indent}// WHEN/THEN: executing query and asserting error`)
        fixes++
      }
    }

    // Add THEN before first expect (if no comment exists and we have WHEN)
    // Exclude patterns already handled by WHEN or WHEN/THEN
    let isExpect =
      (trimmed.startsWith('expect(') || trimmed.startsWith('await expect(')) &&
      !trimmed.startsWith('await expect(executeQuery(') && // Don't match WHEN pattern
      !isExpectRejects // Don't match WHEN/THEN pattern (already handled)

    // Check if previous line is specifically a GIVEN/WHEN/THEN comment
    const hasPrevGWTComment =
      prevLine.startsWith('// GIVEN') ||
      prevLine.startsWith('// WHEN') ||
      prevLine.startsWith('// THEN')

    if (isExpect && !hasPrevGWTComment) {
      // Look back to test start to find WHEN/THEN
      let hasWhen = false
      let hasThen = false
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].includes('// WHEN')) hasWhen = true
        if (lines[j].includes('// THEN')) hasThen = true
        if (lines[j].includes('test.fixme(') || lines[j].includes('test(')) break
      }

      if (hasWhen && !hasThen) {
        result.push(`${indent}// THEN: assertion`)
        fixes++
      }
    }

    result.push(line)
  }

  return { content: result.join('\n'), fixes }
}

async function main() {
  console.log('🔧 Fixing field-type spec comments...')
  console.log('')

  const files = await findSpecFiles(FIELD_TYPES_DIR)
  let totalFixes = 0
  let filesFixed = 0

  for (const filePath of files) {
    let content = await readFile(filePath, 'utf-8')
    let fileFixes = 0

    // Run multiple passes until no more fixes
    for (let pass = 0; pass < 5; pass++) {
      const { content: fixedContent, fixes } = addCommentsToTest(content)
      if (fixes === 0) break
      content = fixedContent
      fileFixes += fixes
    }

    if (fileFixes > 0) {
      await writeFile(filePath, content)
      const fileName = filePath.split('/').pop()
      console.log(`✅ ${fileName}: ${fileFixes} fixes`)
      totalFixes += fileFixes
      filesFixed++
    }
  }

  console.log('')
  console.log('━'.repeat(60))
  console.log(`Total: ${totalFixes} fixes in ${filesFixed} files`)
  console.log('━'.repeat(60))
}

main().catch(console.error)
