/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { PageRenderer as PageRendererService } from '@/application/ports/page-renderer'
import { ServerFactory as ServerFactoryService } from '@/application/ports/server-factory'
import { AppSchema } from '@/domain/models/app'
import { compileCSS } from '@/infrastructure/css/compiler'
import { generateStaticSite } from '@/infrastructure/server/ssg-adapter'
import type { PageRenderer } from '@/application/ports/page-renderer'
import type { ServerFactory } from '@/application/ports/server-factory'
import type { App, Page } from '@/domain/models/app'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { FileCopyError } from '@/infrastructure/filesystem/copy-directory'
import type { SSGGenerationError } from '@/infrastructure/server/ssg-adapter'

/**
 * Options for static site generation
 */
export interface GenerateStaticOptions {
  readonly outputDir?: string // default: './static'
  readonly baseUrl?: string
  readonly basePath?: string
  readonly deployment?: 'github-pages' | 'generic'
  readonly languages?: readonly string[]
  readonly defaultLanguage?: string
  readonly generateSitemap?: boolean
  readonly generateRobotsTxt?: boolean
  readonly hydration?: boolean
  readonly generateManifest?: boolean
  readonly bundleOptimization?: 'split' | 'none'
  readonly publicDir?: string // Directory containing static assets to copy
}

/**
 * Result of static site generation
 */
export interface GenerateStaticResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

/**
 * Check if a URL is a GitHub Pages URL
 * Security: Use proper hostname checking to avoid substring matching vulnerabilities
 */
const isGitHubPagesUrl = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname
    return hostname === 'github.io' || hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

/**
 * Generate static site from app configuration
 *
 * This use case:
 * 1. Validates the app schema
 * 2. Creates a Hono app instance
 * 3. Generates static HTML files
 * 4. Creates supporting files (sitemap, robots.txt, etc.)
 *
 * @param app - The app configuration (unknown type, will be validated)
 * @param options - Static generation options
 * @returns Effect with output directory and generated files
 */
// eslint-disable-next-line max-lines-per-function -- Complex generator function for static generation workflow
export const generateStatic = (
  app: unknown,
  options: GenerateStaticOptions = {}
): Effect.Effect<
  GenerateStaticResult,
  | AppValidationError
  | StaticGenerationError
  | CSSCompilationError
  | ServerCreationError
  | SSGGenerationError
  | FileCopyError,
  ServerFactory | PageRenderer
> =>
  // eslint-disable-next-line max-lines-per-function, max-statements, complexity -- Complex Effect generator with multiple file generation steps and support file creation
  Effect.gen(function* () {
    // Step 1: Import dependencies
    const fs = yield* Effect.tryPromise({
      try: () => import('node:fs/promises'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import fs module',
          cause: error,
        }),
    })

    const { replaceAppTokens } = yield* Effect.tryPromise({
      try: () => import('./translation-replacer'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import translation-replacer module',
          cause: error,
        }),
    })

    // Step 2: Pre-process app to handle multi-language (replace tokens BEFORE validation)
    // If languages are configured, we need to skip token validation and handle it specially
    const rawApp = app as Record<string, unknown>
    const hasLanguages = rawApp.languages !== undefined

    // For multi-language apps, validate without pages first, then process each language
    const validatedApp: App =
      hasLanguages && rawApp.pages
        ? yield* Effect.gen(function* () {
            // Validate app without pages (to check languages config)
            const appWithoutPages = { ...rawApp, pages: undefined }
            const baseApp = yield* Effect.try({
              try: (): App => Schema.decodeUnknownSync(AppSchema)(appWithoutPages),
              catch: (error) => new AppValidationError(error),
            })

            // Use base app with original pages for now (will process per language)
            return { ...baseApp, pages: rawApp.pages as App['pages'] }
          })
        : yield* Effect.gen(function* () {
            // No languages or no pages - validate normally
            yield* Console.log('🔍 Validating app schema...')
            return yield* Effect.try({
              try: (): App => Schema.decodeUnknownSync(AppSchema)(app),
              catch: (error) => new AppValidationError(error),
            })
          })

    // Step 3: Get services from context
    const serverFactory = yield* ServerFactoryService
    const pageRenderer = yield* PageRendererService

    const outputDir = options.outputDir || './static'

    // Step 4: Generate static files for each language (or once if no languages)
    const allGeneratedFiles: readonly string[] =
      validatedApp.languages && validatedApp.pages
        ? // eslint-disable-next-line max-lines-per-function -- Multi-language generation requires sequential steps
          yield* Effect.gen(function* () {
            yield* Console.log(`🌍 Generating multi-language static site...`)
            const supportedLanguages = validatedApp.languages!.supported

            // Generate files for each language using Effect.forEach
            const langFiles = yield* Effect.forEach(
              supportedLanguages,
              (lang) =>
                Effect.gen(function* () {
                  yield* Console.log(`📝 Generating pages for language: ${lang.code}...`)

                  // Replace tokens for this language
                  const langApp = replaceAppTokens(validatedApp, lang.code)

                  // Validate the language-specific app
                  const validatedLangApp = yield* Effect.try({
                    try: (): App => Schema.decodeUnknownSync(AppSchema)(langApp),
                    catch: (error) => new AppValidationError(error),
                  })

                  // Create server instance for this language
                  const serverInstance = yield* serverFactory.create({
                    app: validatedLangApp,
                    port: 0,
                    hostname: 'localhost',
                    renderHomePage: pageRenderer.renderHome,
                    renderPage: pageRenderer.renderPage,
                    renderNotFoundPage: pageRenderer.renderNotFound,
                    renderErrorPage: pageRenderer.renderError,
                  })

                  yield* serverInstance.stop

                  // Generate static files in language subdirectory
                  const langOutputDir = `${outputDir}/${lang.code}`
                  // Filter out underscore-prefixed pages (admin/internal pages)
                  const pagePaths =
                    validatedLangApp.pages
                      ?.filter((page) => !page.path.startsWith('/_'))
                      .map((page) => page.path) || []
                  const ssgResult = yield* generateStaticSite(serverInstance.app, {
                    outputDir: langOutputDir,
                    pagePaths,
                  })

                  // Return files with language prefix (normalize paths to be relative)
                  return ssgResult.files.map((f) => {
                    // toSSG returns relative paths from the outputDir
                    // Simply prefix with language code
                    return `${lang.code}/${f}`
                  })
                }),
              { concurrency: 'unbounded' }
            )

            // Generate root index.html with default language
            yield* Console.log(`📝 Generating root index.html with default language...`)
            const defaultLang = validatedApp.languages!.default
            const defaultLangApp = replaceAppTokens(validatedApp, defaultLang)
            const validatedDefaultApp = yield* Effect.try({
              try: (): App => Schema.decodeUnknownSync(AppSchema)(defaultLangApp),
              catch: (error) => new AppValidationError(error),
            })

            const defaultServer = yield* serverFactory.create({
              app: validatedDefaultApp,
              port: 0,
              hostname: 'localhost',
              renderHomePage: pageRenderer.renderHome,
              renderPage: pageRenderer.renderPage,
              renderNotFoundPage: pageRenderer.renderNotFound,
              renderErrorPage: pageRenderer.renderError,
            })

            yield* defaultServer.stop

            // Generate only root index.html
            const rootSSGResult = yield* generateStaticSite(defaultServer.app, {
              outputDir,
              pagePaths: ['/'],
            })

            // Combine all files immutably
            return [...langFiles.flat(), ...rootSSGResult.files]
          })
        : yield* Effect.gen(function* () {
            // No multi-language - generate normally
            yield* Console.log('🏗️  Creating application instance...')
            const serverInstance = yield* serverFactory.create({
              app: validatedApp,
              port: 0,
              hostname: 'localhost',
              renderHomePage: pageRenderer.renderHome,
              renderPage: pageRenderer.renderPage,
              renderNotFoundPage: pageRenderer.renderNotFound,
              renderErrorPage: pageRenderer.renderError,
            })

            yield* serverInstance.stop

            // Filter out underscore-prefixed pages (admin/internal pages)
            const pagePaths =
              validatedApp.pages
                ?.filter((page) => !page.path.startsWith('/_'))
                .map((page) => page.path) || []
            yield* Console.log(`📝 Generating static HTML files for ${pagePaths.length} pages...`)
            const ssgResult = yield* generateStaticSite(serverInstance.app, {
              outputDir,
              pagePaths,
            })
            return ssgResult.files
          })

    // Step 5: Get CSS from cache (already compiled during server creation)
    yield* Console.log('🎨 Getting compiled CSS...')
    const { css } = yield* compileCSS(validatedApp)

    // Create assets directory
    yield* Effect.tryPromise({
      try: () => fs.mkdir(`${outputDir}/assets`, { recursive: true }),
      catch: (error) =>
        new StaticGenerationError({
          message: `Failed to create assets directory`,
          cause: error,
        }),
    })

    // Write CSS file
    yield* Effect.tryPromise({
      try: () => fs.writeFile(`${outputDir}/assets/output.css`, css, 'utf-8'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to write CSS file',
          cause: error,
        }),
    })

    // Generate client.js for hydration if enabled
    const hydrationFiles = yield* Effect.if(options.hydration ?? false, {
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

    // Step 6: Copy static assets from publicDir if provided
    const assetFiles = yield* Effect.if(options.publicDir !== undefined, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log(`📁 Copying assets from ${options.publicDir}...`)
          const { copyDirectory } = yield* Effect.tryPromise({
            try: () => import('@/infrastructure/filesystem/copy-directory'),
            catch: (error) =>
              new StaticGenerationError({
                message: 'Failed to import copy-directory module',
                cause: error,
              }),
          })
          return yield* copyDirectory(options.publicDir!, outputDir)
        }),
      onFalse: () => Effect.succeed([] as readonly string[]),
    })

    // Collect all generated files (HTML from toSSG + CSS + hydration + assets)
    const generatedFiles = [
      ...allGeneratedFiles,
      'assets/output.css',
      ...hydrationFiles,
      ...assetFiles,
    ] as readonly string[]

    // Step 5a: Format HTML files with Prettier for better readability
    yield* Console.log('📝 Formatting HTML files with Prettier...')
    const path = yield* Effect.tryPromise({
      try: () => import('node:path'),
      catch: (error) =>
        new StaticGenerationError({
          message: 'Failed to import path module',
          cause: error,
        }),
    })

    // Format each HTML file with Prettier (exclude .js.html and other asset files)
    yield* Effect.forEach(
      generatedFiles.filter((f) => f.endsWith('.html') && !f.endsWith('.js.html')),
      (file) =>
        Effect.gen(function* () {
          const filePath = file.startsWith('/') ? file : path.join(outputDir, file)
          const content = yield* Effect.tryPromise({
            try: () => fs.readFile(filePath, 'utf-8'),
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

    // Step 5b: Apply base path rewriting if basePath is configured
    yield* Effect.if(options.basePath !== undefined && options.basePath !== '', {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log(`🔗 Rewriting URLs with base path: ${options.basePath}...`)
          // Only rewrite actual page HTML files, not assets with .html extension
          const htmlFiles = generatedFiles.filter(
            (f) =>
              f.endsWith('.html') &&
              !f.startsWith('assets/') &&
              !f.includes('/assets/') &&
              !f.endsWith('.js.html')
          )

          yield* Effect.forEach(
            htmlFiles,
            (file) =>
              Effect.gen(function* () {
                // file might be absolute or relative - handle both cases
                const filePath =
                  file.startsWith('/') || file.startsWith(outputDir) ? file : `${outputDir}/${file}`

                const content = yield* Effect.tryPromise({
                  try: () => fs.readFile(filePath, 'utf-8'),
                  catch: (error) =>
                    new StaticGenerationError({
                      message: `Failed to read HTML file: ${file}`,
                      cause: error,
                    }),
                })

                // Determine page path from filename (index.html → /, about.html → /about)
                const relativeFile = file.startsWith(outputDir)
                  ? file.slice(outputDir.length + 1)
                  : file

                // Check if this file is in a language subdirectory (e.g., en/index.html, fr/about.html)
                const langMatch = relativeFile.match(/^([a-z]{2})\//)
                const langPrefix = langMatch ? `/${langMatch[1]}` : ''

                // Extract page path without language prefix
                const fileWithoutLang = langPrefix ? relativeFile.slice(3) : relativeFile // Skip "en/"
                const basePagePath =
                  fileWithoutLang === 'index.html'
                    ? '/'
                    : `/${fileWithoutLang.replace('.html', '')}`

                // Full page path includes basePath + language prefix
                const fullBasePath = `${options.basePath!}${langPrefix}`

                // For canonical URL, use the page path relative to baseUrl
                // If baseUrl includes the basePath (e.g., https://example.com/myapp),
                // we should use basePagePath directly
                const canonicalPagePath =
                  basePagePath === '/'
                    ? langPrefix === ''
                      ? '/'
                      : langPrefix
                    : `${langPrefix}${basePagePath}`

                const rewrittenContent = rewriteUrlsWithBasePath(
                  content,
                  fullBasePath,
                  options.baseUrl,
                  canonicalPagePath
                )

                yield* Effect.tryPromise({
                  try: () => fs.writeFile(filePath, rewrittenContent, 'utf-8'),
                  catch: (error) =>
                    new StaticGenerationError({
                      message: `Failed to write rewritten HTML file: ${file}`,
                      cause: error,
                    }),
                })
              }),
            { concurrency: 'unbounded' }
          )
        }),
      onFalse: () => Effect.succeed(undefined),
    })

    // Step 5c: Inject hydration script into HTML if enabled
    yield* Effect.if(options.hydration ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('💧 Injecting hydration script into HTML files...')
          const htmlFiles = generatedFiles.filter(
            (f) =>
              f.endsWith('.html') &&
              !f.endsWith('.js.html') &&
              !f.startsWith('assets/') &&
              !f.includes('/assets/')
          )

          yield* Effect.forEach(
            htmlFiles,
            (file) =>
              Effect.gen(function* () {
                const filePath = file.startsWith('/') ? file : path.join(outputDir, file)
                const content = yield* Effect.tryPromise({
                  try: () => fs.readFile(filePath, 'utf-8'),
                  catch: (error) =>
                    new StaticGenerationError({
                      message: `Failed to read HTML file for hydration injection: ${file}`,
                      cause: error,
                    }),
                })

                // Inject hydration script before </body>
                const basePath = options.basePath || ''
                const hydrationScript = `<script src="${basePath}/assets/client.js" defer=""></script>`
                const updatedContent = content.replace('</body>', `${hydrationScript}\n</body>`)

                yield* Effect.tryPromise({
                  try: () => fs.writeFile(filePath, updatedContent, 'utf-8'),
                  catch: (error) =>
                    new StaticGenerationError({
                      message: `Failed to write HTML file with hydration script: ${file}`,
                      cause: error,
                    }),
                })
              }),
            { concurrency: 'unbounded' }
          )
        }),
      onFalse: () => Effect.succeed(undefined),
    })

    // Get pages for sitemap generation
    const pages = validatedApp.pages || []

    // Step 6: Generate supporting files
    const sitemapFiles = yield* Effect.if(options.generateSitemap ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('🗺️  Generating sitemap.xml...')
          // Check if multi-language is enabled
          const isMultiLanguage =
            validatedApp.languages !== undefined && options.languages !== undefined
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

    const robotsFiles = yield* Effect.if(options.generateRobotsTxt ?? false, {
      onTrue: () =>
        Effect.gen(function* () {
          yield* Console.log('🤖 Generating robots.txt...')
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

    const githubFiles = yield* Effect.if(options.deployment === 'github-pages', {
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

    // Generate CNAME file for custom domains on GitHub Pages
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

    // Combine all files immutably
    const allFiles = [
      ...generatedFiles,
      ...sitemapFiles,
      ...robotsFiles,
      ...githubFiles,
      ...cnameFiles,
    ] as readonly string[]

    yield* Console.log(`✅ Generated ${allFiles.length} files to ${outputDir}`)

    return {
      outputDir,
      files: allFiles,
    }
  })

/**
 * Format HTML with Prettier for professional formatting
 * Loads Prettier config and formats HTML using the HTML parser
 */
const formatHtmlWithPrettier = async (html: string): Promise<string> => {
  const prettier = await import('prettier')
  const config = await prettier.resolveConfig(process.cwd())

  return await prettier.format(html, {
    ...config,
    parser: 'html',
  })
}

/**
 * Generate sitemap.xml content
 */
const generateSitemapContent = (
  pages: readonly Page[],
  baseUrl: string,
  _basePath: string = '',
  languages?: readonly string[]
): string => {
  // Filter out pages with noindex AND underscore-prefixed pages
  const indexablePages = pages.filter((page) => !page.meta?.noindex && !page.path.startsWith('/_'))

  // Generate lastmod date (current date in ISO format)
  const lastmod = new Date().toISOString().split('T')[0]

  // Generate sitemap entries using immutable patterns
  const entries: readonly string[] =
    languages && languages.length > 0
      ? // Multi-language mode: Generate entries for each language
        languages.flatMap((lang) =>
          indexablePages.map((page) => {
            const priority = page.meta?.priority ?? 0.5
            const changefreq = page.meta?.changefreq ?? 'monthly'
            // Multi-language URLs: /{lang}/ or /{lang}{path}
            // Add trailing slash for root path (/) within language
            const pagePath = page.path === '/' ? '' : page.path
            const fullPath = `/${lang}${pagePath}${pagePath === '' ? '/' : ''}`

            return `  <url>
    <loc>${baseUrl}${fullPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority.toFixed(1)}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
          })
        )
      : // Single language mode: Generate entries without language prefix
        indexablePages.map((page) => {
          const priority = page.meta?.priority ?? 0.5
          const changefreq = page.meta?.changefreq ?? 'monthly'
          const fullPath = page.path

          return `  <url>
    <loc>${baseUrl}${fullPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority.toFixed(1)}</priority>
    <changefreq>${changefreq}</changefreq>
  </url>`
        })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`
}

/**
 * Generate robots.txt content
 */
const generateRobotsContent = (
  pages: readonly Page[],
  baseUrl: string,
  _basePath: string = '',
  includeSitemap: boolean = false
): string => {
  const baseLines = ['User-agent: *', 'Allow: /']

  // Add Disallow rules for:
  // 1. Pages with noindex or robots directives containing "noindex"
  // 2. Underscore-prefixed pages (admin/internal pages)
  const disallowedPages = pages.filter(
    (page) =>
      page.meta?.noindex === true ||
      (page.meta?.robots && page.meta.robots.includes('noindex')) ||
      page.path.startsWith('/_')
  )

  const disallowLines = disallowedPages.map((page) => `Disallow: ${page.path}`)

  const sitemapLine = includeSitemap ? [`Sitemap: ${baseUrl}/sitemap.xml`] : []
  const lines = [...baseLines, ...disallowLines, ...sitemapLine]

  return lines.join('\n')
}

/**
 * Generate client-side hydration script
 *
 * This minimal script enables React hydration on the client side.
 * For production, this would:
 * - Load React runtime
 * - Re-render components with client-side state
 * - Attach event listeners
 * - Enable interactive features
 *
 * Current implementation: Minimal placeholder for testing
 */
const generateClientHydrationScript = (): string => {
  return `/**
 * Sovrium Client-Side Hydration Script
 * Generated by Sovrium Static Site Generator
 */

// Minimal hydration script for static sites
// This enables client-side interactivity after initial SSR
console.log('Sovrium: Client-side hydration enabled')

// Future: Load React runtime and hydrate components
// Future: Initialize client-side routing
// Future: Restore interactive state
`
}

/**
 * Rewrite URLs in HTML content with base path prefix
 *
 * Rewrites:
 * - href="/..." → href="/basePath/..."
 * - src="/..." → src="/basePath/..."
 * - Adds canonical link if missing (when baseUrl is provided)
 * - Skips URLs that already have base path
 * - Skips external URLs (http://, https://, //, etc.)
 */
const rewriteUrlsWithBasePath = (
  html: string,
  basePath: string,
  baseUrl?: string,
  pagePath?: string
): string => {
  // Remove trailing slash from basePath if present
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath

  // Extract base path without language code for assets
  // If basePath is "/my-project/en", extract "/my-project" for assets
  const basePathWithoutLang = normalizedBasePath.replace(/\/[a-z]{2}$/, '')

  // Rewrite href="/..." to href="/basePath/..."
  // But for /assets/*, use only the base path without language code
  // Also handle hreflang alternate links specially (they should link to other languages)
  const hrefRewritten = html.replace(
    /(hrefLang|hreflang)="([^"]*)"[^>]*href="(\/[^"]*)"/g,
    (_match, _hreflangAttr, langCode, url) => {
      // For hreflang links, extract language from URL and construct correct path
      // Example: href="/en/" → href="https://baseUrl/my-project/en/"
      // Convert hrefLang to lowercase hreflang for standards compliance
      const normalizedAttr = 'hreflang'
      // Extract short code from full locale (e.g., "en-US" → "en")
      const shortCode = langCode.split('-')[0]
      // hreflang URLs should include full base URL
      const fullUrl = baseUrl ? `${baseUrl}${url}` : `${basePathWithoutLang}${url}`
      return `${normalizedAttr}="${shortCode}" href="${fullUrl}"`
    }
  )

  // Now rewrite remaining href attributes (non-hreflang)
  const allHrefRewritten = hrefRewritten.replace(
    /(?<!hreflang=")href="(\/[^"]*)"/g,
    (_match, url) => {
      if (url.startsWith('/assets/')) {
        // Assets are shared across languages - use base path only
        return `href="${basePathWithoutLang}${url}"`
      }
      return `href="${normalizedBasePath}${url}"`
    }
  )

  // Rewrite src="/..." to src="/basePath/..."
  // Assets paths should not include language prefix
  const srcRewritten = allHrefRewritten.replace(/src="(\/[^"]*)"/g, (_match, url) => {
    if (url.startsWith('/assets/')) {
      // Assets are shared across languages - use base path only
      return `src="${basePathWithoutLang}${url}"`
    }
    return `src="${normalizedBasePath}${url}"`
  })

  // Add canonical link if missing and baseUrl is provided
  if (baseUrl && pagePath && !srcRewritten.includes('rel="canonical"')) {
    // Construct canonical URL from baseUrl + pagePath
    // Remove trailing slash from baseUrl for consistent URLs
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const canonicalPath = pagePath === '/' ? '/' : pagePath
    const canonicalUrl = `${normalizedBaseUrl}${canonicalPath}`

    // Insert canonical link in <head> before </head>
    return srcRewritten.replace('</head>', `<link rel="canonical" href="${canonicalUrl}"></head>`)
  }

  return srcRewritten
}
