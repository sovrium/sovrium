#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const specsDir = join(process.cwd(), 'specs/api')

async function getAllSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await getAllSpecFiles(fullPath)))
    } else if (entry.name.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

async function fixFile(filePath: string): Promise<number> {
  let content = await readFile(filePath, 'utf-8')
  let fixCount = 0

  // Fix 1: Remove .ts extension from fixtures import
  if (content.includes("from '@/specs/fixtures.ts'")) {
    content = content.replace(/@\/specs\/fixtures\.ts/g, '@/specs/fixtures')
    fixCount++
  }

  // Fix 2: Remove unnecessary escape characters before $
  const escapeMatches = content.match(/\\\$/g)
  if (escapeMatches) {
    content = content.replace(/\\\$/g, '$')
    fixCount += escapeMatches.length
  }

  // Fix 3: Add eslint-disable comment for drizzle rule at top of file (after imports)
  // Only if file contains request.delete() calls (HTTP, not Drizzle)
  if (
    content.includes('request.delete(') &&
    !content.includes('/* eslint-disable drizzle/enforce-delete-with-where */')
  ) {
    // Find the position after imports
    const importEndMatch = content.match(/^import .+\n\n/m)
    if (importEndMatch) {
      const insertPos = content.indexOf(importEndMatch[0]) + importEndMatch[0].length
      content =
        content.slice(0, insertPos) +
        '/* eslint-disable drizzle/enforce-delete-with-where */\n' +
        content.slice(insertPos)
      fixCount++
    }
  }

  // Fix 4: Prefix unused executeQuery parameters with underscore
  // Only for functions that DON'T use executeQuery in the body
  const functionMatches = content.matchAll(
    /async \(\{ ([^}]+) \}\) => \{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs
  )

  for (const match of functionMatches) {
    const params = match[1]
    const body = match[2]

    // Check if executeQuery is a parameter but not used in body
    if (params.includes('executeQuery') && !body.includes('executeQuery(')) {
      // Replace executeQuery with _executeQuery in this function only
      const oldFunction = match[0]
      const newFunction = oldFunction.replace(/executeQuery(?!\w)/g, '_executeQuery')
      content = content.replace(oldFunction, newFunction)
      fixCount++
    }
  }

  await writeFile(filePath, content, 'utf-8')
  return fixCount
}

async function main() {
  console.log('🔍 Finding spec files in specs/api/...')
  const specFiles = await getAllSpecFiles(specsDir)
  console.log(`✅ Found ${specFiles.length} spec files\n`)

  let totalFixes = 0

  for (const file of specFiles) {
    const fixCount = await fixFile(file)
    if (fixCount > 0) {
      const relativePath = file.replace(process.cwd() + '/', '')
      console.log(`✓ ${relativePath} (${fixCount} fixes)`)
      totalFixes += fixCount
    }
  }

  console.log(`\n✅ Total fixes applied: ${totalFixes}`)
}

main()
