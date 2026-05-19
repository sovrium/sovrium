/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Effect } from 'effect'
import type { Hono } from 'hono'

export interface SSGOptions {
  readonly outputDir?: string
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
  readonly pagePaths?: readonly string[]
  readonly publicDir?: string
}

export interface SSGResult {
  readonly outputDir: string
  readonly files: readonly string[]
}

export interface SSGGenerationError {
  readonly _tag: 'SSGGenerationError'
  readonly message: string
  readonly cause?: unknown
}

export class StaticSiteGenerator extends Context.Tag('StaticSiteGenerator')<
  StaticSiteGenerator,
  {
    readonly generate: (
      app: Hono | Readonly<Hono>,
      options: Readonly<SSGOptions>
    ) => Effect.Effect<SSGResult, SSGGenerationError>
  }
>() {}
