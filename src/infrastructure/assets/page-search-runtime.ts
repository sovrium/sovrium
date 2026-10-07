/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { getRuntimeAssets } from '@/infrastructure/assets/embedded-runtime-assets'
import { isBundled, isCompiled, resolvePackagePath } from '@/infrastructure/process/package-paths'
import { memoizeUnlessDev } from './client-entries'
import type { SSGGenerationError } from '@/application/ports/services/static-site-generator'

/**
 * The page search runtime — the script written to `sovrium-search/runtime.js`
 * beside the search index, which exposes `window.SovriumSearch` to the page.
 *
 * Read from wherever this process has it, like the other client payloads:
 *
 *   - **compiled binary**: the copy embedded at compile time
 *     (`RUNTIME_ASSETS.pageSearchRuntime`). Nothing sits beside an installed
 *     executable, so there is no source to compile from.
 *   - **npm bundle**: the prebuilt `dist/page-search-runtime.js`.
 *   - **source checkout**: compiled on the fly from
 *     `src/presentation/islands/page-search/runtime-entry.ts`, so an edit to
 *     the matcher shows up without rebuilding `dist/`.
 *
 * The prebuilt copy comes from `[internal ref]`.
 */
const readPageSearchRuntimeText = memoizeUnlessDev(async (): Promise<string> => {
  if (isCompiled) {
    const assets = await getRuntimeAssets()
    return Bun.file(assets.pageSearchRuntime).text()
  }

  if (isBundled) {
    return Bun.file(resolvePackagePath('dist', 'page-search-runtime.js')).text()
  }

  const result = await Bun.build({
    entrypoints: [
      resolvePackagePath('src', 'presentation', 'islands', 'page-search', 'runtime-entry.ts'),
    ],
    target: 'browser',
    format: 'iife',
    minify: false,
  })
  if (!result.success) {
    const errors = result.logs.map((log) => log.message).join('\n')
    throw new Error(`runtime.js build failed:\n${errors}`)
  }
  const output = result.outputs[0]
  if (!output) {
    throw new Error('runtime.js build produced no output')
  }
  return output.text()
})

/** {@link readPageSearchRuntimeText} as the `StaticSiteGenerator` port method. */
export const readPageSearchRuntime: Effect.Effect<string, SSGGenerationError> = Effect.tryPromise({
  try: readPageSearchRuntimeText,
  catch: (cause): SSGGenerationError => ({
    _tag: 'SSGGenerationError',
    message: 'Failed to read the page search runtime (sovrium-search/runtime.js)',
    cause,
  }),
}).pipe(Effect.withSpan('assets.read-page-search-runtime'))
