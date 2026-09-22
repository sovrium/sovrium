/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * TypeScript Config Graph - Infrastructure Layer
 *
 * A `.ts` config is a module graph: `app.ts` imports `./config/pages`, which
 * imports `./config/copy/hero`, and so on (the shape every shipped app under
 * `apps/` uses). Two things about that graph are needed at runtime and neither
 * is reachable through a plain `import()`:
 *
 * 1. **The file set** — which files the graph is made of, so `--watch` can
 *    watch each of them. Bun does not expose its module registry.
 * 2. **A FRESH evaluation** — Bun's ESM registry caches every module for the
 *    life of the process. A second `import(path)` returns the module evaluated
 *    at boot, and `import(path + '?t=' + Date.now())` re-evaluates the ROOT
 *    only while its nested imports stay cached. Either way a reload serves the
 *    old config.
 *
 * `Bun.build` answers both: bundling the root with an `onLoad` plugin yields
 * the exact set of files the bundler read, and importing the emitted bundle
 * from a fresh temp path evaluates the WHOLE graph again. `Bun.build` is part
 * of the runtime the compiled binary embeds, so this path works there too —
 * the entrypoint is the operator's own file on disk, not something the binary
 * would have to ship.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AppEncoded } from '@/domain/models/app'

/**
 * A `.ts` config module graph: the default export of the root, plus the
 * absolute path of every file the graph is made of (root included, third-party
 * packages excluded).
 */
export interface TsConfigGraph {
  readonly config: AppEncoded
  readonly files: ReadonlyArray<string>
}

interface BundledTsConfig {
  readonly code: string
  readonly files: ReadonlyArray<string>
}

/**
 * Bare specifiers left unbundled. `sovrium` is the ambient types module a
 * typed config imports (`import type { AppConfig } from 'sovrium'`) — erased
 * at transpile time, so it never reaches the emitted bundle, but a runtime
 * import of it must not be looked up in `node_modules` either.
 */
const EXTERNAL_PACKAGES: ReadonlyArray<string> = ['sovrium']

const isThirdPartyPath = (path: string): boolean => path.includes('/node_modules/')

/**
 * Bundle the config graph rooted at `absolutePath`, recording every file the
 * bundler loads. Third-party packages are bundled INTO the output (so the
 * emitted module is self-contained wherever it is written) but excluded from
 * the reported file set — they are not the operator's config.
 */
const bundleTsConfig = async (absolutePath: string): Promise<BundledTsConfig> => {
  const loaded = new Set<string>()
  const result = await Bun.build({
    entrypoints: [absolutePath],
    target: 'bun',
    format: 'esm',
    external: [...EXTERNAL_PACKAGES],
    plugins: [
      {
        name: 'sovrium-config-graph',
        setup(build) {
          // eslint-disable-next-line functional/no-expression-statements -- plugin hook registration
          build.onLoad({ filter: /.*/ }, (args) => {
            // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- the recorder IS the plugin's purpose
            loaded.add(args.path)
            // Returning nothing hands the file to Bun's default loader.
            return undefined
          })
        },
      },
    ],
  })

  if (!result.success) {
    const messages = result.logs.map((log) => log.message).join('\n')
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Failed to load TypeScript config ${absolutePath}:\n${messages}`)
  }

  const output = result.outputs[0]
  if (!output) {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(`Failed to load TypeScript config ${absolutePath}: the bundle is empty`)
  }

  return {
    code: await output.text(),
    files: [...loaded].filter((path) => !isThirdPartyPath(path)),
  }
}

/**
 * Validate the shape every `.ts` config must have: a default export that is an
 * object. Shared with the plain-import loader so both paths refuse with the
 * same words.
 */
export const requireDefaultExportObject = (module: { readonly default?: unknown }): AppEncoded => {
  const config = module.default
  if (!config || typeof config !== 'object') {
    // eslint-disable-next-line functional/no-throw-statements -- infrastructure layer needs imperative error propagation
    throw new Error(
      `TypeScript config file must have a default export.\n` +
        `Expected: export default { name: "my-app", ... }\n` +
        `Got: ${typeof config}`
    )
  }
  return config as AppEncoded
}

/**
 * The files a `.ts` config graph is made of, without evaluating it.
 */
export const scanTsConfigGraph = async (filePath: string): Promise<ReadonlyArray<string>> =>
  (await bundleTsConfig(resolve(filePath))).files

/**
 * Evaluate a `.ts` config graph FRESH — every module re-run from its current
 * source — and report the files it is made of.
 *
 * The bundle is written to a temp path that is new on every call, which is
 * what defeats the ESM registry: a path never imported before has no cached
 * module. The temp directory is removed once the import has evaluated; the
 * module itself stays registered (a few kilobytes per reload), which is the
 * price of a registry that cannot be evicted.
 */
export const loadTsConfigGraph = async (filePath: string): Promise<TsConfigGraph> => {
  const absolutePath = resolve(filePath)
  const bundled = await bundleTsConfig(absolutePath)

  const tempDir = await mkdtemp(join(tmpdir(), 'sovrium-config-'))
  try {
    const bundlePath = join(tempDir, 'app.mjs')
    await writeFile(bundlePath, bundled.code, 'utf-8')
    const module = (await import(bundlePath)) as { readonly default?: unknown }
    return { config: requireDefaultExportObject(module), files: bundled.files }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
