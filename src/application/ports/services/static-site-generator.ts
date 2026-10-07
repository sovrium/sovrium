/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'
import type { Hono } from 'hono'

/**
 * Options for static site generation
 */
export interface SSGOptions {
  readonly outputDir?: string
  readonly baseUrl?: string
  readonly basePath?: string
  readonly deployment?: 'github-pages' | 'generic'
  readonly languages?: readonly string[]
  readonly defaultLanguage?: string
  readonly generateSitemap?: boolean
  readonly generateRobotsTxt?: boolean
  readonly bundleOptimization?: 'split' | 'none'
  readonly pagePaths?: readonly string[]
  readonly publicDir?: string
}

/**
 * Result of static site generation
 */
export interface SSGResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

/**
 * SSG generation error
 */
export interface SSGGenerationError {
  readonly _tag: 'SSGGenerationError'
  readonly message: string
  readonly cause?: unknown
}

/**
 * Static Site Generator port for generating static HTML files
 *
 * This interface defines the contract for static site generation,
 * allowing the Application layer to remain decoupled from
 * Infrastructure implementations (Hono SSG, file system, etc.).
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const ssg = yield* StaticSiteGenerator
 *   const result = yield* ssg.generate(honoApp, {
 *     outputDir: './static',
 *     pagePaths: ['/', '/about'],
 *   })
 *   console.log(`Generated ${result.files.length} files`)
 * })
 * ```
 */
export class StaticSiteGenerator extends Context.Service<
  StaticSiteGenerator,
  {
    /**
     * Generates static HTML files from a Hono application
     *
     * @param app - Hono application instance
     * @param options - Static generation options
     * @returns Effect that yields SSG result or generation error
     */
    readonly generate: (
      app: Hono | Readonly<Hono>,
      options: Readonly<SSGOptions>
    ) => Effect.Effect<SSGResult, SSGGenerationError>

    /**
     * The page search runtime written beside the search index as
     * `sovrium-search/runtime.js`. In the compiled binary it is the copy
     * embedded at compile time, since no source sits beside an installed
     * executable.
     */
    readonly readPageSearchRuntime: Effect.Effect<string, SSGGenerationError>
    /**
     * Copy a directory tree (the app's `public/` assets) into the output, and
     * answer the files written.
     */
    readonly copyDirectory: (
      source: string,
      destination: string
    ) => Effect.Effect<readonly string[], SSGGenerationError>
  }
>()('StaticSiteGenerator') {}
