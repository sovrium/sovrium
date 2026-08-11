/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared builder for the client-side runtime assets that the server serves at
 * `/assets/*` (the client bundle, the React island bundle + chunks, and the
 * static client scripts).
 *
 * Used by both packaging flows:
 *   - `scripts/build.ts`        → npm `dist/` (bundled mode reads these from disk)
 *   - `scripts/build/build-binary.ts` → embedded into the standalone binary
 *
 * Dev mode builds these from `src/` at runtime instead (see static-assets.ts).
 */

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'

const CLIENT_SCRIPTS = ['scroll-animation.js', 'language-switcher.js', 'banner-dismiss.js'] as const

const EMPTY_CHUNK_PAD =
  '/* sovrium: intentionally empty split chunk — padded so the server never emits a bodiless 204 */\n'

/**
 * Build the client/island bundles and copy the static client scripts into
 * `<distDir>`, producing:
 *   - `<distDir>/client-bundle.js`
 *   - `<distDir>/client-scripts/*.js`
 *   - `<distDir>/island-chunks/island-entry.js` + code-split chunks
 */
export async function buildRuntimeAssets(distDir: string, srcDir: string): Promise<void> {
  // 0. Clear THIS builder's three output surfaces before writing them.
  //
  //    Island chunk names are content-hashed (`[name]-[hash].js`), so editing an
  //    island emits a NEW file and leaves the previous one behind. Nothing ever
  //    deleted it: `dist/island-chunks/` grew monotonically across every local
  //    build until it held 681 chunks where a clean build emits 118, and
  //    `generate-embedded-runtime-assets.ts` faithfully embedded all 681 into
  //    the binary — 145.3 MB instead of 127.8 MB of which ~83% was orphaned
  //    chunks no `island-entry.js` import could ever reach (see the manual
  //    `rm -rf dist` in `chore(build): regenerate the embedded asset manifest
  //    from a clean dist`).
  //
  //    The npm flow (`scripts/build/build.ts`) already wipes `dist/` wholesale
  //    before calling us; the binary flow (`build-binary.ts`) does not, and a
  //    developer's `dist/` survives indefinitely between builds. Cleaning here
  //    rather than in either caller makes the invariant the builder's own: the
  //    three paths below hold exactly what THIS run produced, whoever called it.
  //
  //    Scoped to the three outputs by name, never `distDir` itself — the npm
  //    flow bundles `dist/index.js` and `dist/cli.js` alongside these, and a
  //    wholesale wipe here would delete a sibling step's work.
  rmSync(join(distDir, 'island-chunks'), { recursive: true, force: true })
  rmSync(join(distDir, 'client-scripts'), { recursive: true, force: true })
  rmSync(join(distDir, 'client-bundle.js'), { force: true })

  // 1. Copy static client scripts
  const clientScriptsDir = join(distDir, 'client-scripts')
  mkdirSync(clientScriptsDir, { recursive: true })
  const clientScriptsSrc = join(srcDir, 'presentation', 'scripts', 'client')
  for (const script of CLIENT_SCRIPTS) {
    const src = join(clientScriptsSrc, script)
    if (existsSync(src)) {
      copyFileSync(src, join(clientScriptsDir, script))
    }
  }

  // 2. Pre-build client runtime bundle (src/presentation/client.ts → client-bundle.js)
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

  // 3. Pre-build island entry bundle with code splitting
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
    // Force a single @codemirror/@lezer instance across the island bundle;
    // duplicate copies otherwise crash the CodeMirror editor on mount.
    plugins: [codemirrorDedupePlugin],
    naming: { entry: 'island-entry.js', chunk: '[name]-[hash].js' },
  })
  if (!islandResult.success) {
    const errors = islandResult.logs.map((l) => String(l)).join('\n')
    throw new Error(`Island bundle build failed:\n${errors}`)
  }

  // 4. Pad zero-byte split chunks. splitting+minify can reduce shared facade
  //    chunks to 0 bytes while their bare side-effect imports survive in
  //    island-entry.js; a Response over a zero-length Bun.file collapses to
  //    204 No Content, the browser rejects the module, and no island hydrates.
  for (const name of readdirSync(islandOutDir).filter((f) => f.endsWith('.js'))) {
    const chunkPath = join(islandOutDir, name)
    if (statSync(chunkPath).size === 0) writeFileSync(chunkPath, EMPTY_CHUNK_PAD)
  }
  const stillEmpty = readdirSync(islandOutDir).filter(
    (name) => name.endsWith('.js') && statSync(join(islandOutDir, name)).size === 0
  )
  if (stillEmpty.length > 0) {
    throw new Error(
      `Island build produced zero-byte chunks after padding: ${stillEmpty.join(', ')}`
    )
  }
}
