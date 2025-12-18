/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-params, max-lines-per-function -- Complex URL rewriting functions require explicit dependencies */

import { Effect, Console } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import type * as fs from 'node:fs/promises'
import type * as path from 'node:path'

/**
 * Check if a URL is a GitHub Pages URL
 * Security: Use proper hostname checking to avoid substring matching vulnerabilities
 */
export const isGitHubPagesUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url)
    return hostname === 'github.io' || hostname.endsWith('.github.io')
  } catch {
    return false
  }
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
export const rewriteUrlsWithBasePath = (
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

/**
 * Rewrite URLs in HTML files with base path
 */
export const rewriteBasePathInHtml = (
  generatedFiles: readonly string[],
  outputDir: string,
  basePath: string,
  baseUrl: string | undefined,
  // eslint-disable-next-line functional/prefer-immutable-types -- Module import type
  fsModule: typeof fs
): Effect.Effect<void, StaticGenerationError, never> =>
  Effect.gen(function* () {
    yield* Console.log(`🔗 Rewriting URLs with base path: ${basePath}...`)
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
            try: () => fsModule.readFile(filePath, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to read HTML file: ${file}`,
                cause: error,
              }),
          })

          // Determine page path from filename (index.html → /, about.html → /about)
          const relativeFile = file.startsWith(outputDir) ? file.slice(outputDir.length + 1) : file

          // Check if this file is in a language subdirectory (e.g., en/index.html, fr/about.html)
          const langMatch = relativeFile.match(/^([a-z]{2})\//)
          const langPrefix = langMatch ? `/${langMatch[1]}` : ''

          // Extract page path without language prefix
          const fileWithoutLang = langPrefix ? relativeFile.slice(3) : relativeFile // Skip "en/"
          const basePagePath =
            fileWithoutLang === 'index.html' ? '/' : `/${fileWithoutLang.replace('.html', '')}`

          // Full page path includes basePath + language prefix
          const fullBasePath = `${basePath}${langPrefix}`

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
            baseUrl,
            canonicalPagePath
          )

          yield* Effect.tryPromise({
            try: () => fsModule.writeFile(filePath, rewrittenContent, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to write rewritten HTML file: ${file}`,
                cause: error,
              }),
          })
        }),
      { concurrency: 'unbounded' }
    )
  })

/**
 * Inject client-side hydration script into HTML files
 */
export const injectHydrationScript = (
  generatedFiles: readonly string[],
  outputDir: string,
  basePath: string,
  // eslint-disable-next-line functional/prefer-immutable-types -- Module import type
  fsModule: typeof fs,
  // eslint-disable-next-line functional/prefer-immutable-types -- Module import type
  pathModule: typeof path
): Effect.Effect<void, StaticGenerationError, never> =>
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
          const filePath = file.startsWith('/') ? file : pathModule.join(outputDir, file)
          const content = yield* Effect.tryPromise({
            try: () => fsModule.readFile(filePath, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to read HTML file for hydration injection: ${file}`,
                cause: error,
              }),
          })

          // Inject hydration script before </body>
          const hydrationScript = `<script src="${basePath}/assets/client.js" defer=""></script>`
          const updatedContent = content.replace('</body>', `${hydrationScript}\n</body>`)

          yield* Effect.tryPromise({
            try: () => fsModule.writeFile(filePath, updatedContent, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({
                message: `Failed to write HTML file with hydration script: ${file}`,
                cause: error,
              }),
          })
        }),
      { concurrency: 'unbounded' }
    )
  })
