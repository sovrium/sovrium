/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const CLIENT_SCRIPTS = ['scroll-animation.js', 'language-switcher.js', 'banner-dismiss.js'] as const

export async function buildRuntimeAssets(distDir: string, srcDir: string): Promise<void> {
  const clientScriptsDir = join(distDir, 'client-scripts')
  mkdirSync(clientScriptsDir, { recursive: true })
  const clientScriptsSrc = join(srcDir, 'presentation', 'scripts', 'client')
  for (const script of CLIENT_SCRIPTS) {
    const src = join(clientScriptsSrc, script)
    if (existsSync(src)) {
      copyFileSync(src, join(clientScriptsDir, script))
    }
  }

  const clientResult = await Bun.build({
    entrypoints: [join(srcDir, 'presentation', 'client.ts')],
    outdir: distDir,
    target: 'browser',
    format: 'esm',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    naming: { entry: 'client-bundle.js' },
  })
  if (!clientResult.success) {
    const errors = clientResult.logs.map((l) => String(l)).join('\n')
    throw new Error(`Client bundle build failed:\n${errors}`)
  }

  const islandOutDir = join(distDir, 'island-chunks')
  mkdirSync(islandOutDir, { recursive: true })
  const islandResult = await Bun.build({
    entrypoints: [join(srcDir, 'presentation', 'islands', 'island-client.tsx')],
    outdir: islandOutDir,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    naming: { entry: 'island-entry.js', chunk: '[name]-[hash].js' },
  })
  if (!islandResult.success) {
    const errors = islandResult.logs.map((l) => String(l)).join('\n')
    throw new Error(`Island bundle build failed:\n${errors}`)
  }
}
