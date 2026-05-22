/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Schema, Either } from 'effect'
import { TreeFormatter } from 'effect/ParseResult'
import { createAdminAccount } from '@/application/use-cases/auth/bootstrap-admin'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { normalizeAppConfig } from '@/application/use-cases/server/normalize-app-config'
import { startServer } from '@/application/use-cases/server/start-server'
import { AppSchema } from '@/domain/models/app'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'
import { generateAppJsonSchema as generateSchema } from '@/domain/services/json-schema'
import { warnForConfig } from '@/infrastructure/coming-soon'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { createAppLayer, createStaticBuildLayer } from '@/infrastructure/layers/app-layer'
import { formatRuntimeError, logDebug } from '@/infrastructure/logging'
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


export interface SimpleServer {
  readonly url: string
  stop: () => Promise<void>
}

const toSimpleServer = (server: Readonly<ServerInstance>): SimpleServer => ({
  url: server.url,
  stop: () => Effect.runPromise(server.stop),
})

export const start = async (app: AppConfig, options: StartOptions = {}): Promise<SimpleServer> => {
  try {
    const normalizedApp = normalizeAppConfig(app)
    const validatedApp = Schema.decodeUnknownSync(AppSchema)(normalizedApp)

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
    throw new Error(
      `Sovrium failed to start: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

export const build = async (
  app: AppConfig,
  options: GenerateStaticOptions = {}
): Promise<GenerateStaticResult> => {
  try {
    const validatedApp = Schema.decodeUnknownSync(AppSchema)(app)

    Effect.runSync(warnForConfig(validatedApp))

    const program = Effect.gen(function* () {
      logDebug('Generating static site...')
      const result = yield* generateStaticUseCase(app, options)
      logDebug(`Static site generated to ${result.outputDir} (${result.files.length} files)`)
      return result
    }).pipe(Effect.provide(createStaticBuildLayer()))

    return await Effect.runPromise(program)
  } catch (error) {
    const message = formatRuntimeError(error)
    throw new Error(
      `Sovrium failed to build: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

export interface CreateAdminCredentials {
  readonly email: string
  readonly password: string
  readonly name?: string
}

export type CreateAdminResult =
  | { readonly ok: true; readonly created: boolean; readonly email: string }
  | { readonly ok: false; readonly message: string }

export const createAdmin = async (
  app: AppConfig,
  credentials: CreateAdminCredentials
): Promise<CreateAdminResult> => {
  try {
    const normalizedApp = normalizeAppConfig(app)
    const validatedApp = Schema.decodeUnknownSync(AppSchema)(normalizedApp)

    if (!validatedApp.auth) {
      return {
        ok: false,
        message:
          'Auth is not configured for this app. Add an `auth:` block to your config before creating an admin.',
      }
    }

    const program = Effect.gen(function* () {
      yield* runMigrations(parseDatabaseDialectConfig())
      return yield* createAdminAccount(validatedApp, {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name ?? 'Administrator',
      })
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)), Effect.either)

    const result = await Effect.runPromise(program)

    if (Either.isRight(result)) {
      return { ok: true, created: !result.right.alreadyExists, email: credentials.email }
    }

    const error = result.left
    const message =
      error._tag === 'InvalidEmailError'
        ? `Invalid email address: ${error.email}`
        : error._tag === 'WeakPasswordError'
          ? error.message
          : error._tag === 'DatabaseError'
            ? error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
            : formatRuntimeError(error)
    return { ok: false, message }
  } catch (error) {
    return { ok: false, message: formatRuntimeError(error) }
  }
}


export type AppConfig = AppEncoded

export type PageConfig = Page

export type TableConfig = Table

export type ComponentConfig = ComponentTemplate

export type ThemeConfig = Theme

export type AuthConfig = Auth

export type LanguageConfig = Languages

export type AnalyticsConfig = BuiltInAnalytics

export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }


export const generateAppJsonSchema = generateSchema

export type ValidateConfigResult =
  | { readonly valid: true; readonly config: AppConfig }
  | { readonly valid: false; readonly errors: readonly string[] }

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
