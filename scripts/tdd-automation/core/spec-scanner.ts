/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Array as EffectArray, pipe } from 'effect'
import * as Effect from 'effect/Effect'
import { FileSystemService, logInfo, progress } from '../../lib/effect'
import { createSchemaPriorityCalculator } from './schema-priority-calculator'
import type { SpecItem, QueueScanResult } from './types'

export const extractSpecId = (line: string): string | undefined => {
  const match = line.match(/['"`]([A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION)):/)
  return match?.[1]
}

export const parseTestFileForSpecs = (
  filePath: string,
  calculatePriority: (specId: string, context: { file: string; line: number }) => number
): Effect.Effect<SpecItem[], never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const content = yield* fs.readFile(filePath).pipe(Effect.catchAll(() => Effect.succeed('')))

    const lines = content.split('\n')
    const specs: SpecItem[] = []

    const pathParts = filePath.split('/')
    const specsIndex = pathParts.indexOf('specs')
    const feature = pathParts
      .slice(specsIndex + 1)
      .join('/')
      .replace('.spec.ts', '')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line?.includes('test.fixme(') || line?.includes('it.fixme(')) {
        let specId: string | undefined
        let description = ''

        for (let j = i; j < Math.min(i + 4, lines.length); j++) {
          const testLine = lines[j]
          if (!testLine) continue

          specId = extractSpecId(testLine)
          if (specId) {
            const descMatch = testLine.match(/[A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION):\s*(.+?)['"`]/)
            description = descMatch?.[1]?.trim() ?? 'No description'
            break
          }
        }

        if (specId) {
          const priority = calculatePriority(specId, { file: filePath, line: i + 1 })

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

export const scanForFixmeSpecs = Effect.gen(function* () {
  const fs = yield* FileSystemService

  yield* progress('Scanning for test.fixme() patterns (RED tests only)...')

  const calculatePriority = createSchemaPriorityCalculator()

  const specFiles = yield* fs.glob('specs/**/*.spec.ts')
  yield* logInfo(`Found ${specFiles.length} spec files to scan`)
  yield* logInfo('Note: Only tests with .fixme() will be queued (GREEN and SKIP tests excluded)')

  const allSpecs = yield* Effect.all(
    specFiles.map((file) => parseTestFileForSpecs(file, calculatePriority)),
    { concurrency: 10 }
  )

  const specs = allSpecs.flat()

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
