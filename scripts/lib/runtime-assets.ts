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
 * - `[internal ref]` → npm `dist/` (bundled mode reads these from disk)
 *   - `scripts/build/build-binary.ts` → embedded into the standalone binary
 *
 * Dev mode builds these from `src/` at runtime instead (see static-assets.ts).
 */

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'

/**
 * The static client scripts, each with the string literals that MUST survive
 * minification.
 *
 * A sentinel is not decoration. These three files are plain IIFEs whose whole
 * contract with the page is a set of string literals — the attributes they
 * `querySelector`, the storage keys and the cookie name they write. A minifier
 * renames identifiers freely and must never touch those, so each one is asserted
 * present in the OUTPUT (see {@link minifyClientScript}). The alternative —
 * trusting that a build step which produced *some* bytes produced the *right*
 * ones — is exactly the vacuous-pass shape every check in `[internal ref]`
 * exists to refuse.
 *
 * Pick a sentinel that is load-bearing and specific: a selector, a storage key,
 * a cookie name. Never an identifier — identifiers are precisely what
 * minification is allowed to rename.
 */
const CLIENT_SCRIPTS = [
  { name: 'scroll-animation.js', sentinels: ['data-scroll-animation'] },
  {
    name: 'language-switcher.js',
    // The `querySelector` attribute, plus the localStorage key / cookie name
    // that `rememberLanguage` writes — the half of the preference that has to
    // reach the NEXT request.
    sentinels: ['data-language-switcher-config', 'sovrium_language'],
  },
  { name: 'banner-dismiss.js', sentinels: ['sovrium_banner-dismissed'] },
] as const

const EMPTY_CHUNK_PAD =
  '/* sovrium: intentionally empty split chunk — padded so the server never emits a bodiless 204 */\n'

/**
 * Minify one static client script for shipping, asserting its load-bearing
 * string literals survived.
 *
 * WHY THESE ARE MINIFIED RATHER THAN COPIED
 * -----------------------------------------
 * They used to be copied byte for byte, which made every source COMMENT part of
 * the payload that every visitor of every self-hosted instance downloads — and
 * part of the standalone binary. That is not a theoretical cost: two commits a
 * day apart, `fix(pages)` 8e08e70cba (a cookie write plus its rationale) and
 * `chore(pages)` a881ec7639 (+37 lines of pure comment), pushed the universal
 * payload through the `Performance Budget` ceiling. A prose rewrite moved a
 * shipped byte count, which is the wrong coupling to have: the sources are
 * heavily commented on purpose and should stay that way.
 *
 * Minifying here breaks that coupling at the only place it can be broken
 * without making the sources worse, and it is a large win rather than a
 * shaving: 26,864 bytes of client scripts became 6,539.
 *
 * WHY `'use strict'` IS RE-ADDED
 * ------------------------------
 * All three sources open their IIFE with `'use strict'`, and Bun's minifier
 * DROPS the directive — measured, not assumed. Silently demoting shipped code to
 * sloppy mode is a semantic change (an assignment to an undeclared name creates
 * a global instead of throwing), so the directive is restored at the top of the
 * output, where it covers the minifier's own wrapper as well. 14 bytes.
 *
 * No copyright banner is emitted, matching `client-bundle.js` next door: in this
 * repository the BSL notice lives on SOURCE files, which `bun run license`
 * maintains, and no built JavaScript artifact has ever carried one.
 *
 * @param entrypoint - Absolute path to the source script
 * @param sentinels - String literals that must be present in the output
 * @returns The minified script, prefixed with the strict-mode directive
 */
export async function minifyClientScript(
  entrypoint: string,
  sentinels: readonly string[]
): Promise<string> {
  const label = basename(entrypoint)

  // BOTH failure shapes are handled, because `Bun.build` uses both and only one
  // of them is documented by its return type. A syntax error in the source
  // THROWS an `AggregateError` whose message is the bare string "Bundle
  // failed" — no filename — rather than returning `success: false`; the
  // `success` branch below covers the returning shape. Naming the file is the
  // whole point: three scripts go through here, and a build failure that does
  // not say which one is a hunt.
  //
  // `format: 'iife'` because these are classic `<script src>` payloads, not
  // modules — the wrapper it adds around an already-IIFE body is inert.
  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: 'browser',
    format: 'iife',
    minify: true,
  }).catch((cause: unknown) => {
    throw new Error(`Client script minification failed for ${label}`, { cause })
  })
  if (!result.success) {
    const errors = result.logs.map((log) => String(log)).join('\n')
    throw new Error(`Client script minification failed for ${label}:\n${errors}`)
  }

  const artifact = result.outputs[0]
  if (artifact === undefined) {
    throw new Error(`Client script minification produced no output for ${label}`)
  }
  const code = await artifact.text()

  const missing = sentinels.filter((sentinel) => !code.includes(sentinel))
  if (missing.length > 0) {
    throw new Error(
      `Client script minification dropped load-bearing literal(s) from ${label}: ` +
        `${missing.join(', ')}. The script's contract with the page is its string ` +
        `literals; shipping it without them is a silent runtime no-op.`
    )
  }

  return `'use strict';\n${code}`
}

/**
 * Build the client/island bundles and minify the static client scripts into
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

  // 1. Minify the static client scripts (see `minifyClientScript` for why these
  //    are no longer copied verbatim).
  const clientScriptsDir = join(distDir, 'client-scripts')
  mkdirSync(clientScriptsDir, { recursive: true })
  // ASSEMBLED FROM SEGMENTS, so it holds no path-shaped literal and no literal
  // rewriter can see it — the same hazard the `Bun.build` entry point below
  // carries, arriving a second time. W6 moved `presentation/scripts/` to
  // `presentation/render/scripts/` and this line had to be edited by hand.
  //
  // That miss USED to be silent and NOT a build error: `existsSync` was false
  // for every script, the loop copied nothing, `dist/client-scripts/` was
  // created EMPTY, and the page still emitted `<script src="/assets/…">` for
  // all three — three 404s at runtime behind a green build. The `throw` below
  // closes that: there is no longer any reading of this tree under which
  // producing zero client scripts is a success.
  const clientScriptsSrc = join(srcDir, 'presentation', 'render', 'scripts', 'client')
  for (const { name, sentinels } of CLIENT_SCRIPTS) {
    const src = join(clientScriptsSrc, name)
    if (!existsSync(src)) {
      throw new Error(
        `Client script source not found: ${src}. If this tree moved, fix the ` +
          `segment-assembled path above — nothing else can see it.`
      )
    }
    writeFileSync(join(clientScriptsDir, name), await minifyClientScript(src, sentinels))
  }

  // 2. Pre-build client runtime bundle (src/presentation/islands/client.ts → client-bundle.js)
  //
  // The entry point is assembled from SEGMENTS, so it contains no path-shaped
  // literal and no literal rewriter can see it. W5a moved `client.ts` down into
  // `islands/` and this line had to be edited by hand — the comment above it
  // WAS rewritten mechanically, which is the dangerous half: prose and code
  // disagreeing reads as if the move had landed. The failure mode is silent,
  // because `Bun.build` is handed a path that does not exist and the client
  // bundle simply stops being produced.
  const clientResult = await Bun.build({
    entrypoints: [join(srcDir, 'presentation', 'islands', 'client.ts')],
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
