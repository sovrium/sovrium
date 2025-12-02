/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileSystemService } from './FileSystemService'

/**
 * Mapping rule for source-to-spec relationships
 */
interface SourceToSpecRule {
  readonly sourcePattern: RegExp
  readonly specPatterns: (match: RegExpMatchArray) => readonly string[]
  readonly globPatterns?: readonly string[]
}

/**
 * Spec Mapping Service Interface
 */
export interface SpecMappingService {
  /**
   * Get E2E spec files that should run based on a source file change
   * @param sourcePath - Path to the changed source file
   * @returns List of related spec file paths
   */
  readonly getSpecsForSource: (sourcePath: string) => Effect.Effect<readonly string[], never>

  /**
   * Get all E2E specs that should run based on a list of changed files
   * Handles both direct spec file changes and source file mappings
   * @param changedFiles - List of changed file paths
   * @returns List of spec file paths to run
   */
  readonly getSpecsToRun: (
    changedFiles: readonly string[]
  ) => Effect.Effect<readonly string[], never>

  /**
   * Check if any changed files require E2E tests
   * @param changedFiles - List of changed file paths
   * @returns Boolean indicating if E2E tests should run
   */
  readonly shouldRunE2E: (changedFiles: readonly string[]) => Effect.Effect<boolean, never>
}

/**
 * Spec Mapping Service Tag (for dependency injection)
 */
export const SpecMappingService = Context.GenericTag<SpecMappingService>('SpecMappingService')

/**
 * Source-to-spec mapping rules
 * Maps source file patterns to corresponding E2E spec patterns
 */
const SOURCE_TO_SPEC_RULES: readonly SourceToSpecRule[] = [
  // Domain models -> App specs (handle tables/table path difference)
  {
    sourcePattern: /^src\/domain\/models\/app\/(.+)\.ts$/,
    specPatterns: (match) => {
      const path = match[1] ?? ''
      // Handle table -> tables path difference
      const specPath = path.replace(/^table\//, 'tables/').replace(/\/index$/, '')
      return [`specs/app/${specPath}.spec.ts`]
    },
  },

  // Domain table field types -> tables field-types specs
  {
    sourcePattern: /^src\/domain\/models\/app\/table\/field-types\/(.+)\.ts$/,
    specPatterns: (match) => {
      const fileName = (match[1] ?? '').replace(/\/index$/, '')
      return [`specs/app/tables/field-types/${fileName}.spec.ts`]
    },
  },

  // Auth infrastructure -> All auth API specs (glob)
  {
    sourcePattern: /^src\/infrastructure\/auth\//,
    specPatterns: () => [],
    globPatterns: ['specs/api/auth/**/*.spec.ts'],
  },

  // Auth routes -> Auth API specs
  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/auth-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/auth/**/*.spec.ts'],
  },

  // Table routes -> Tables API specs
  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/table-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/tables/**/*.spec.ts'],
  },

  // Health routes -> Health API specs
  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/health-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/health/**/*.spec.ts'],
  },

  // OpenAPI routes -> API specs in general
  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/openapi-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/**/*.spec.ts'],
  },

  // CSS infrastructure -> Theme and static specs
  {
    sourcePattern: /^src\/infrastructure\/css\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/theme/**/*.spec.ts', 'specs/static/**/*.spec.ts'],
  },

  // Database infrastructure -> Migration and tables specs
  {
    sourcePattern: /^src\/infrastructure\/database\//,
    specPatterns: () => [],
    globPatterns: ['specs/migrations/**/*.spec.ts', 'specs/api/tables/**/*.spec.ts'],
  },

  // Static site generation -> Static specs
  {
    sourcePattern: /^src\/infrastructure\/static\//,
    specPatterns: () => [],
    globPatterns: ['specs/static/**/*.spec.ts'],
  },

  // Application use cases -> Related specs
  {
    sourcePattern: /^src\/application\/use-cases\/server\//,
    specPatterns: () => [],
    globPatterns: ['specs/static/**/*.spec.ts', 'specs/api/**/*.spec.ts'],
  },

  // Presentation templates -> Template specs
  {
    sourcePattern: /^src\/presentation\/templates\//,
    specPatterns: () => [],
    globPatterns: ['specs/templates/**/*.spec.ts'],
  },

  // Presentation components (blocks) -> App blocks specs
  {
    sourcePattern: /^src\/presentation\/components\/blocks\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/blocks/**/*.spec.ts'],
  },

  // Presentation pages -> App pages specs
  {
    sourcePattern: /^src\/presentation\/components\/pages\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/pages/**/*.spec.ts'],
  },
]

/**
 * File patterns to ignore for E2E consideration
 */
const IGNORE_PATTERNS = [
  /\.test\.ts$/, // Unit test files
  /\.test\.tsx$/, // Unit test files (React)
  /\.d\.ts$/, // Type declaration files
  /\.md$/, // Documentation files
  /\.json$/, // JSON config files (unless in src/)
  /\.yml$/, // YAML config files
  /\.yaml$/, // YAML config files
  /^\./, // Hidden files
  /^scripts\//, // Script files (except if they affect runtime)
  /^docs\//, // Documentation directory
  /^\.github\//, // GitHub config
  /^node_modules\//, // Dependencies
]

/**
 * Check if a file should be ignored for E2E consideration
 */
const shouldIgnoreFile = (filePath: string): boolean => {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(filePath))
}

/**
 * Live Spec Mapping Service Implementation
 */
export const SpecMappingServiceLive = Layer.effect(
  SpecMappingService,
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const getSpecsForSource = (sourcePath: string): Effect.Effect<readonly string[], never> =>
      Effect.gen(function* () {
        const specs: string[] = []

        for (const rule of SOURCE_TO_SPEC_RULES) {
          const match = sourcePath.match(rule.sourcePattern)
          if (!match) continue

          // Add direct spec patterns
          const directSpecs = rule.specPatterns(match)
          for (const specPath of directSpecs) {
            const exists = yield* fs
              .exists(specPath)
              .pipe(Effect.catchAll(() => Effect.succeed(false)))
            if (exists) {
              specs.push(specPath)
            }
          }

          // Add glob patterns
          if (rule.globPatterns) {
            for (const pattern of rule.globPatterns) {
              const globSpecs = yield* fs
                .glob(pattern)
                .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
              specs.push(...globSpecs)
            }
          }
        }

        // Deduplicate
        return [...new Set(specs)]
      })

    const getSpecsToRun = (
      changedFiles: readonly string[]
    ): Effect.Effect<readonly string[], never> =>
      Effect.gen(function* () {
        const specs: string[] = []

        for (const file of changedFiles) {
          // Skip ignored files
          if (shouldIgnoreFile(file)) {
            continue
          }

          // Direct spec file changes
          if (file.endsWith('.spec.ts') && file.startsWith('specs/')) {
            specs.push(file)
            continue
          }

          // Source file changes -> find related specs
          if (file.startsWith('src/') && file.endsWith('.ts')) {
            const relatedSpecs = yield* getSpecsForSource(file)
            specs.push(...relatedSpecs)
          }
        }

        // Deduplicate and sort
        return [...new Set(specs)].sort()
      })

    const shouldRunE2E = (changedFiles: readonly string[]): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const specs = yield* getSpecsToRun(changedFiles)
        return specs.length > 0
      })

    return SpecMappingService.of({
      getSpecsForSource,
      getSpecsToRun,
      shouldRunE2E,
    })
  })
)

/**
 * Helper functions for common operations
 */

/**
 * Get E2E specs for a source file
 */
export const getSpecsForSource = (sourcePath: string) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.getSpecsForSource(sourcePath)))

/**
 * Get all specs to run based on changed files
 */
export const getSpecsToRun = (changedFiles: readonly string[]) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.getSpecsToRun(changedFiles)))

/**
 * Check if E2E tests should run
 */
export const shouldRunE2E = (changedFiles: readonly string[]) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.shouldRunE2E(changedFiles)))
