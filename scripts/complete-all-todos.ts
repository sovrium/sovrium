/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Complete all TODOs in test files
 */

import { execSync } from 'node:child_process'
import { globSync } from 'glob'

// Find all spec files with TODOs
const files = globSync('specs/**/*.spec.ts')
let totalProcessed = 0
let totalRemoved = 0

for (const file of files) {
  try {
    const output = execSync(`bun run scripts/complete-todo-batch.ts "${file}"`, {
      encoding: 'utf-8',
    })
    const match = output.match(/Removed (\d+) TODOs/)
    if (match) {
      const removed = parseInt(match[1])
      if (removed > 0) {
        console.log(output.trim())
        totalProcessed++
        totalRemoved += removed
      }
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error)
  }
}

console.log(`\n📊 Summary:`)
console.log(`- Files processed: ${totalProcessed}`)
console.log(`- Total TODOs removed: ${totalRemoved}`)
