/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import type { FileSystemLike, PathModuleLike } from './generate-static-helpers'

export const isGitHubPagesUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url)
    return hostname === 'github.io' || hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

export const rewriteUrlsWithBasePath = (
  html: string,
  basePath: string,
  baseUrl?: string,
  pagePath?: string
): string => {
  const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath

  const basePathWithoutLang = normalizedBasePath.replace(/\/[a-z]{2}$/, '')

  const hrefRewritten = html.replace(
    /(hrefLang|hreflang)="([^"]*)"[^>]*href="(\/[^"]*)"/g,
    (_match, _hreflangAttr, langCode, url) => {
      const normalizedAttr = 'hreflang'
      const shortCode = langCode.split('-')[0]
      const fullUrl = baseUrl ? `${baseUrl}${url}` : `${basePathWithoutLang}${url}`
      return `${normalizedAttr}="${shortCode}" href="${fullUrl}"`
    }
  )

  const allHrefRewritten = hrefRewritten.replace(
    /(?<!hreflang=")href="(\/[^"]*)"/g,
    (_match, url) => {
      if (url.startsWith('/assets/')) {
        return `href="${basePathWithoutLang}${url}"`
      }
      return `href="${normalizedBasePath}${url}"`
    }
  )

  const srcRewritten = allHrefRewritten.replace(/src="(\/[^"]*)"/g, (_match, url) => {
    if (url.startsWith('/assets/')) {
      return `src="${basePathWithoutLang}${url}"`
    }
    return `src="${normalizedBasePath}${url}"`
  })

  if (baseUrl && pagePath && !srcRewritten.includes('rel="canonical"')) {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const canonicalPath = pagePath === '/' ? '/' : pagePath
    const canonicalUrl = `${normalizedBaseUrl}${canonicalPath}`

    return srcRewritten.replace('</head>', `<link rel="canonical" href="${canonicalUrl}"></head>`)
  }

  return srcRewritten
}

export const rewriteBasePathInHtml = (
  generatedFiles: readonly string[],
  outputDir: string,
  basePath: string,
  baseUrl: string | undefined,
  fsModule: FileSystemLike
): Effect.Effect<void, StaticGenerationError, never> =>
  Effect.gen(function* () {
    yield* Console.log(`🔗 Rewriting URLs with base path: ${basePath}...`)
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

          const relativeFile = file.startsWith(outputDir) ? file.slice(outputDir.length + 1) : file

          const langMatch = relativeFile.match(/^([a-z]{2})\//)
          const langPrefix = langMatch ? `/${langMatch[1]}` : ''

          const fileWithoutLang = langPrefix ? relativeFile.slice(3) : relativeFile
          const basePagePath =
            fileWithoutLang === 'index.html' ? '/' : `/${fileWithoutLang.replace('.html', '')}`

          const fullBasePath = `${basePath}${langPrefix}`

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

export const injectHydrationScript = (
  generatedFiles: readonly string[],
  outputDir: string,
  basePath: string,
  fsModule: FileSystemLike,
  pathModule: PathModuleLike
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
