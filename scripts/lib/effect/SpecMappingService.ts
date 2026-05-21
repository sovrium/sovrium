/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileSystemService } from './FileSystemService'

interface SourceToSpecRule {
  readonly sourcePattern: RegExp
  readonly specPatterns: (match: RegExpMatchArray) => readonly string[]
  readonly globPatterns?: readonly string[]
}

export interface SpecMappingService {
  readonly getSpecsForSource: (sourcePath: string) => Effect.Effect<readonly string[], never>

  readonly getSpecsToRun: (
    changedFiles: readonly string[]
  ) => Effect.Effect<readonly string[], never>

  readonly shouldRunE2E: (changedFiles: readonly string[]) => Effect.Effect<boolean, never>
}

export const SpecMappingService = Context.GenericTag<SpecMappingService>('SpecMappingService')

const SOURCE_TO_SPEC_RULES: readonly SourceToSpecRule[] = [
  {
    sourcePattern: /^src\/domain\/models\/app\/(.+)\.ts$/,
    specPatterns: (match) => {
      const path = match[1] ?? ''
      const specPath = path.replace(/^table\//, 'tables/').replace(/\/index$/, '')
      return [`specs/app/${specPath}.spec.ts`]
    },
  },

  {
    sourcePattern: /^src\/domain\/models\/app\/table\/field-types\/(.+)\.ts$/,
    specPatterns: (match) => {
      const fileName = (match[1] ?? '').replace(/\/index$/, '')
      return [`specs/app/tables/field-types/${fileName}.spec.ts`]
    },
  },

  {
    sourcePattern: /^src\/infrastructure\/auth\//,
    specPatterns: () => [],
    globPatterns: ['specs/api/auth/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/auth-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/auth/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/table-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/tables/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/health-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/health/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/server\/route-setup\/openapi-routes\.ts$/,
    specPatterns: () => [],
    globPatterns: ['specs/api/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/css\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/theme/**/*.spec.ts', 'specs/static/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/database\//,
    specPatterns: () => [],
    globPatterns: ['specs/migrations/**/*.spec.ts', 'specs/api/tables/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/infrastructure\/static\//,
    specPatterns: () => [],
    globPatterns: ['specs/static/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/application\/use-cases\/server\//,
    specPatterns: () => [],
    globPatterns: ['specs/static/**/*.spec.ts', 'specs/api/**/*.spec.ts'],
  },

  {
    sourcePattern: /^examples\//,
    specPatterns: () => [],
    globPatterns: ['specs/examples/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/presentation\/components\/blocks\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/blocks/**/*.spec.ts'],
  },

  {
    sourcePattern: /^src\/presentation\/components\/pages\//,
    specPatterns: () => [],
    globPatterns: ['specs/app/pages/**/*.spec.ts'],
  },
]

const IGNORE_PATTERNS = [
  /\.test\.ts$/,
  /\.test\.tsx$/,
  /\.d\.ts$/,
  /\.md$/,
  /\.json$/,
  /\.yml$/,
  /\.yaml$/,
  /^\./,
  /^scripts\//,
  /^docs\//,
  /^\.github\//,
  /^node_modules\//,
]

const shouldIgnoreFile = (filePath: string): boolean => {
  return IGNORE_PATTERNS.some((pattern) => pattern.test(filePath))
}

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

          const directSpecs = rule.specPatterns(match)
          for (const specPath of directSpecs) {
            const exists = yield* fs.exists(specPath)
            if (exists) {
              specs.push(specPath)
            }
          }

          if (rule.globPatterns) {
            for (const pattern of rule.globPatterns) {
              const globSpecs = yield* fs
                .glob(pattern)
                .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
              specs.push(...globSpecs)
            }
          }
        }

        return [...new Set(specs)]
      })

    const getSpecsToRun = (
      changedFiles: readonly string[]
    ): Effect.Effect<readonly string[], never> =>
      Effect.gen(function* () {
        const specs: string[] = []

        for (const file of changedFiles) {
          if (shouldIgnoreFile(file)) {
            continue
          }

          if (file.endsWith('.spec.ts') && file.startsWith('specs/')) {
            specs.push(file)
            continue
          }

          if (file.startsWith('src/') && file.endsWith('.ts')) {
            const relatedSpecs = yield* getSpecsForSource(file)
            specs.push(...relatedSpecs)
          }
        }

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


export const getSpecsForSource = (sourcePath: string) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.getSpecsForSource(sourcePath)))

export const getSpecsToRun = (changedFiles: readonly string[]) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.getSpecsToRun(changedFiles)))

export const shouldRunE2E = (changedFiles: readonly string[]) =>
  SpecMappingService.pipe(Effect.flatMap((s) => s.shouldRunE2E(changedFiles)))
