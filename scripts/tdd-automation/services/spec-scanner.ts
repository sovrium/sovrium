/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Spec Scanner Service
 *
 * Handles scanning of test files for fixme patterns and extraction of spec IDs
 */

import { Array as EffectArray, pipe } from 'effect'
import * as Effect from 'effect/Effect'
import { FileSystemService, logInfo, progress } from '../../lib/effect'
import { createSchemaPriorityCalculator } from '../schema-priority-calculator'
import type { SpecItem, QueueScanResult } from './types'

/**
 * Extract spec ID from test title
 * Format: "APP-VERSION-001: description"
 * Returns: "APP-VERSION-001" or undefined
 */
export const extractSpecId = (line: string): string | undefined => {
  const match = line.match(/['"`]([A-Z]+-[A-Z-]+-\d{3}):/)
  return match?.[1]
}

/**
 * Parse a test file and extract all specs with fixme
 *
 * IMPORTANT: This function ONLY extracts tests marked with test.fixme() or it.fixme()
 * - Passing tests (test() without fixme) are EXCLUDED
 * - Skipped tests (test.skip()) are EXCLUDED
 * - Only RED tests with .fixme are included for automation
 */
export const parseTestFileForSpecs = (
  filePath: string,
  calculatePriority: (feature: string) => number
): Effect.Effect<SpecItem[], never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const content = yield* fs.readFile(filePath).pipe(Effect.catchAll(() => Effect.succeed('')))

    const lines = content.split('\n')
    const specs: SpecItem[] = []

    // Extract feature from path
    const pathParts = filePath.split('/')
    const specsIndex = pathParts.indexOf('specs')
    const feature = pathParts
      .slice(specsIndex + 1)
      .join('/')
      .replace('.spec.ts', '')

    // Find ONLY test.fixme() or it.fixme() patterns (RED tests that need implementation)
    // EXCLUDES: test() without fixme (passing tests), test.skip() (skipped tests)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if line contains test.fixme or it.fixme (ONLY RED TESTS)
      if (line?.includes('test.fixme(') || line?.includes('it.fixme(')) {
        // Look for spec ID in current line or next few lines (title might span multiple lines)
        let specId: string | undefined
        let description = ''

        // Check current line and next 3 lines for spec ID
        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          const testLine = lines[j]
          if (!testLine) continue

          specId = extractSpecId(testLine)
          if (specId) {
            // Extract description (everything after "SPEC-ID: ")
            const descMatch = testLine.match(/[A-Z]+-[A-Z-]+-\d{3}:\s*(.+?)['"`]/)
            description = descMatch?.[1]?.trim() ?? 'No description'
            break
          }
        }

        if (specId) {
          // Calculate priority based on the spec ID (not the feature path)
          const priority = calculatePriority(specId)

          specs.push({
            specId,
            file: filePath,
            line: i + 1,
            description,
            feature,
            priority,
          })
        }
      }
    }

    return specs
  })

/**
 * Scan all spec files for fixme tests and extract spec IDs
 *
 * IMPORTANT: This function scans for RED tests marked with test.fixme() ONLY
 * - GREEN tests (passing tests without .fixme) are NOT included
 * - SKIPPED tests (test.skip()) are NOT included
 * - Only creates issues for tests that need implementation
 */
export const scanForFixmeSpecs = Effect.gen(function* () {
  const fs = yield* FileSystemService

  yield* progress('Scanning for test.fixme() patterns (RED tests only)...')

  // Create priority calculator (based on spec ID format, no schema files needed)
  const calculatePriority = createSchemaPriorityCalculator()

  // Find all spec files
  const specFiles = yield* fs.glob('specs/**/*.spec.ts')
  yield* logInfo(`Found ${specFiles.length} spec files to scan`)
  yield* logInfo('Note: Only tests with .fixme() will be queued (GREEN and SKIP tests excluded)')

  // Parse each file in parallel (pass priority calculator to each)
  const allSpecs = yield* Effect.all(
    specFiles.map((file) => parseTestFileForSpecs(file, calculatePriority)),
    { concurrency: 10 }
  )

  // Flatten array of arrays
  const specs = allSpecs.flat()

  // Sort by priority, then by spec ID
  const sortedSpecs = pipe(
    specs,
    EffectArray.sortBy(
      (a, b) => (a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0),
      (a, b) => (a.specId < b.specId ? -1 : a.specId > b.specId ? 1 : 0)
    )
  )

  const result: QueueScanResult = {
    timestamp: new Date().toISOString(),
    totalSpecs: sortedSpecs.length,
    specs: sortedSpecs,
  }

  // Output results
  yield* logInfo('')
  yield* logInfo('Scan Results:', '📊')
  yield* logInfo(`  Total RED tests with .fixme(): ${result.totalSpecs}`)
  yield* logInfo(`  (Passing tests and test.skip() excluded from queue)`)
  yield* logInfo('')

  if (sortedSpecs.length > 0) {
    yield* logInfo('First 10 RED tests to be queued:', '📋')
    sortedSpecs.slice(0, 10).forEach((spec, index) => {
      console.log(`  ${index + 1}. ${spec.specId}: ${spec.description}`)
      console.log(`     ${spec.file}:${spec.line}`)
    })
  }

  return result
})
