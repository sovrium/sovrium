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

import { Effect, Either } from 'effect'
import { createAdminAccount } from '@/application/use-cases/auth/bootstrap-admin'
import { decodeAppConfigObject } from '@/application/use-cases/schema/decode-app-config'
import { generateSearchIndex } from '@/application/use-cases/server/generate-search-index'
import { generateStatic as generateStaticUseCase } from '@/application/use-cases/server/generate-static'
import { startServer } from '@/application/use-cases/server/start-server'
import { ConfigRejectedError, isConfigRejectedError } from '@/domain/errors/config-rejected'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { provisionRootSecret } from '@/infrastructure/crypto/root-secret'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { createAppLayer, createStaticBuildLayer } from '@/infrastructure/layers/app-layer'
import { formatRuntimeError, logDebug } from '@/infrastructure/logging'
import { withGracefulShutdown } from '@/infrastructure/server/lifecycle'
import type { ServerInstance } from '@/application/models/server'
import type { DecodeAppConfigResult } from '@/application/use-cases/schema/decode-app-config'
import type {
  GenerateStaticOptions,
  GenerateStaticResult,
} from '@/application/use-cases/server/generate-static'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { AppEncoded } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { Auth } from '@/domain/models/app/auth'
import type { Automation } from '@/domain/models/app/automations'
import type { ComponentTemplate } from '@/domain/models/app/components/component'
import type { Connection } from '@/domain/models/app/connections'
import type { EnvVar } from '@/domain/models/app/env'
import type { Form } from '@/domain/models/app/forms'
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
 * Run a config through the shared decode pipeline, throwing on refusal.
 *
 * `start` and `build` read the same file `sovrium validate` reads, and now read
 * it identically: same normalization, same post-decode semantic checks, and —
 * since the excess-property flip — the same refusal of a property AppSchema
 * does not declare. There is no per-call-site policy left to pass; the shared
 * decoder's `onExcessProperty: 'error'` default IS the contract.
 *
 * The refusal is thrown as {@link ConfigRejectedError} rather than a plain
 * `Error` so the CLI prints the report instead of a stack — see that type.
 */
const decodeOrThrow = (app: AppConfig): Extract<DecodeAppConfigResult, { valid: true }> => {
  const decoded = decodeAppConfigObject(app)
  if (!decoded.valid) {
    // eslint-disable-next-line functional/no-throw-statements -- surfaced by the caller's catch
    throw new ConfigRejectedError(decoded.errors.join('\n'))
  }
  return decoded
}

/**
 * Start a Sovrium server. Used internally by the CLI start command.
 */
export const start = async (app: AppConfig, options: StartOptions = {}): Promise<SimpleServer> => {
  try {
    const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)

    // Resolve the root secret before anything derives from it. Every later
    // consumer (the auth signing secret, token encryption, signed storage URLs)
    // reads the same memo, so doing it once here is what makes the outcome — and
    // the banner line reporting it — consistent for the whole boot. It is also
    // the only place a failure to WRITE the key can be reported as a refusal to
    // start rather than as a mid-boot surprise.
    // eslint-disable-next-line functional/no-expression-statements -- boot-time provisioning; the resolved value is read from the memo by every later consumer
    provisionRootSecret()

    const program = Effect.gen(function* () {
      const server = yield* startServer(rawApp, options)
      yield* Effect.fork(withGracefulShutdown(server))
      return server
    }).pipe(Effect.provide(createAppLayer(validatedApp.auth)))

    const server = await Effect.runPromise(program)
    return toSimpleServer(server)
  } catch (error) {
    // A refused config is already an author-readable report. Enriching it with
    // a stack and an issue link would tell the author to file a bug about their
    // own typo, so it passes through untouched — see `ConfigRejectedError`.
    // eslint-disable-next-line functional/no-throw-statements -- re-throw the refusal verbatim
    if (isConfigRejectedError(error)) throw error
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
    // `generateStatic` re-decodes the config it is handed, so it must receive
    // the same object `decodeOrThrow` validated — not a separately-parsed one.
    const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)

    const program = Effect.gen(function* () {
      logDebug('[ssg] generating static site...')
      const result = yield* generateStaticUseCase(rawApp, options)
      logDebug(`[ssg] static site generated to ${result.outputDir} (${result.files.length} files)`)

      // Activation gate for the public-pages search feature: only run the
      // search indexer when a `type: 'pageSearch'` component is present
      // somewhere in the page tree. Absent the component, no
      // `<outputDir>/sovrium-search/` directory is emitted.
      // See: src/domain/models/app/pages/has-page-search.ts
      if (hasPageSearchComponent(validatedApp)) {
        // Single source of truth: same filter the static-language-generators
        // apply (underscore-prefix + non-public access excluded — see
        // [internal ref]). Drift here would re-introduce the
        // access-leak regression.
        const publicPagePaths = getPublicPagePaths(validatedApp.pages)

        const searchResult = yield* generateSearchIndex({
          inputDir: result.outputDir,
          outputDir: result.outputDir,
          publicPagePaths,
        })

        return {
          outputDir: result.outputDir,
          files: [...result.files, ...searchResult.files],
        }
      }

      return result
    }).pipe(Effect.provide(createStaticBuildLayer()))

    return await Effect.runPromise(program)
  } catch (error) {
    // Same reasoning as `start`: a refusal is the author's to read, not a bug
    // report about Sovrium.
    // eslint-disable-next-line functional/no-throw-statements -- re-throw the refusal verbatim
    if (isConfigRejectedError(error)) throw error
    const message = formatRuntimeError(error)
    // eslint-disable-next-line functional/no-throw-statements -- re-throw with enriched message
    throw new Error(
      `Sovrium failed to build: ${message}\n\n` +
        `If this looks like a bug, please open an issue:\n` +
        `  https://github.com/sovrium/sovrium/issues/new`
    )
  }
}

/**
 * Pre-build the public-pages search artifacts into a `publicDir` so the
 * `sovrium start` server can serve `/sovrium-search/index.json` and
 * `/sovrium-search/runtime.js` via the static-asset route.
 *
 * Architecturally this mirrors `build()`: it validates the app, gates on
 * `hasPageSearchComponent`, runs `generateStatic` into a TEMP directory just
 * to materialize HTML the indexer can read, then runs `generateSearchIndex`
 * writing into `<publicDir>/sovrium-search/`. The temp directory is removed
 * before returning.
 *
 * Trade-off (v1): we run the full `generateStatic` pipeline (CSS, hydration,
 * asset copies, optimizations) into the temp dir rather than a leaner
 * "HTML-only" pass. The indexer only reads HTML — the CSS/JS/asset work is
 * wasted — but factoring that out across `generate-static.ts`'s seven steps
 * is a larger refactor. The waste only happens at boot when a `pageSearch`
 * component is present, so the simpler implementation wins for now.
 *
 * @param app - Raw application config (will be validated identically to
 *              `build()` / `start()`).
 * @param publicDir - Directory that will be served by the running CLI.
 *                    `sovrium-search/` is written under this directory. The
 *                    caller is responsible for ensuring this matches what
 *                    `start()` actually serves.
 * @returns `true` when the indexer ran (artifacts were written), `false` when
 *          the activation gate is closed (no `pageSearch` component).
 */
export const prebuildSearchIndex = async (app: AppConfig, publicDir: string): Promise<boolean> => {
  const { raw: rawApp, app: validatedApp } = decodeOrThrow(app)

  if (!hasPageSearchComponent(validatedApp)) {
    return false
  }

  // Lazy-load the heavy dependencies only when the gate is open — avoids
  // pulling fs/os into the path for apps that don't use page-search.
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')

  const tempStaticDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sovrium-search-'))

  try {
    const publicPagePaths = getPublicPagePaths(validatedApp.pages)

    const program = Effect.gen(function* () {
      // Static HTML emission into the temp dir. We pass the validated app
      // (NOT raw) so `generateStatic` re-validates against the same schema
      // and never drifts from this caller. Hydration is disabled because
      // the indexer only reads HTML — the hydration runtime would be
      // copy-wasted into a dir we're about to delete.
      yield* generateStaticUseCase(rawApp, {
        outputDir: tempStaticDir,
        hydration: false,
        generateSitemap: false,
        generateRobotsTxt: false,
        generateManifest: false,
        // This pass exists only to materialize HTML for the indexer, into a
        // temp dir removed moments later. Emitting the pre-compiled CSS
        // artifact would overwrite a stylesheet this boot does not own — the
        // one `sovrium build` produced, or whatever `SOVRIUM_CSS_FILE` points
        // at (which may be shared by other processes).
        emitPrecompiledCss: false,
      })

      // Indexer reads `tempStaticDir/*.html`, writes to
      // `publicDir/sovrium-search/{index.json,runtime.js}` — exactly the
      // two paths the `setupPublicDirRoute` will serve via Hono.
      yield* generateSearchIndex({
        inputDir: tempStaticDir,
        outputDir: publicDir,
        publicPagePaths,
      })
    }).pipe(Effect.provide(createStaticBuildLayer()))

    // eslint-disable-next-line functional/no-expression-statements -- driver for the pure Effect program
    await Effect.runPromise(program)
    return true
  } finally {
    // Always remove the temp dir, even on error. The publicDir output (if
    // partially written) is fine to leave — it's either complete or absent.
    // eslint-disable-next-line functional/no-expression-statements -- best-effort fs cleanup
    await fs.rm(tempStaticDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Credentials for `createAdmin`. */
export interface CreateAdminCredentials {
  readonly email: string
  readonly password: string
  readonly name?: string
}

/** Result of `createAdmin` — never throws for expected failures (mirrors `validateConfig`). */
export type CreateAdminResult =
  | { readonly ok: true; readonly created: boolean; readonly email: string }
  | { readonly ok: false; readonly message: string }

/**
 * Create an admin user from explicit credentials. Used internally by the CLI
 * `sovrium admin create` command.
 *
 * Mirrors `start`: validates the app, then runs migrations + the create-admin
 * use case inside the full app layer. Expected failures (auth not configured,
 * invalid email, weak password, duplicate user) are returned as a typed result
 * rather than thrown, so the CLI can print actionable messages.
 */
export const createAdmin = async (
  app: AppConfig,
  credentials: CreateAdminCredentials
): Promise<CreateAdminResult> => {
  try {
    const { app: validatedApp } = decodeOrThrow(app)

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
          : error._tag === 'BootstrapDatabaseError'
            ? error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
            : formatRuntimeError(error)
    return { ok: false, message }
  } catch (error) {
    // Defects (e.g. migration connection failure) bypass the typed channel.
    return { ok: false, message: formatRuntimeError(error) }
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

/** Single automation configuration (element of `AppConfig['automations']`). */
export type AutomationConfig = Automation

/** Single external connection configuration (element of `AppConfig['connections']`). */
export type ConnectionConfig = Connection

/** Single form configuration (element of `AppConfig['forms']`). */
export type FormConfig = Form

/** Single env-var declaration (element of `AppConfig['env']`). */
export type EnvConfig = EnvVar

// Re-export function parameter and return types
export type { StartOptions, GenerateStaticOptions, GenerateStaticResult }

// ============================================================================
// Removed: `validateConfig` and the `generateAppJsonSchema` re-export
// ============================================================================
//
// `validateConfig` was a FOURTH config contract — lenient, and it
// returned the caller's original object rather than the decoded one, so its
// `{ valid: true }` said nothing about what would actually run. It had zero
// call sites anywhere in this repository. Config validation now has exactly one
// implementation, `decodeAppConfigObject`
// (`@/application/use-cases/schema/decode-app-config`), reachable from a shell
// as `sovrium validate` and from a config as the `data:validate-config`
// automation action.
//
// `generateAppJsonSchema` here was a dead re-export of
// `@/domain/services/json-schema`, which the `sovrium schema` command and the
// schema-drift check import directly.
