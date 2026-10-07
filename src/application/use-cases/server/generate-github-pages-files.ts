/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { logDebug } from '@/infrastructure/logging'
import { isGitHubPagesUrl } from './static-url-rewriter'
import type { GenerateStaticOptions } from './generate-static'
import type { FileSystemLike } from './generate-static-helpers'

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
  }).pipe(Effect.withSpan('server.generate-git-hub-pages-files', { attributes: { outputDir } }))
}
