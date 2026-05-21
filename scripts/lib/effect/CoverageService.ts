/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileSystemService } from './FileSystemService'

export class CoverageCheckError extends Data.TaggedError('CoverageCheckError')<{
  readonly missingTests: readonly string[]
  readonly layer: string
}> {}

export interface CoverageResult {
  readonly layer: string
  readonly sourceFiles: number
  readonly testedFiles: number
  readonly coverage: number
  readonly missingTests: readonly string[]
}

export interface LayerConfig {
  readonly name: string
  readonly path: string
  readonly enabled: boolean
}

export interface CoverageService {
  readonly checkLayer: (layer: LayerConfig) => Effect.Effect<CoverageResult, never>

  readonly checkAll: (
    layers: readonly LayerConfig[]
  ) => Effect.Effect<readonly CoverageResult[], never>

  readonly enforce: (layers: readonly LayerConfig[]) => Effect.Effect<void, CoverageCheckError>
}

export const CoverageService = Context.GenericTag<CoverageService>('CoverageService')

const EXCLUDE_PATTERNS = [
  /\.test\.ts$/,
  /\.test\.tsx$/,
  /\.d\.ts$/,
  /index\.ts$/,
  /\.spec\.ts$/,
  /types\.ts$/,
  /constants\.ts$/,
]

export const DEFAULT_LAYERS: readonly LayerConfig[] = [
  { name: 'domain', path: 'src/domain', enabled: true },
  { name: 'application', path: 'src/application', enabled: false },
  { name: 'infrastructure', path: 'src/infrastructure', enabled: false },
  { name: 'presentation', path: 'src/presentation', enabled: false },
]

const shouldExclude = (filePath: string): boolean => {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath))
}

const getTestFilePath = (sourceFile: string): string => {
  if (sourceFile.endsWith('.tsx')) {
    return sourceFile.replace(/\.tsx$/, '.test.tsx')
  }
  return sourceFile.replace(/\.ts$/, '.test.ts')
}

export const CoverageServiceLive = Layer.effect(
  CoverageService,
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const checkLayer = (layer: LayerConfig): Effect.Effect<CoverageResult, never> =>
      Effect.gen(function* () {
        if (!layer.enabled) {
          return {
            layer: layer.name,
            sourceFiles: 0,
            testedFiles: 0,
            coverage: 100,
            missingTests: [],
          }
        }

        const allFiles = yield* fs
          .glob(`${layer.path}/**/*.ts`)
          .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))

        const tsxFiles = yield* fs
          .glob(`${layer.path}/**/*.tsx`)
          .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))

        const sourceFiles = [...allFiles, ...tsxFiles].filter((f) => !shouldExclude(f))

        const missingTests: string[] = []
        let testedCount = 0

        for (const sourceFile of sourceFiles) {
          const testFile = getTestFilePath(sourceFile)
          const hasTest = yield* fs.exists(testFile)

          if (hasTest) {
            testedCount++
          } else {
            missingTests.push(sourceFile)
          }
        }

        const coverage = sourceFiles.length > 0 ? (testedCount / sourceFiles.length) * 100 : 100

        return {
          layer: layer.name,
          sourceFiles: sourceFiles.length,
          testedFiles: testedCount,
          coverage: Math.round(coverage * 10) / 10,
          missingTests,
        }
      })

    const checkAll = (
      layers: readonly LayerConfig[]
    ): Effect.Effect<readonly CoverageResult[], never> =>
      Effect.all(layers.map(checkLayer), { concurrency: 'unbounded' })

    const enforce = (layers: readonly LayerConfig[]): Effect.Effect<void, CoverageCheckError> =>
      Effect.gen(function* () {
        const results = yield* checkAll(layers)

        for (const result of results) {
          const layerConfig = layers.find((l) => l.name === result.layer)
          if (layerConfig?.enabled && result.missingTests.length > 0) {
            return yield* new CoverageCheckError({
              missingTests: result.missingTests,
              layer: result.layer,
            })
          }
        }
      })

    return CoverageService.of({
      checkLayer,
      checkAll,
      enforce,
    })
  })
)


export const checkLayer = (layer: LayerConfig) =>
  CoverageService.pipe(Effect.flatMap((s) => s.checkLayer(layer)))

export const checkAll = (layers: readonly LayerConfig[]) =>
  CoverageService.pipe(Effect.flatMap((s) => s.checkAll(layers)))

export const enforce = (layers: readonly LayerConfig[]) =>
  CoverageService.pipe(Effect.flatMap((s) => s.enforce(layers)))

export const getDefaultLayers = () => DEFAULT_LAYERS
