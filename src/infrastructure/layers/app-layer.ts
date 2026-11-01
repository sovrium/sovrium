/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  DesignKitAssetsLive,
  makeDesignKitAssetsLive,
} from '@/infrastructure/assets/design-kit-assets-live'
import { PageMeasureLive } from '@/infrastructure/browser/page-measure-live'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DatabaseUnownedLive } from '@/infrastructure/database/drizzle/layer'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import {
  createAppServicesLayer,
  PageRendererWithDeps,
} from '@/infrastructure/layers/app-services-layer'
import { EnvironmentLayer } from '@/infrastructure/layers/server-env-layer'
import { formatRuntimeError } from '@/infrastructure/logging'
import { LoggerLive } from '@/infrastructure/logging/logger'
import { ContentDirReaderLive } from '@/infrastructure/markdown/content-dir-reader-live'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

/**
 * Application layer composition — the boot-time root.
 *
 * Every live service the application reads (`createAppServicesLayer`), plus
 * `ServerFactoryLive`, the adapter `startServer` and the static build use to
 * build a listener or a render app.
 *
 * The factory is added HERE rather than inside `createAppServicesLayer`
 * because the servers it builds own a domain runtime composed from that
 * services layer: naming it there would make the factory's module import
 * itself through the runtime. Keeping it at this level is what makes the
 * import graph one-directional — `app-layer` → `server-factory-live` →
 * `domain-runtime` → `app-services-layer`, and nothing back.
 *
 * The `Database` the services layer requires is the owning-nothing
 * `DatabaseUnownedLive` here: the boot's steps (migrations, the first-admin
 * bootstrap, the sweeps, the render pass) and every CLI verb read the database
 * before, or without, a server runtime that owns the client. A server's domain
 * runtime provides its own owning `DatabaseLive` instead (`domain-runtime.ts`).
 *
 * @example
 * ```typescript
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
 * )
 * ```
 */
export const createAppLayer = (authConfig?: AuthConfig) =>
  Layer.mergeAll(createAppServicesLayer(authConfig), ServerFactoryLive, EnvironmentLayer).pipe(
    Layer.provide(DatabaseUnownedLive)
  )

/**
 * Static build layer composition
 *
 * A minimal layer for static site generation that excludes database,
 * auth, and repository services. Static builds only need rendering
 * and CSS compilation — no database connection required.
 *
 * This prevents subprocess hangs when `build()` is called without
 * DATABASE_URL (e.g., in E2E tests or CI static generation).
 *
 * The page renderer's data-source reads require a `Database`; the
 * owning-nothing `DatabaseUnownedLive` provides it without opening a connection,
 * so a build that never reads a record never builds a client.
 */
export const createStaticBuildLayer = Layer.mergeAll(
  // `ContentDirReader` — the Markdown twins and the page-search corpus read the
  // content directories through it.
  ContentDirReaderLive,
  ServerFactoryLive,
  PageRendererWithDeps,
  CSSCompilerLive,
  // `DesignKitAssets` — the files `sovrium design-system --format bundle` copies.
  DesignKitAssetsLive,
  StaticSiteGeneratorLive,
  DevToolsLayerOptional,
  LoggerLive,
  EnvironmentLayer
).pipe(Layer.provide(DatabaseUnownedLive))

/**
 * The static-build layer for the design-system bundle: the same services, with
 * the bundle's files able to read the app's public directory (its logo), and
 * the page measure the pages export sizes its canvas boards with.
 *
 * @param publicDir - the directory the app's public files sit in, if any.
 */
export const createDesignBundleLayer = (publicDir: string | undefined) =>
  Layer.mergeAll(createStaticBuildLayer, makeDesignKitAssetsLive(publicDir), PageMeasureLive)

/** Every service a program run inside {@link createAppLayer} may require. */
export type AppLayerServices = Layer.Success<ReturnType<typeof createAppLayer>>

/**
 * How {@link runEachInAppLayer} reports items it could not run: `noAuth` is the
 * message every item gets when the app has no `auth:` block, and `item` builds
 * one failure — with the thrown value when a defect stopped the whole run, so
 * the caller can classify it (an unreachable database, say) while the error
 * object still exists.
 */
export interface EachRunFailure<I, F> {
  readonly noAuth: string
  readonly item: (item: I, message: string, error?: unknown) => F
}

/**
 * Run a program that answers one outcome per item, providing it `layer`.
 *
 * The seam {@link runEachInAppLayer} binds to the app layer, kept separate so
 * the fallback rules can be tested without a database. With no layer every
 * item fails with `failure.noAuth`; with no items nothing is built; a rejected
 * run (a defect, or a failure the program left in its error channel) fails
 * every item alike. Expected failures are the program's own outcomes.
 */
export const runEachInLayer = async <I, O, F, R>(
  layer: (() => Layer.Layer<R, unknown>) | undefined,
  items: readonly I[],
  program: Effect.Effect<readonly O[], unknown, R>,
  failure: EachRunFailure<I, F>
): Promise<readonly (O | F)[]> => {
  if (layer === undefined) return items.map((item) => failure.item(item, failure.noAuth))
  if (items.length === 0) return []
  try {
    // The layer is built HERE, inside the `try`, so a construction failure is
    // reported per item like any other defect rather than escaping the caller.
    return await Effect.runPromise(program.pipe(Effect.provide(layer())))
  } catch (error) {
    return items.map((item) => failure.item(item, formatRuntimeError(error), error))
  }
}

/**
 * Run a per-item program inside the full app layer for `auth` — the runner the
 * entry point's account commands (`sovrium admin create`, `admin
 * reset-password`, `seed`) share. See {@link runEachInLayer} for the rules.
 */
export const runEachInAppLayer = <I, O, F>(
  auth: AuthConfig | undefined,
  items: readonly I[],
  program: Effect.Effect<readonly O[], unknown, AppLayerServices>,
  failure: EachRunFailure<I, F>
): Promise<readonly (O | F)[]> =>
  runEachInLayer(
    auth === undefined ? undefined : () => createAppLayer(auth),
    items,
    program,
    failure
  )
