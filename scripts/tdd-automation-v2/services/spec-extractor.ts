/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { $ } from 'bun'
import { Effect, Console } from 'effect'
import type { SpecQueueItem } from '../types'

/**
 * Spec ID Extractor
 *
 * Scans all spec files in specs/ directory and extracts individual test.fixme() calls
 * with their spec IDs, test names, and file paths for spec-ID-based processing.
 */

/**
 * Parse a spec file to extract test.fixme() information
 *
 * Extracts:
 * - Spec ID (e.g., "API-TABLES-001" from test description)
 * - Test name (full description for grep matching)
 * - File path
 */
const parseSpecFile = (
  filePath: string,
  content: string,
  priority: number
): Effect.Effect<SpecQueueItem[], Error> =>
  Effect.gen(function* () {
    const specs: SpecQueueItem[] = []

    // Regex to match test.fixme() calls with spec IDs
    // Matches: test.fixme('API-TABLES-001: description', ...)
    // Captures: spec ID and full test description
    const testFixmeRegex = /test\.fixme\(['"](([A-Z]+-[A-Z]+-[A-Z0-9-]+):[^'"]*)['"]/g

    let match: RegExpExecArray | null
    while ((match = testFixmeRegex.exec(content)) !== null) {
      const testName = match[1] // Full test description (with spec ID)
      const specId = match[2] // Extracted spec ID

      if (!specId || !testName) {
        yield* Console.warn(`Skipping test without valid spec ID in ${filePath}: ${match[0]}`)
        continue
      }

      const spec: SpecQueueItem = {
        id: specId,
        specId,
        filePath,
        testName,
        priority,
        status: 'pending',
        attempts: 0,
        errors: [],
        queuedAt: new Date().toISOString(),
      }

      specs.push(spec)
    }

    return specs
  })

/**
 * Find all spec files in specs/ directory
 */
const findAllSpecFiles = (): Effect.Effect<string[], Error> =>
  Effect.tryPromise({
    try: async () => {
      const result = await $`find specs -name "*.spec.ts" -type f`.nothrow().quiet()

      if (result.exitCode !== 0) {
        throw new Error(`Failed to find spec files: ${result.stderr}`)
      }

      const files = result.stdout
        .toString()
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)

      return files
    },
    catch: (error) => new Error(`Failed to find spec files: ${String(error)}`),
  })

/**
 * Calculate priority for a spec based on its characteristics
 *
 * Priority factors:
 * - File path (API specs > UI specs)
 * - Spec ID prefix (TABLES > FIELDS > etc.)
 * - Position in file (earlier specs = higher priority)
 */
const calculatePriority = (filePath: string, specId: string, position: number): number => {
  let priority = 50 // Base priority

  // File path priority
  if (filePath.includes('api/tables')) priority += 30
  else if (filePath.includes('api/fields')) priority += 20
  else if (filePath.includes('api/records')) priority += 10

  // Spec ID prefix priority
  if (specId.includes('TABLES')) priority += 15
  else if (specId.includes('FIELDS')) priority += 10
  else if (specId.includes('RECORDS')) priority += 5

  // Position priority (earlier in file = higher priority)
  priority -= position * 0.5

  return Math.max(0, Math.min(100, priority))
}

/**
 * Extract all spec IDs from all spec files
 *
 * Returns an array of SpecQueueItem objects ready to be queued.
 * Specs are grouped by file and sorted by priority.
 */
export const extractAllSpecs = (): Effect.Effect<SpecQueueItem[], Error> =>
  Effect.gen(function* () {
    yield* Console.log('🔍 Scanning spec files for test.fixme() tests...')

    // Find all spec files
    const files = yield* findAllSpecFiles()
    yield* Console.log(`Found ${files.length} spec files`)

    // Extract specs from each file
    const allSpecs: SpecQueueItem[] = []

    for (const filePath of files) {
      yield* Console.log(`Parsing ${filePath}...`)

      // Read file content
      const content = yield* Effect.tryPromise({
        try: () => Bun.file(filePath).text(),
        catch: (error) => new Error(`Failed to read ${filePath}: ${String(error)}`),
      })

      // Base priority from file characteristics
      const basePriority = calculatePriority(filePath, '', 0)

      // Parse specs
      const specs = yield* parseSpecFile(filePath, content, basePriority)

      // Adjust priority based on position in file
      specs.forEach((spec, index) => {
        spec.priority = calculatePriority(filePath, spec.specId, index)
      })

      allSpecs.push(...specs)
      yield* Console.log(`  Found ${specs.length} test.fixme() tests`)
    }

    // Sort by file path (primary) and priority (secondary)
    // This ensures all specs in fileA are before fileB
    allSpecs.sort((a, b) => {
      if (a.filePath !== b.filePath) {
        return a.filePath.localeCompare(b.filePath)
      }
      return b.priority - a.priority // Higher priority first within same file
    })

    yield* Console.log(`\n✅ Extracted ${allSpecs.length} total specs`)
    yield* Console.log(`📁 Files with specs: ${new Set(allSpecs.map((s) => s.filePath)).size}`)

    return allSpecs
  })

/**
 * Extract specs from a specific file
 *
 * Useful for re-queuing a single file after manual fixes.
 */
export const extractSpecsFromFile = (filePath: string): Effect.Effect<SpecQueueItem[], Error> =>
  Effect.gen(function* () {
    yield* Console.log(`🔍 Extracting specs from ${filePath}...`)

    // Read file content
    const content = yield* Effect.tryPromise({
      try: () => Bun.file(filePath).text(),
      catch: (error) => new Error(`Failed to read ${filePath}: ${String(error)}`),
    })

    // Base priority from file characteristics
    const basePriority = calculatePriority(filePath, '', 0)

    // Parse specs
    const specs = yield* parseSpecFile(filePath, content, basePriority)

    // Adjust priority based on position
    specs.forEach((spec, index) => {
      spec.priority = calculatePriority(filePath, spec.specId, index)
    })

    yield* Console.log(`✅ Found ${specs.length} specs in ${filePath}`)

    return specs
  })
