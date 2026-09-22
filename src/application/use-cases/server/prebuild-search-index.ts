/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { generateSearchIndex } from '@/application/use-cases/server/generate-search-index'
import { generateStatic } from '@/application/use-cases/server/generate-static'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { getPublicPagePaths } from '@/domain/models/app/pages/public-pages'
import type { CSSCompiler as CSSCompilerService } from '@/application/ports/services/css-compiler'
import type { PageRenderer as PageRendererService } from '@/application/ports/services/page-renderer'
import type { ServerFactory as ServerFactoryService } from '@/application/ports/services/server-factory'
import type { StaticSiteGenerator as StaticSiteGeneratorService } from '@/application/ports/services/static-site-generator'
import type { App } from '@/domain/models/app'

/**
 * Everything the two composed use-cases can fail with, DERIVED rather than
 * enumerated. Listing the nine constituent error types by hand would be a
 * second place to update every time either of them grows one, and the only
 * consumer treats the whole channel uniformly anyway: `startServer` logs it
 * and boots regardless.
 */
type PrebuildSearchIndexError =
  | Effect.Error<ReturnType<typeof generateStatic>>
  | Effect.Error<ReturnType<typeof generateSearchIndex>>
  // Named explicitly rather than derived, because it is raised HERE: the temp
  // directory both composed use-cases render into is allocated by this module.
  | SearchIndexTempDirError

/** The temporary directory the search index is rendered into could not be made. */
class SearchIndexTempDirError extends Data.TaggedError('SearchIndexTempDirError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/** The four services a static render needs — exactly `createStaticBuildLayer`'s members. */
type StaticBuildServices =
  ServerFactoryService | PageRendererService | CSSCompilerService | StaticSiteGeneratorService

/**
 * Materialize the public-pages search artifacts into `publicDir`, so the
 * running server can serve `/sovrium-search/index.json` and
 * `/sovrium-search/runtime.js` through the ordinary static-asset route.
 *
 * WHY THIS IS A USE-CASE AND NOT A DRIVER. It used to live in `src/index.ts`
 * as an async function that provided its own `createStaticBuildLayer`, and the
 * CLI called it by hand before `start()`. That made the index a property of
 * the *CLI invocation* rather than of the *server*: every other caller of
 * `startServer` — the `--watch` reload, and the in-process E2E fixture —
 * booted a server that answered 404 for the two search paths, with no signal
 * that anything was missing. Expressed as an Effect with its requirements
 * UNPROVIDED, it becomes a step of the boot sequence that every caller runs,
 * and the four services it needs are already members of `createAppLayer`
 * (they are exactly `createStaticBuildLayer`'s members, which are a strict
 * subset) — so no caller had to widen what it provides.
 *
 * The index is a BUILD ARTIFACT, not a lazily-computed response. Nothing
 * regenerates it per request; it is written once, before the listener is
 * useful, and served as a file thereafter.
 *
 * @param rawApp - Raw (encoded) config. Passed to `generateStatic`, which
 *                 re-validates it against the same schema, so this caller and
 *                 that one can never drift.
 * @param validatedApp - Decoded config, used for the activation gate and the
 *                       public-page path list.
 * @param publicDir - Directory the server serves. `sovrium-search/` is written
 *                    underneath it. The caller guarantees this is the same
 *                    directory the static-asset route mounts.
 * @returns `true` when the indexer ran, `false` when the activation gate is
 *          closed (no page-scoped `search-input` anywhere in the config).
 */
export const prebuildSearchIndex = (
  rawApp: unknown,
  validatedApp: App,
  publicDir: string
): Effect.Effect<boolean, PrebuildSearchIndexError, StaticBuildServices> =>
  hasPageSearchComponent(validatedApp)
    ? Effect.acquireUseRelease(
        // Lazy `node:*` imports: they cost nothing for the overwhelming
        // majority of configs, which declare no page-scoped search and never reach
        // this branch at all.
        Effect.tryPromise({
          try: async () => {
            const fs = await import('node:fs/promises')
            const os = await import('node:os')
            const path = await import('node:path')
            return {
              fs,
              tempStaticDir: await fs.mkdtemp(path.join(os.tmpdir(), 'sovrium-search-')),
            }
          },
          // `mkdtemp` rejects on a full or read-only temp filesystem. That is a
          // real, reportable build failure rather than a defect — the caller
          // already has an error type for "the search index could not be built".
          catch: (cause) =>
            new SearchIndexTempDirError({
              message: `Could not create a temporary directory for the search index: ${String(cause)}`,
              cause,
            }),
        }),
        ({ tempStaticDir }) => buildInto(rawApp, validatedApp, tempStaticDir, publicDir),
        // Always remove the temp dir, on success and on failure alike. A
        // partially-written `publicDir` is fine to leave: it is either complete
        // or absent, and the next boot overwrites it.
        ({ fs, tempStaticDir }) =>
          Effect.tryPromise({
            try: () => fs.rm(tempStaticDir, { recursive: true, force: true }),
            catch: (cause) =>
              new SearchIndexTempDirError({
                message: `Could not remove ${tempStaticDir}`,
                cause,
              }),
          }).pipe(
            // effect-swallow: the release arm of `acquireUseRelease` — a temp directory the OS reclaims anyway must never displace the build result this whole block exists to produce.
            Effect.ignoreCause
          )
      )
    : Effect.succeed(false).pipe(Effect.withSpan('server.prebuild-search-index'))

/**
 * Emit HTML into a temp dir purely so the indexer has something to read, then
 * index it into `publicDir`. Split out to keep `prebuildSearchIndex`'s
 * acquire/use/release shape legible.
 */
const buildInto = (
  rawApp: unknown,
  validatedApp: App,
  tempStaticDir: string,
  publicDir: string
): Effect.Effect<boolean, PrebuildSearchIndexError, StaticBuildServices> =>
  Effect.gen(function* () {
    // Hydration and the sitemap/robots/manifest passes are all disabled: the
    // indexer reads HTML and nothing else, and everything else would be
    // copy-wasted into a directory removed moments later.
    yield* generateStatic(rawApp, {
      outputDir: tempStaticDir,
      hydration: false,
      generateSitemap: false,
      generateRobotsTxt: false,
      generateManifest: false,
      // This pass exists only to materialize HTML into a temp dir. Emitting
      // the pre-compiled CSS artifact would overwrite a stylesheet this boot
      // does not own — the one `sovrium build` produced, or whatever
      // `SOVRIUM_CSS_FILE` points at, which may be shared by other processes.
      emitPrecompiledCss: false,
    })

    // Writes `publicDir/sovrium-search/{index.json,runtime.js}` — exactly the
    // two paths `setupPublicDirRoute` will serve.
    yield* generateSearchIndex({
      inputDir: tempStaticDir,
      outputDir: publicDir,
      publicPagePaths: getPublicPagePaths(validatedApp.pages),
    })

    return true
  })
