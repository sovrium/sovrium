#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

async function getSpecFiles(): Promise<string[]> {
  const directories = [
    'specs/api/auth/organization/teams',
    'specs/api/auth/organization/dynamic-roles',
    'specs/api/auth/organization/options',
    'specs/api/auth/api-key',
    'specs/api/auth/admin',
  ]

  const files: string[] = []

  async function walkDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkDir(fullPath)
      } else if (entry.name.endsWith('.spec.ts')) {
        files.push(fullPath)
      }
    }
  }

  for (const dir of directories) {
    await walkDir(dir)
  }

  return files.sort()
}

function fixImports(content: string): string {
  // Replace incorrect import with correct one
  return content.replace(
    /import \{ test, expect \} from '@\/specs\/fixtures'/g,
    "import { test } from '@/specs/fixtures'"
  )
}

function extractFeatureFromPath(filePath: string): string {
  // Extract feature from path like specs/api/auth/admin/ban-user/post.spec.ts
  const parts = filePath.split('/')
  const authIndex = parts.indexOf('auth')

  if (authIndex === -1) return 'UNKNOWN'

  // Get parts after 'auth'
  const featureParts = parts.slice(authIndex + 1, -1) // Exclude filename

  // Convert to uppercase and join with hyphens
  return featureParts.map((part) => part.toUpperCase().replace(/[^A-Z0-9]/g, '-')).join('-')
}

function addSpecIDs(content: string, filePath: string): string {
  const feature = extractFeatureFromPath(filePath)
  let specCounter = 1

  // Replace test.fixme( calls with spec IDs
  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue

    if (line.includes('test.fixme(')) {
      // Check if it already has a spec ID
      if (!line.includes('API-AUTH-')) {
        // Add spec ID at the beginning of the string
        const specID = `API-AUTH-${feature}-${specCounter.toString().padStart(3, '0')}`
        const fixedLine = line.replace(/test\.fixme\(\s*'([^']*)'/, `test.fixme('${specID}: $1`)
        result.push(fixedLine)
        specCounter++
      } else {
        result.push(line)
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function addGivenWhenThen(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined) {
      i++
      continue
    }

    // Check if this is a @spec test
    if (line.includes("tag: '@spec'")) {
      result.push(line)
      i++

      // Find the async function
      while (i < lines.length) {
        const currentLine = lines[i]
        if (currentLine === undefined) break
        if (currentLine.includes('async')) break
        result.push(currentLine)
        i++
      }

      if (i < lines.length) {
        const asyncLine = lines[i]
        if (asyncLine !== undefined) {
          result.push(asyncLine) // async line
          i++

          // Check if GIVEN comment already exists
          const nextFewLines = lines.slice(i, i + 5).join('\n')
          if (!nextFewLines.includes('// GIVEN:')) {
            // Add GIVEN-WHEN-THEN structure
            const nextLine = lines[i]
            const indent = nextLine?.match(/^\s*/)?.[0] ?? '    '
            result.push(`${indent}// GIVEN: TODO: Describe preconditions`)
            result.push(`${indent}// WHEN: TODO: Describe action`)
            result.push(`${indent}// THEN: TODO: Describe expected outcome`)
          }
        }
      }
    } else {
      result.push(line)
      i++
    }
  }

  return result.join('\n')
}

async function fixFile(filePath: string): Promise<void> {
  let content = await readFile(filePath, 'utf-8')

  // Apply fixes
  content = fixImports(content)
  content = addSpecIDs(content, filePath)
  content = addGivenWhenThen(content)

  await writeFile(filePath, content, 'utf-8')
}

async function main() {
  console.log('🔧 Fixing Better Auth spec files...\n')

  const files = await getSpecFiles()
  console.log(`Found ${files.length} spec files to fix\n`)

  let fixed = 0
  for (const file of files) {
    await fixFile(file)
    fixed++
    if (fixed % 10 === 0) {
      console.log(`  Fixed ${fixed}/${files.length} files...`)
    }
  }

  console.log(`\n✅ Fixed ${fixed} files\n`)
}

main()
