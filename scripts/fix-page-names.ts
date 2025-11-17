#!/usr/bin/env bun

/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Fix page configurations by adding missing 'name' fields
 *
 * This script scans all .spec.ts files and adds a 'name' field to page configurations
 * that are missing it. The name is derived from the path.
 */

function pathToName(path: string): string {
  if (path === '/') return 'home'
  // Remove leading slash and convert to lowercase snake_case
  return path.slice(1).replace(/\//g, '_').toLowerCase()
}

function getAllSpecFiles(dir: string): string[] {
  const files: string[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllSpecFiles(fullPath))
    } else if (entry.endsWith('.spec.ts')) {
      files.push(fullPath)
    }
  }

  return files
}

function fixPageNames(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8')
  let modified = false

  // Pattern to match page objects without 'name' field
  // Matches: {<newline>path: '<path>',
  // Captures the path and the whitespace before 'path:'
  const regex = /(\s+)path:\s*'([^']+)',\s*\n(?!\s+name:)/g

  const newContent = content.replace(regex, (match, indent, path) => {
    const name = pathToName(path)
    modified = true
    return `${indent}name: '${name}',\n${indent}path: '${path}',\n`
  })

  if (modified) {
    writeFileSync(filePath, newContent)
    return true
  }

  return false
}

// Main execution
const specsDir = join(import.meta.dir, '..', 'specs')
const specFiles = getAllSpecFiles(specsDir)

let fixedCount = 0
for (const file of specFiles) {
  if (fixPageNames(file)) {
    console.log(`Fixed: ${file}`)
    fixedCount++
  }
}

console.log(`\nTotal files fixed: ${fixedCount}`)
