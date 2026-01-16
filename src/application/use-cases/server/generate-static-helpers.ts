/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import {
  formatHtmlWithPrettier,
  generateClientHydrationScript,
  generateRobotsContent,
  generateSitemapContent,
} from './static-content-generators'
import {
  injectHydrationScript,
  isGitHubPagesUrl,
  rewriteBasePathInHtml,
} from './static-url-rewriter'
import type { GenerateStaticOptions } from './generate-static'
import type { App } from '@/domain/models/app'

/**
 * Import required filesystem module
 */
export function importFsModule() {
  return Effect.tryPromise({
    try: () => import('node:fs/promises'),
    catch: (error) =>
      new StaticGenerationError({
        message: 'Failed to import fs module',
        cause: error,
      }),
  })
}

/**
 * Import translation replacer module
 */
export function importTranslationReplacer() {
  return Effect.tryPromise({
    try: () => import('./translation-replacer'),
    catch: (error) =>
      new StaticGenerationError({
        message: 'Failed to import translation-replacer module',
        cause: error,
      }),
  })
}

/**
 * Import path module
 */
export function importPathModule() {
  return Effect.tryPromise({
    try: () => import('node:path'),
    catch: (error) =>
      new StaticGenerationError({
        message: 'Failed to import path module',
        cause: error,
      }),
  })
}

/**
 * Import copy-directory module
 */
export function importCopyDirectory() {
  return Effect.tryPromise({
    try: () => import('@/infrastructure/filesystem/copy-directory'),
    catch: (error) =>
      new StaticGenerationError({
        message: 'Failed to import copy-directory module',
        cause: error,
      }),
  })
}

/**
 * Write CSS file to output directory
 */
export function writeCssFile(
  outputDir: string,
  css: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any
) {
  return Effect.gen(function* () {
    yield* Console.log('🎨 Writing compiled CSS...')

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

    return 'assets/output.css'
  })
}

/**
 * Generate client-side hydration script if enabled
 */
export function generateHydrationFiles(
  outputDir: string,
  enabled: boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any
) {
  return Effect.if(enabled, {
    onTrue: () =>
      Effect.gen(function* () {
        yield* Console.log('💧 Generating client-side hydration script...')
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
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

/**
 * Copy static assets from public directory if provided
 */
export function copyPublicAssets(publicDir: string | undefined, outputDir: string) {
  return Effect.if(publicDir !== undefined, {
    onTrue: () =>
      Effect.gen(function* () {
        yield* Console.log(`📁 Copying assets from ${publicDir}...`)
        const { copyDirectory } = yield* importCopyDirectory()
        return yield* copyDirectory(publicDir!, outputDir)
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

/**
 * Format HTML files with Prettier
 */
export function formatHtmlFiles(
  generatedFiles: readonly string[],
  outputDir: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic path module import
  path: any
) {
  return Effect.gen(function* () {
    yield* Console.log('📝 Formatting HTML files with Prettier...')

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
 */
export function applyHtmlOptimizations(config: {
  readonly generatedFiles: readonly string[]
  readonly outputDir: string
  readonly options: GenerateStaticOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  readonly fs: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic path module import
  readonly path: any
}) {
  return Effect.gen(function* () {
    // Step 1: Apply base path rewriting if basePath is configured
    yield* Effect.if(config.options.basePath !== undefined && config.options.basePath !== '', {
      onTrue: () =>
        rewriteBasePathInHtml(
          config.generatedFiles,
          config.outputDir,
          config.options.basePath!,
          config.options.baseUrl,
          config.fs
        ),
      onFalse: () => Effect.succeed(undefined),
    })

    // Step 2: Inject hydration script into HTML if enabled
    yield* Effect.if(config.options.hydration ?? false, {
      onTrue: () =>
        injectHydrationScript(
          config.generatedFiles,
          config.outputDir,
          config.options.basePath || '',
          config.fs,
          config.path
        ),
      onFalse: () => Effect.succeed(undefined),
    })
  })
}

/**
 * Generate sitemap.xml if enabled
 */
export function generateSitemapFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any
) {
  return Effect.if(options.generateSitemap ?? false, {
    onTrue: () =>
      Effect.gen(function* () {
        yield* Console.log('🗺️  Generating sitemap.xml...')
        const pages = app.pages || []
        const isMultiLanguage = app.languages !== undefined && options.languages !== undefined
        const languages = isMultiLanguage ? options.languages : undefined
        const basePath = options.basePath || ''

        const sitemap = generateSitemapContent(
          pages,
          options.baseUrl || 'https://example.com',
          basePath,
          languages
        )
        yield* Effect.tryPromise({
          try: () => fs.writeFile(`${outputDir}/sitemap.xml`, sitemap, 'utf-8'),
          catch: (error) =>
            new StaticGenerationError({
              message: 'Failed to write sitemap.xml',
              cause: error,
            }),
        })
        return ['sitemap.xml'] as const
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

/**
 * Generate robots.txt if enabled
 */
export function generateRobotsFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any
) {
  return Effect.if(options.generateRobotsTxt ?? false, {
    onTrue: () =>
      Effect.gen(function* () {
        yield* Console.log('🤖 Generating robots.txt...')
        const pages = app.pages || []
        const basePath = options.basePath || ''
        const robots = generateRobotsContent(
          pages,
          options.baseUrl || 'https://example.com',
          basePath,
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
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

/**
 * Generate GitHub Pages specific files
 */
export function generateGitHubPagesFiles(
  outputDir: string,
  options: GenerateStaticOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic fs module import
  fs: any
) {
  return Effect.gen(function* () {
    // Create .nojekyll file
    const nojekyllFiles = yield* Effect.if(options.deployment === 'github-pages', {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('📄 Creating .nojekyll file for GitHub Pages...')
          yield* Effect.tryPromise({
            try: () => fs.writeFile(`${outputDir}/.nojekyll`, '', 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to write .nojekyll',
                cause: error,
              }),
          })
          return ['.nojekyll'] as const
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    // Generate CNAME file for custom domains
    const cnameFiles = yield* Effect.if(
      options.deployment === 'github-pages' &&
        options.baseUrl !== undefined &&
        !isGitHubPagesUrl(options.baseUrl),
      {
        onTrue: () =>
          Effect.gen(function* () {
            const domain = new URL(options.baseUrl!).hostname
            yield* Console.log(`📄 Creating CNAME file for custom domain: ${domain}...`)
            yield* Effect.tryPromise({
              try: () => fs.writeFile(`${outputDir}/CNAME`, domain, 'utf-8'),
              catch: (error) =>
                new StaticGenerationError({
                  message: 'Failed to write CNAME',
                  cause: error,
                }),
            })
            return ['CNAME'] as const
          }),
        onFalse: () => Effect.succeed([] as readonly string[]),
      }
    )

    return [...nojekyllFiles, ...cnameFiles] as readonly string[]
  })
}
