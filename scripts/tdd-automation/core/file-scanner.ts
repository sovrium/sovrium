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
import { extractSpecId } from './spec-scanner'
import type { SpecItem } from './types'

export const flattenPathToSlug = (path: string): string =>
  path
    .replace(/^specs\//, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/\//g, '-')
    .toLowerCase()

export interface SpecFile {
  readonly path: string
  readonly slug: string
  readonly fixmeSpecs: readonly SpecItem[]
  readonly activeSpecs: readonly SpecItem[]
  readonly hasRegression: boolean
  readonly priority: number
}

export interface SpecFileScanResult {
  readonly timestamp: string
  readonly totalFiles: number
  readonly totalFixmeSpecs: number
  readonly files: readonly SpecFile[]
}

export const parseSpecFile = (
  filePath: string,
  calculatePriority: (specId: string, context: { file: string; line: number }) => number
): Effect.Effect<SpecFile | null, never, FileSystemService> =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService
    const content = yield* fs.readFile(filePath).pipe(Effect.catchAll(() => Effect.succeed('')))

    if (content.length === 0) return null

    const lines = content.split('\n')

    const pathParts = filePath.split('/')
    const specsIndex = pathParts.indexOf('specs')
    const feature =
      specsIndex >= 0
        ? pathParts
            .slice(specsIndex + 1)
            .join('/')
            .replace('.spec.ts', '')
        : filePath.replace('.spec.ts', '')

    const fixmeSpecs: SpecItem[] = []
    const activeSpecs: SpecItem[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue

      const isFixme = line.includes('test.fixme(') || line.includes('it.fixme(')
      const isActive =
        !isFixme &&
        !line.includes('test.skip(') &&
        !line.includes('it.skip(') &&
        (/\btest\(/.test(line) || /\bit\(/.test(line))

      if (!isFixme && !isActive) continue

      let specId: string | undefined
      let description = ''
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j]
        if (!candidate) continue
        specId = extractSpecId(candidate)
        if (specId) {
          const descMatch = candidate.match(/[A-Z]+-[A-Z-]+-(?:\d{3}|REGRESSION):\s*(.+?)['"`]/)
          description = descMatch?.[1]?.trim() ?? 'No description'
          break
        }
      }

      if (!specId) continue

      const item: SpecItem = {
        specId,
        file: filePath,
        line: i + 1,
        description,
        feature,
        priority: calculatePriority(specId, { file: filePath, line: i + 1 }),
      }

      if (isFixme) {
        fixmeSpecs.push(item)
      } else {
        activeSpecs.push(item)
      }
    }

    if (fixmeSpecs.length === 0) return null

    return {
      path: filePath,
      slug: flattenPathToSlug(filePath),
      fixmeSpecs,
      activeSpecs,
      hasRegression: /@regression/.test(content),
      priority: Math.min(...fixmeSpecs.map((s) => s.priority)),
    } satisfies SpecFile
  })

export const scanForSpecFiles = Effect.gen(function* () {
  const fs = yield* FileSystemService

  yield* progress('V4 file-scanner: scanning for spec files with .fixme() patterns...')

  const calculatePriority = createSchemaPriorityCalculator()

  const allSpecFiles = yield* fs.glob('specs/**/*.spec.ts')
  yield* logInfo(`Found ${allSpecFiles.length} candidate spec files to inspect`)

  const parsed = yield* Effect.all(
    allSpecFiles.map((file) => parseSpecFile(file, calculatePriority)),
    { concurrency: 10 }
  )

  const files = parsed.filter((f): f is SpecFile => f !== null)

  const sorted = pipe(
    files,
    EffectArray.sortBy(
      (a, b) => (a.priority < b.priority ? -1 : a.priority > b.priority ? 1 : 0),
      (a, b) =>
        a.fixmeSpecs.length > b.fixmeSpecs.length
          ? -1
          : a.fixmeSpecs.length < b.fixmeSpecs.length
            ? 1
            : 0
    )
  )

  const totalFixmeSpecs = sorted.reduce((sum, f) => sum + f.fixmeSpecs.length, 0)

  yield* logInfo('')
  yield* logInfo('V4 Scan Results:', '📊')
  yield* logInfo(`  Eligible spec files (≥1 .fixme()): ${sorted.length}`)
  yield* logInfo(`  Total .fixme() specs across all files: ${totalFixmeSpecs}`)
  yield* logInfo('')

  if (sorted.length > 0) {
    yield* logInfo('First 5 files by priority:', '📋')
    sorted.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.path}`)
      console.log(
        `     ${f.fixmeSpecs.length} fixme spec(s), priority=${f.priority}, hasRegression=${f.hasRegression}`
      )
    })
  }

  return {
    timestamp: new Date().toISOString(),
    totalFiles: sorted.length,
    totalFixmeSpecs,
    files: sorted,
  } satisfies SpecFileScanResult
})
