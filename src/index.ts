/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sovrium — Internal Entry Point
 *
 * This file provides:
 * 1. Runtime functions (start, build) used internally by the CLI (src/cli/index.ts)
 * 2. Type exports used by the @sovrium/types build script (scripts/build-types.ts)
 *
 * This is NOT a public npm library API. Sovrium is distributed as a standalone CLI binary.
 * See src/cli/index.ts for the CLI entry point.
 * See packages/types/ for the @sovrium/types npm package.
 */

import { Console, Effect, Schema, Either } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { normalizeAppConfig } from '@/application/use-cases/server/normalize-app-config'
import { startServer } from '@/application/use-cases/server/start-server'
import { AppSchema } from '@/domain/models/app'
import { generateAppJsonSchema as generateSchema } from '@/domain/services/json-schema'
import { warnForConfig } from '@/infrastructure/coming-soon'
import { createAppLayer, createStaticBuildLayer } from '@/infrastructure/layers/app-layer'
import { formatRuntimeError } from '@/infrastructure/logging'
import { withGracefulShutdown } from '@/infrastructure/server/lifecycle'
import type { ServerInstance } from '@/application/models/server'
import type {
  GenerateStaticOptions,
  GenerateStaticResult,
} from '@/application/use-cases/server/generate-static'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { AppEncoded } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { Auth } from '@/domain/models/app/auth'
import type { ComponentTemplate } from '@/domain/models/app/components/component'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Table } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'

// ============================================================================
// Internal Runtime API (used by src/cli/index.ts — NOT a public npm API)
// ============================================================================

/** Simple server interface with Promise-based methods. */
export interface SimpleServer {
  readonly url: string
  stop: () => Promise<void>
}

/** Convert Effect-based ServerInstance to simple Promise-based interface. */
const toSimpleServer = (server: Readonly<ServerInstance>): SimpleServer => ({
  url: server.url,
  stop: () => Effect.runPromise(server.stop),
})

/**
 * Start a Sovrium server. Used internally by the CLI start command.
 */
export const start = async (app: AppConfig, options: StartOptions = {}): Promise<SimpleServer> => {
  try {
    const normalizedApp = normalizeAppConfig(app)
    const validatedApp = Schema.decodeUnknownSync(AppSchema)(normalizedApp)

    // Coming-soon runtime warning: emit one stdout line per discriminator
    // value mapped to a schema currently flagged in
    // `src/infrastructure/coming-soon/registry.generated.ts`. Runs
    // *before* the Hono server begins listening so the warning is visible
    // in `sovrium start` output, the watch-mode reload banner, and any
    // E2E spec capturing startup chatter. See CLI-COMING-SOON-007/008
    // (and `coming-soon-warner.ts` for the FORCE_COLOR / stdout choice).
    Effect.runSync(warnForConfig(validatedApp))

    const program = Effect.gen(function* () {
      const server = yield* startServer(normalizedApp, options)
      yield* Effect.fork(withGracefulShutdown(server))
      return server
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)))

    const server = await Effect.runPromise(program)
    return toSimpleServer(server)
  } catch (error) {
    const message = formatRuntimeError(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw with enriched message
    throw new Error(
      `Sovrium failed to start: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

/**
 * Build static site files. Used internally by the CLI build command.
 */
export const build = async (
  app: AppConfig,
  options: GenerateStaticOptions = {}
): Promise<GenerateStaticResult> => {
  try {
    const validatedApp = Schema.decodeUnknownSync(AppSchema)(app)

    // Coming-soon runtime warning (mirrors `start()`): builds may include
    // pages or components referencing a schema flagged by `bun run
    // progress`, and we want the user to see the same `[sovrium] ...`
    // line they'd get from `sovrium start`.
    Effect.runSync(warnForConfig(validatedApp))

    const program = Effect.gen(function* () {
      yield* Console.log('Generating static site...')
      const result = yield* generateStaticUseCase(app, options)
      yield* Console.log(`✅ Static site generated to ${result.outputDir}`)
      yield* Console.log(`   Generated ${result.files.length} files`)
      return result
    }).pipe(Effect.provide(createStaticBuildLayer()))

    return await Effect.runPromise(program)
  } catch (error) {
    const message = formatRuntimeError(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw with enriched message
    throw new Error(
      `Sovrium failed to build: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

// ============================================================================
// Type Exports (consumed by scripts/build-types.ts → @sovrium/types)
// ============================================================================

/** Application configuration type for YAML/JSON/TypeScript config files. */
export type AppConfig = AppEncoded

/** Single page configuration (element of `AppConfig['pages']`). */
export type PageConfig = Page

/** Single table configuration (element of `AppConfig['tables']`). */
export type TableConfig = Table

/** Reusable component template (element of `AppConfig['components']`). */
export type ComponentConfig = ComponentTemplate

/** Theme / design tokens configuration (`AppConfig['theme']`). */
export type ThemeConfig = Theme

/** Authentication configuration (`AppConfig['auth']`). */
export type AuthConfig = Auth

/** Multi-language configuration (`AppConfig['languages']`). */
export type LanguageConfig = Languages

/** Built-in analytics configuration (`AppConfig['analytics']`). */
export type AnalyticsConfig = BuiltInAnalytics

// Re-export function parameter and return types
export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }

// ============================================================================
// Schema & Validation (used by CLI validate command)
// ============================================================================

/** Generate JSON Schema for the Sovrium AppSchema. */
export const generateAppJsonSchema = generateSchema

/** Result of validating a configuration object against AppSchema. */
export type ValidateConfigResult =
  | { readonly valid: true; readonly config: AppConfig }
  | { readonly valid: false; readonly errors: readonly string[] }

/** Validate an unknown value against the Sovrium AppSchema. */
export const validateConfig = (config: unknown): ValidateConfigResult => {
  const normalized = normalizeAppConfig(config as AppConfig)
  const result = Schema.decodeUnknownEither(AppSchema)(normalized)

  if (Either.isRight(result)) {
    return { valid: true, config: config as AppConfig }
  }

  const formatted = TreeFormatter.formatErrorSync(result.left)
  const errors = formatted.split('\n').filter((line) => line.trim().length > 0)
  return { valid: false, errors }
}
