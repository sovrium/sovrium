/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { Effect } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { copyDirectory } from '@/infrastructure/filesystem/copy-directory'
import { logDebug } from '@/infrastructure/logging'
import {
  formatHtmlWithPrettier,
  generateClientHydrationScript,
  generateLlmsFullTxtContent,
  generateLlmsTxtContent,
  generateRobotsContent,
  generateSitemapContent,
  type HreflangConfig,
} from './static-content-generators'
import {
  injectHydrationScript,
  isGitHubPagesUrl,
  rewriteBasePathInHtml,
} from './static-url-rewriter'
import * as translationReplacer from './translation-replacer'
import type { GenerateStaticOptions } from './generate-static'
import type { App } from '@/domain/models/app'

// Re-export static modules for callers that previously used the import helpers
export { fs, path, translationReplacer }

/**
 * Minimal filesystem interface for static generation
 *
 * Compatible with Node.js fs/promises, Bun's filesystem APIs, and test mocks.
 * Only includes methods actually used by static generation functions.
 */
export interface FileSystemLike {
  readonly mkdir: (
    path: string,
    options?: { readonly recursive?: boolean }
  ) => Promise<string | undefined>
  readonly writeFile: (path: string, data: string, encoding?: BufferEncoding) => Promise<void>
  readonly readFile: (path: string, encoding: BufferEncoding) => Promise<string>
}

/**
 * Minimal path module interface for static generation
 *
 * Compatible with Node.js path module, Bun's path APIs, and test mocks.
 */
export interface PathModuleLike {
  readonly join: (...paths: readonly string[]) => string
}

/**
 * Write CSS file to output directory
 *
 * @param outputDir - Output directory path
 * @param css - Compiled CSS content
 * @param fs - Filesystem module (Node.js fs/promises or Bun's equivalent)
 * @param versionedFileName - Optional content-versioned twin filename
 *   (`output-<hash8>.css`). Rendered HTML links the versioned URL, so the
 *   static export must ship that filename too — same bytes, hashed name.
 */
export function writeCssFile(
  outputDir: string,
  css: string,
  fs: FileSystemLike,
  versionedFileName?: string
) {
  return Effect.gen(function* () {
    logDebug('Writing compiled CSS...')

    yield* Effect.tryPromise({
      try: () => fs.mkdir(`${outputDir}/assets`, { recursive: true }),
      catch: (error) =>
        new StaticGenerationError({
          message: `Failed to create assets directory`,
          cause: error,
        }),
    })

    yield* Effect.tryPromise({
      try: () => fs.writeFile(`${outputDir}/assets/output.css`, css, 'utf-8'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to write CSS file',
          cause: error,
        }),
    })

    if (versionedFileName !== undefined) {
      yield* Effect.tryPromise({
        try: () => fs.writeFile(`${outputDir}/assets/${versionedFileName}`, css, 'utf-8'),
        catch: (error) =>
          new StaticGenerationError({
            message: 'Failed to write versioned CSS file',
            cause: error,
          }),
      })
    }

    return 'assets/output.css'
  })
}

/**
 * Generate client-side hydration script if enabled
 *
 * @param outputDir - Output directory path
 * @param enabled - Whether hydration is enabled
 * @param fs - Filesystem module (Node.js fs/promises or Bun's equivalent)
 */
export function generateHydrationFiles(outputDir: string, enabled: boolean, fs: FileSystemLike) {
  return Effect.suspend(() =>
    enabled
      ? Effect.gen(function* () {
          logDebug('Generating client-side hydration script...')
          const clientJS = generateClientHydrationScript()
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/assets/client.js`, clientJS, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write client.js',
                cause: error,
              }),
          })
          return ['assets/client.js'] as const
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Resolve whether `publicDir` is a real directory on disk.
 *
 * Mirrors `collectPublicDirPhases` (server mode): a missing or non-directory
 * `publicDir` is NOT an error — it is silently skipped. The anchored `./public`
 * default (resolved by `resolveBuildPublicDir`) frequently points at a path
 * that does not exist (e.g. a config file with no sibling `public/`), so the
 * copy step must degrade gracefully rather than abort the whole build.
 */
const publicDirExists = (publicDir: string): Effect.Effect<boolean, never, never> =>
  Effect.tryPromise({
    try: () => fs.stat(publicDir).then((s) => s.isDirectory()),
    catch: () => false as const,
  }).pipe(Effect.orElseSucceed(() => false))

/**
 * Copy static assets from public directory if provided.
 *
 * Skips silently when `publicDir` is unset OR when it does not resolve to a
 * directory on disk — matching `sovrium start`'s static-asset behavior, where a
 * missing `./public` is a no-op rather than a fatal error.
 */
export function copyPublicAssets(publicDir: string | undefined, outputDir: string) {
  return Effect.suspend(() =>
    publicDir !== undefined
      ? Effect.gen(function* () {
          const exists = yield* publicDirExists(publicDir!)
          if (!exists) {
            logDebug(`Public directory ${publicDir} not found — skipping asset copy`)
            return [] as readonly string[]
          }
          logDebug(`Copying assets from ${publicDir}...`)
          return yield* copyDirectory(publicDir!, outputDir)
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Format HTML files with Prettier
 *
 * @param generatedFiles - List of generated file paths
 * @param outputDir - Output directory path
 * @param fs - Filesystem module (Node.js fs/promises or Bun's equivalent)
 * @param path - Path module (Node.js path or Bun's equivalent)
 */
export function formatHtmlFiles(
  generatedFiles: readonly string[],
  outputDir: string,
  fs: FileSystemLike,
  path: PathModuleLike
) {
  return Effect.gen(function* () {
    logDebug('Formatting HTML files with Prettier...')

    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- build-time static generation: filesystem/SSG work on a dedicated process, no shared database pool connection is held.
    yield* Effect.forEach(
      generatedFiles.filter((f) => f.endsWith('.html') && !f.endsWith('.js.html')),
      (file) =>
        Effect.gen(function* () {
          const filePath = file.startsWith('/') ? file : path.join(outputDir, file)
          const content = yield* Effect.tryPromise({
            try: () => fs.readFile(filePath, 'utf-8') as Promise<string>,
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to read HTML file for formatting: ${file}`,
                cause: error,
              }),
          })
          const formatted = yield* Effect.tryPromise({
            try: () => formatHtmlWithPrettier(content),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to format HTML with Prettier: ${file}`,
                cause: error,
              }),
          })
          yield* Effect.tryPromise({
            try: () => fs.writeFile(filePath, formatted, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to write formatted HTML file: ${file}`,
                cause: error,
              }),
          })
        }),
      { concurrency: 'unbounded' }
    )
  })
}

/**
 * Apply optimizations to generated HTML files
 *
 * @param config - Configuration object
 * @param config.generatedFiles - List of generated file paths
 * @param config.outputDir - Output directory path
 * @param config.options - Static generation options
 * @param config.fs - Filesystem module (Node.js fs/promises or Bun's equivalent)
 * @param config.path - Path module (Node.js path or Bun's equivalent)
 */
export function applyHtmlOptimizations(config: {
  readonly generatedFiles: readonly string[]
  readonly outputDir: string
  readonly options: GenerateStaticOptions
  readonly fs: FileSystemLike
  readonly path: PathModuleLike
}) {
  return Effect.gen(function* () {
    // Step 1: Apply base path rewriting if basePath is configured
    yield* Effect.suspend(() =>
      config.options.basePath !== undefined && config.options.basePath !== ''
        ? rewriteBasePathInHtml(
            config.generatedFiles,
            config.outputDir,
            config.options.basePath!,
            config.options.baseUrl,
            config.fs
          )
        : Effect.void
    )

    // Step 2: Inject hydration script into HTML if enabled
    yield* Effect.suspend(() =>
      (config.options.hydration ?? false)
        ? injectHydrationScript(
            config.generatedFiles,
            config.outputDir,
            config.options.basePath || '',
            config.fs,
            config.path
          )
        : Effect.void
    )
  })
}

/**
 * Build HreflangConfig from app languages when multi-language mode is active
 */
const buildHreflangConfig = (
  app: App,
  options: GenerateStaticOptions
): HreflangConfig | undefined => {
  if (!app.languages || !options.languages) return undefined
  return {
    localeMap: Object.fromEntries(
      app.languages.supported.map((lang) => [lang.code, lang.locale ?? lang.code])
    ),
    defaultLanguage: options.defaultLanguage ?? app.languages.default,
  }
}

/**
 * Generate sitemap.xml if enabled
 */
export function generateSitemapFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.suspend(() =>
    (options.generateSitemap ?? false)
      ? Effect.gen(function* () {
          logDebug('Generating sitemap.xml...')
          const pages = app.pages || []
          const languages = app.languages && options.languages ? options.languages : undefined
          const hreflangConfig = buildHreflangConfig(app, options)

          const sitemap = yield* Effect.tryPromise({
            try: () =>
              generateSitemapContent(
                pages,
                options.baseUrl || 'https://example.com',
                languages || hreflangConfig ? { languages, hreflangConfig } : undefined
              ),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to generate sitemap.xml',
                cause: error,
              }),
          })
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/sitemap.xml`, sitemap, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write sitemap.xml',
                cause: error,
              }),
          })
          return ['sitemap.xml'] as const
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Generate robots.txt if enabled
 *
 * @param app - Application configuration
 * @param outputDir - Output directory path
 * @param options - Static generation options
 * @param fs - Filesystem module (Node.js fs/promises or Bun's equivalent)
 */
export function generateRobotsFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.suspend(() =>
    (options.generateRobotsTxt ?? false)
      ? Effect.gen(function* () {
          logDebug('Generating robots.txt...')
          const pages = app.pages || []
          const robots = generateRobotsContent(
            pages,
            options.baseUrl || 'https://example.com',
            options.generateSitemap
          )
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/robots.txt`, robots, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write robots.txt',
                cause: error,
              }),
          })
          return ['robots.txt'] as const
        })
      : Effect.succeed([] as readonly string[])
  )
}

/** Write `/llms-full.txt` (gated on `app.llms.full !== false`). */
function writeLlmsFullFile(app: App, outputDir: string, fs: FileSystemLike) {
  return Effect.suspend(() =>
    app.llms?.full !== false
      ? Effect.gen(function* () {
          const full = yield* Effect.tryPromise({
            try: () => generateLlmsFullTxtContent(app),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to generate llms-full.txt',
                cause: error,
              }),
          })
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/llms-full.txt`, full, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({ message: 'Failed to write llms-full.txt', cause: error }),
          })
          return ['llms-full.txt'] as const
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Generate `/llms.txt` and `/llms-full.txt` for the static build when the app
 * declares content-directory pages and `app.llms.enabled` is not `false`.
 *
 * Mirrors the live `setupSeoRoutes` behavior (default-on, derived from
 * content-directory pages) so the built output matches the served routes.
 * Uses `options.baseUrl` as the absolute link prefix (static builds emit a
 * canonical origin), falling back to relative links when no baseUrl is set.
 */
export function generateLlmsFiles(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  const llmsEnabled =
    app.llms?.enabled !== false && (app.pages ?? []).some((page) => page.contentDir !== undefined)

  return Effect.suspend(() =>
    llmsEnabled
      ? Effect.gen(function* () {
          logDebug('Generating llms.txt...')
          const baseUrl = options.baseUrl?.replace(/\/$/, '') ?? ''
          const llms = yield* Effect.tryPromise({
            try: () => generateLlmsTxtContent(app, baseUrl),
            catch: (error) =>
              new StaticGenerationError({ message: 'Failed to generate llms.txt', cause: error }),
          })
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/llms.txt`, llms, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({ message: 'Failed to write llms.txt', cause: error }),
          })
          const fullFiles = yield* writeLlmsFullFile(app, outputDir, fs)
          return ['llms.txt', ...fullFiles] as readonly string[]
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Generate GitHub Pages specific files
 */
export function generateGitHubPagesFiles(
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.gen(function* () {
    // Create .nojekyll file
    const nojekyllFiles = yield* Effect.suspend(() =>
      options.deployment === 'github-pages'
        ? Effect.gen(function* () {
            logDebug('Creating .nojekyll file for GitHub Pages...')
            yield* Effect.tryPromise({
              try: () => fs.writeFile(`${outputDir}/.nojekyll`, '', 'utf-8'),
              catch: (error) =>
                new StaticGenerationError({
                  message: 'Failed to write .nojekyll',
                  cause: error,
                }),
            })
            return ['.nojekyll'] as const
          })
        : Effect.succeed([] as readonly string[])
    )

    // Generate CNAME file for custom domains
    const cnameFiles = yield* Effect.suspend(() =>
      options.deployment === 'github-pages' &&
      options.baseUrl !== undefined &&
      !isGitHubPagesUrl(options.baseUrl)
        ? Effect.gen(function* () {
            const domain = new URL(options.baseUrl!).hostname
            logDebug(`Creating CNAME file for custom domain: ${domain}...`)
            yield* Effect.tryPromise({
              try: () => fs.writeFile(`${outputDir}/CNAME`, domain, 'utf-8'),
              catch: (error) =>
                new StaticGenerationError({
                  message: 'Failed to write CNAME',
                  cause: error,
                }),
            })
            return ['CNAME'] as const
          })
        : Effect.succeed([] as readonly string[])
    )

    return [...nojekyllFiles, ...cnameFiles] as readonly string[]
  })
}
