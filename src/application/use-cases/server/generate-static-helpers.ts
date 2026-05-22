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

export { fs, path, translationReplacer }

export interface FileSystemLike {
  readonly mkdir: (
    path: string,
    options?: { readonly recursive?: boolean }
  ) => Promise<string | undefined>
  readonly writeFile: (path: string, data: string, encoding?: BufferEncoding) => Promise<void>
  readonly readFile: (path: string, encoding: BufferEncoding) => Promise<string>
}

export interface PathModuleLike {
  readonly join: (...paths: readonly string[]) => string
}

export function writeCssFile(outputDir: string, css: string, fs: FileSystemLike) {
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

    return 'assets/output.css'
  })
}

export function generateHydrationFiles(outputDir: string, enabled: boolean, fs: FileSystemLike) {
  return Effect.if(enabled, {
    onTrue: () =>
      Effect.gen(function* () {
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
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

export function copyPublicAssets(publicDir: string | undefined, outputDir: string) {
  return Effect.if(publicDir !== undefined, {
    onTrue: () =>
      Effect.gen(function* () {
        logDebug(`Copying assets from ${publicDir}...`)
        return yield* copyDirectory(publicDir!, outputDir)
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

export function formatHtmlFiles(
  generatedFiles: readonly string[],
  outputDir: string,
  fs: FileSystemLike,
  path: PathModuleLike
) {
  return Effect.gen(function* () {
    logDebug('Formatting HTML files with Prettier...')

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

export function applyHtmlOptimizations(config: {
  readonly generatedFiles: readonly string[]
  readonly outputDir: string
  readonly options: GenerateStaticOptions
  readonly fs: FileSystemLike
  readonly path: PathModuleLike
}) {
  return Effect.gen(function* () {
    yield* Effect.if(config.options.basePath !== undefined && config.options.basePath !== '', {
      onTrue: () =>
        rewriteBasePathInHtml(
          config.generatedFiles,
          config.outputDir,
          config.options.basePath!,
          config.options.baseUrl,
          config.fs
        ),
      onFalse: () => Effect.void,
    })

    yield* Effect.if(config.options.hydration ?? false, {
      onTrue: () =>
        injectHydrationScript(
          config.generatedFiles,
          config.outputDir,
          config.options.basePath || '',
          config.fs,
          config.path
        ),
      onFalse: () => Effect.void,
    })
  })
}

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

export function generateSitemapFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.if(options.generateSitemap ?? false, {
    onTrue: () =>
      Effect.gen(function* () {
        logDebug('Generating sitemap.xml...')
        const pages = app.pages || []
        const languages = app.languages && options.languages ? options.languages : undefined
        const hreflangConfig = buildHreflangConfig(app, options)

        const sitemap = generateSitemapContent(
          pages,
          options.baseUrl || 'https://example.com',
          languages || hreflangConfig ? { languages, hreflangConfig } : undefined
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

export function generateRobotsFile(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.if(options.generateRobotsTxt ?? false, {
    onTrue: () =>
      Effect.gen(function* () {
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
      }),
    onFalse: () => Effect.succeed([] as readonly string[]),
  })
}

export function generateGitHubPagesFiles(
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  return Effect.gen(function* () {
    const nojekyllFiles = yield* Effect.if(options.deployment === 'github-pages', {
      onTrue: () =>
        Effect.gen(function* () {
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
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    const cnameFiles = yield* Effect.if(
      options.deployment === 'github-pages' &&
        options.baseUrl !== undefined &&
        !isGitHubPagesUrl(options.baseUrl),
      {
        onTrue: () =>
          Effect.gen(function* () {
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
          }),
        onFalse: () => Effect.succeed([] as readonly string[]),
      }
    )

    return [...nojekyllFiles, ...cnameFiles] as readonly string[]
  })
}
