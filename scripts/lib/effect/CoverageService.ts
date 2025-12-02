/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileSystemService } from './FileSystemService'

/**
 * Coverage Check Error
 */
export class CoverageCheckError extends Data.TaggedError('CoverageCheckError')<{
  readonly missingTests: readonly string[]
  readonly layer: string
}> {}

/**
 * Coverage check result
 */
export interface CoverageResult {
  readonly layer: string
  readonly sourceFiles: number
  readonly testedFiles: number
  readonly coverage: number
  readonly missingTests: readonly string[]
}

/**
 * Layer configuration for coverage checking
 */
export interface LayerConfig {
  readonly name: string
  readonly path: string
  readonly enabled: boolean
}

/**
 * Coverage Service Interface
 */
export interface CoverageService {
  /**
   * Check coverage for a specific layer
   * @param layer - Layer configuration to check
   * @returns Coverage result for the layer
   */
  readonly checkLayer: (layer: LayerConfig) => Effect.Effect<CoverageResult, never>

  /**
   * Check coverage for all enabled layers
   * @param layers - List of layer configurations
   * @returns Array of coverage results
   */
  readonly checkAll: (
    layers: readonly LayerConfig[]
  ) => Effect.Effect<readonly CoverageResult[], never>

  /**
   * Enforce coverage - fail if any enabled layer has missing tests
   * @param layers - List of layer configurations
   * @returns void if all pass, or fails with CoverageCheckError
   */
  readonly enforce: (layers: readonly LayerConfig[]) => Effect.Effect<void, CoverageCheckError>
}

/**
 * Coverage Service Tag (for dependency injection)
 */
export const CoverageService = Context.GenericTag<CoverageService>('CoverageService')

/**
 * File patterns to exclude from coverage checking
 */
const EXCLUDE_PATTERNS = [
  /\.test\.ts$/, // Test files themselves
  /\.test\.tsx$/, // Test files (React)
  /\.d\.ts$/, // Type declaration files
  /index\.ts$/, // Index/barrel files (re-exports only)
  /\.spec\.ts$/, // E2E spec files
  /types\.ts$/, // Pure type files
  /constants\.ts$/, // Constants (no logic to test)
]

/**
 * Default layer configurations
 */
export const DEFAULT_LAYERS: readonly LayerConfig[] = [
  { name: 'domain', path: 'src/domain', enabled: true },
  { name: 'application', path: 'src/application', enabled: true },
  { name: 'infrastructure', path: 'src/infrastructure', enabled: false },
  { name: 'presentation', path: 'src/presentation', enabled: false },
]

/**
 * Check if a file should be excluded from coverage
 */
const shouldExclude = (filePath: string): boolean => {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath))
}

/**
 * Get the expected test file path for a source file
 */
const getTestFilePath = (sourceFile: string): string => {
  // Replace .ts with .test.ts (or .tsx with .test.tsx)
  if (sourceFile.endsWith('.tsx')) {
    return sourceFile.replace(/\.tsx$/, '.test.tsx')
  }
  return sourceFile.replace(/\.ts$/, '.test.ts')
}

/**
 * Live Coverage Service Implementation
 */
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

        // Find all source files in the layer
        const allFiles = yield* fs
          .glob(`${layer.path}/**/*.ts`)
          .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))

        // Also check for .tsx files
        const tsxFiles = yield* fs
          .glob(`${layer.path}/**/*.tsx`)
          .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))

        const sourceFiles = [...allFiles, ...tsxFiles].filter((f) => !shouldExclude(f))

        // Check which source files have corresponding test files
        const missingTests: string[] = []
        let testedCount = 0

        for (const sourceFile of sourceFiles) {
          const testFile = getTestFilePath(sourceFile)
          const hasTest = yield* fs
            .exists(testFile)
            .pipe(Effect.catchAll(() => Effect.succeed(false)))

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
          coverage: Math.round(coverage * 10) / 10, // Round to 1 decimal
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

        // Find first enabled layer with missing tests
        for (const result of results) {
          const layerConfig = layers.find((l) => l.name === result.layer)
          if (layerConfig?.enabled && result.missingTests.length > 0) {
            return yield* Effect.fail(
              new CoverageCheckError({
                missingTests: result.missingTests,
                layer: result.layer,
              })
            )
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

/**
 * Helper functions for common operations
 */

/**
 * Check coverage for a single layer
 */
export const checkLayer = (layer: LayerConfig) =>
  CoverageService.pipe(Effect.flatMap((s) => s.checkLayer(layer)))

/**
 * Check coverage for all layers
 */
export const checkAll = (layers: readonly LayerConfig[]) =>
  CoverageService.pipe(Effect.flatMap((s) => s.checkAll(layers)))

/**
 * Enforce coverage (fail if missing tests in enabled layers)
 */
export const enforce = (layers: readonly LayerConfig[]) =>
  CoverageService.pipe(Effect.flatMap((s) => s.enforce(layers)))

/**
 * Get default layer configurations
 */
export const getDefaultLayers = () => DEFAULT_LAYERS
