/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared builder for the client-side runtime assets that the server serves at
 * `/assets/*` (the client runtime loader + its split chunks, the React island
 * bundle + chunks, and the static client scripts).
 *
 * Used by both packaging flows:
 * - `[internal ref]` → npm `dist/` (bundled mode reads these from disk)
 *   - `scripts/build/build-binary.ts` → embedded into the standalone binary
 *
 * Dev mode builds these from `src/` at runtime instead (see static-assets.ts).
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { codemirrorDedupePlugin } from '@/infrastructure/assets/codemirror-dedupe-plugin'
import { THROWAWAY_RUNTIME_MANIFEST_ENV } from './throwaway-runtime-manifest'

/**
 * Why a checkout cannot produce the CANONICAL island chunk names, or `null`
 * when it can.
 *
 * Bun's code splitter orders modules by their RESOLVED path, and that order
 * decides how shared code is partitioned into chunks and which short names the
 * minifier hands out. So the same dependency bytes reached through a different
 * path produce a different, equally valid bundle, and every content-hashed chunk
 * name changes. Measured 2026-09-30 in one worktree with one install, first as a
 * real directory, then renamed and reached through a symlink: `accordion-island`
 * came out as `4yydce0a` (9305 bytes) and `18j1sawp` (9256 bytes), with different
 * identifiers and different shared chunks. No `Bun.build` option pins it.
 *
 * The committed manifest (`embedded-runtime-assets.generated.ts`) records those
 * names, and CI builds from a real `bun install`. A manifest generated anywhere
 * else is wrong for CI while looking like an ordinary regeneration, and this
 * happened: the manifest alternated between `4yydce0a`, `0vb809py` and
 * `k70h0bta` for one unchanged island across three `chore(assets)` commits.
 *
 * Two shapes are refused: `node_modules` is a symlink (the usual shortcut in a
 * git worktree), or it is missing, so resolution climbs to an ENCLOSING
 * checkout's `node_modules` (a worktree under `[internal ref]`). Packages
 * symlinked INSIDE a real `node_modules` (Bun's isolated linker) are fine: their
 * resolved paths are the same in every checkout.
 */
export function describeNonCanonicalNodeModules(root: string): string | null {
  const nodeModules = join(root, 'node_modules')
  if (!existsSync(nodeModules)) {
    return (
      `${nodeModules} does not exist, so modules resolve from an enclosing ` +
      `checkout's node_modules. Run \`bun install\` in this checkout.`
    )
  }
  if (lstatSync(nodeModules).isSymbolicLink()) {
    return (
      `${nodeModules} is a symlink to ${realpathSync(nodeModules)}. Bun names ` +
      `island chunks by resolved module path, so a symlinked install produces ` +
      `different chunk names from the real install CI uses. Replace the symlink ` +
      `with a real \`bun install\` in this checkout.`
    )
  }
  return null
}

/**
 * {@link describeNonCanonicalNodeModules}, minus the case the caller has
 * declared throwaway for exactly this `root` (`THROWAWAY_RUNTIME_MANIFEST_ENV`,
 * `./throwaway-runtime-manifest`). `null` means "proceed".
 */
export function nonCanonicalNodeModulesRefusal(
  root: string,
  env: Readonly<Record<string, string | undefined>>
): string | null {
  const reason = describeNonCanonicalNodeModules(root)
  if (reason === null) return null
  const declared = env[THROWAWAY_RUNTIME_MANIFEST_ENV]
  if (declared === undefined || declared === '' || !existsSync(declared)) return reason
  return realpathSync(declared) === realpathSync(root) ? null : reason
}

/**
 * The static client scripts, each with the string literals that MUST survive
 * minification.
 *
 * A sentinel is not decoration. These files are plain IIFEs whose whole
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
] as const

/**
 * The prebuilt page search runtime, directly under `dist/`. The same name is
 * read by `generate-embedded-runtime-assets.ts` (embedding) and by the npm
 * bundle's reader in `src/infrastructure/assets/page-search-runtime.ts`.
 */
export const PAGE_SEARCH_RUNTIME_FILE = 'page-search-runtime.js'

const EMPTY_CHUNK_PAD =
  '/* sovrium: intentionally empty split chunk — padded so the server never emits a bodiless 204 */\n'

/**
 * The client runtime's split chunks, directly under `<distDir>`. The loader
 * (`client-bundle.js`) imports them as `./client-chunks/<name>-<hash>.js`, a
 * specifier Bun computes from this `naming.chunk` template, so the directory
 * name is part of the shipped bytes and not only of the layout. Read by
 * `generate-embedded-runtime-assets.ts` (embedding, keyed by file name without
 * this prefix) and by `Performance Budget` (the universal payload).
 */
export const CLIENT_CHUNKS_DIR = 'client-chunks'

/**
 * The basename prefix of the one chunk every page runs. The server resolves the
 * loader's `core` feature by this name, so a rename on the `src/` side has to
 * fail the build here rather than ship a manifest the server cannot read.
 */
export const CLIENT_CORE_RUNTIME_CHUNK_PREFIX = 'client-core-runtime-'

/**
 * Pad every zero-byte `.js` in `dir`, then refuse if any is still empty.
 *
 * splitting+minify can reduce a shared facade chunk to 0 bytes while the bare
 * side-effect import of it survives in the entry; a Response over a zero-length
 * `Bun.file` collapses to 204 No Content, the browser rejects the module, and
 * nothing that imports it runs. Both split builds (islands and the client
 * runtime) go through here so the two cannot drift apart.
 *
 * @param dir - The split build's chunk directory
 * @param label - Names the build in the error
 */
export function padEmptyChunks(dir: string, label: string): void {
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const chunkPath = join(dir, name)
    if (statSync(chunkPath).size === 0) writeFileSync(chunkPath, EMPTY_CHUNK_PAD)
  }
  const stillEmpty = readdirSync(dir).filter(
    (name) => name.endsWith('.js') && statSync(join(dir, name)).size === 0
  )
  if (stillEmpty.length > 0) {
    throw new Error(`${label} produced zero-byte chunks after padding: ${stillEmpty.join(', ')}`)
  }
}

/**
 * Refuse a client runtime build that did not emit exactly one
 * `client-core-runtime-<hash>.js` chunk.
 *
 * Zero means the loader's `core` split point was renamed or inlined, and the
 * server, which finds the chunk by this basename, would serve a loader whose
 * only feature it cannot locate. Two means a stale file survived beside the
 * fresh one (step 0 removes the directory, so that is a builder bug) and the
 * server's choice between them would be arbitrary.
 *
 * @param chunkNames - The `.js` file names in `<distDir>/client-chunks/`
 */
export function assertSingleCoreRuntimeChunk(chunkNames: readonly string[]): void {
  const core = chunkNames.filter(
    (name) => name.startsWith(CLIENT_CORE_RUNTIME_CHUNK_PREFIX) && name.endsWith('.js')
  )
  if (core.length !== 1) {
    throw new Error(
      `Client runtime build emitted ${core.length} \`${CLIENT_CHUNKS_DIR}/` +
        `${CLIENT_CORE_RUNTIME_CHUNK_PREFIX}*.js\` chunk(s), expected exactly 1` +
        (core.length > 0 ? ` (${core.join(', ')})` : '') +
        `. The server resolves the loader's \`core\` feature by that basename: if ` +
        `\`src/presentation/islands/runtime/client-core-runtime.ts\` was renamed, ` +
        `rename the prefix here and on the server side together.`
    )
  }
}

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
 * Every source opens its IIFE with `'use strict'`, and Bun's minifier
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
  // whole point: several scripts go through here, and a build failure that does
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
 *   - `<distDir>/client-bundle.js` (the client runtime LOADER, ~1.4 KB)
 *   - `<distDir>/client-chunks/*.js` (its split features; today exactly one,
 *     `client-core-runtime-<hash>.js`)
 *   - `<distDir>/client-scripts/*.js`
 *   - `<distDir>/island-chunks/island-entry.js` + code-split chunks
 *   - `<distDir>/page-search-runtime.js` (the page search `runtime.js`)
 */
export async function buildRuntimeAssets(distDir: string, srcDir: string): Promise<void> {
  // 0. Clear THIS builder's output surfaces before writing them.
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
  //    paths below hold exactly what THIS run produced, whoever called it. The
  //    client runtime's chunks are content-hashed too, so `client-chunks/` is
  //    cleared for the same reason as `island-chunks/`.
  //
  //    Scoped to the outputs by name, never `distDir` itself — the npm
  //    flow bundles `dist/index.js` and `dist/cli.js` alongside these, and a
  //    wholesale wipe here would delete a sibling step's work.
  rmSync(join(distDir, 'island-chunks'), { recursive: true, force: true })
  rmSync(join(distDir, 'client-scripts'), { recursive: true, force: true })
  rmSync(join(distDir, 'client-bundle.js'), { force: true })
  rmSync(join(distDir, CLIENT_CHUNKS_DIR), { recursive: true, force: true })
  rmSync(join(distDir, PAGE_SEARCH_RUNTIME_FILE), { force: true })

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

  // 2. Pre-build the client runtime as a split build: the LOADER
  //    (`src/presentation/islands/client.ts` → `client-bundle.js`) plus one chunk
  //    per feature it `import()`s, under `client-chunks/`. The loader is the
  //    whole of what every page fetches up front; `core` is the one feature
  //    today, and the page modulepreloads it.
  //
  // The entry point is assembled from SEGMENTS, so it contains no path-shaped
  // literal and no literal rewriter can see it. W5a moved `client.ts` down into
  // `islands/` and this line had to be edited by hand — the comment above it
  // WAS rewritten mechanically, which is the dangerous half: prose and code
  // disagreeing reads as if the move had landed. The failure mode is silent,
  // because `Bun.build` is handed a path that does not exist and the client
  // bundle simply stops being produced.
  //
  // `outdir` is `distDir` itself and the chunk template carries the
  // subdirectory, so the loader's import specifiers are
  // `./client-chunks/<name>-<hash>.js`, relative to wherever the loader is
  // served from (its stable and its hashed name sit side by side).
  const clientResult = await Bun.build({
    entrypoints: [join(srcDir, 'presentation', 'islands', 'client.ts')],
    outdir: distDir,
    target: 'browser',
    format: 'esm',
    splitting: true,
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    naming: { entry: 'client-bundle.js', chunk: `${CLIENT_CHUNKS_DIR}/[name]-[hash].js` },
  })
  if (!clientResult.success) {
    const errors = clientResult.logs.map((l) => String(l)).join('\n')
    throw new Error(`Client bundle build failed:\n${errors}`)
  }
  const clientChunksDir = join(distDir, CLIENT_CHUNKS_DIR)
  if (!existsSync(clientChunksDir)) {
    throw new Error(
      `Client runtime build emitted no ${CLIENT_CHUNKS_DIR}/ directory: the loader's ` +
        `split points were inlined, so the server has no chunk to serve for \`core\`.`
    )
  }
  padEmptyChunks(clientChunksDir, 'Client runtime build')
  assertSingleCoreRuntimeChunk(readdirSync(clientChunksDir))

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

  // 4. Pad zero-byte split chunks (see `padEmptyChunks`): a zero-byte chunk
  //    whose bare import survives in island-entry.js is served as a 204, the
  //    browser rejects the module, and no island hydrates.
  padEmptyChunks(islandOutDir, 'Island build')

  // 5. Pre-build the page search runtime (`/sovrium-search/runtime.js`).
  //
  //    It is written next to the search index at `start` and at `build` of any
  //    site with a page-scoped search box. It used to be compiled from
  //    `src/presentation/islands/page-search/runtime-entry.ts` at RUN time,
  //    from a path resolved against the package root — which, in the compiled
  //    binary, is the folder the executable sits in. Nothing sits beside an
  //    installed binary, so `start` logged "Search index not built" and 404'd
  //    the runtime, and `build` failed outright. Building it here, with the
  //    other client payloads, lets the binary embed it.
  //
  //    Kept OUT of `client-scripts/`: those are the universal payload every
  //    page loads (and `Performance Budget` weighs them as such); this one is
  //    fetched only by sites that declare a page search box.
  const searchResult = await Bun.build({
    entrypoints: [join(srcDir, 'presentation', 'islands', 'page-search', 'runtime-entry.ts')],
    target: 'browser',
    format: 'iife',
    minify: true,
  })
  if (!searchResult.success) {
    const errors = searchResult.logs.map((l) => String(l)).join('\n')
    throw new Error(`Page search runtime build failed:\n${errors}`)
  }
  const searchArtifact = searchResult.outputs[0]
  const searchCode = searchArtifact === undefined ? '' : await searchArtifact.text()
  if (!searchCode.includes('SovriumSearch')) {
    throw new Error(
      'Page search runtime build produced no `window.SovriumSearch` global; the ' +
        'page search box would load a script that does nothing.'
    )
  }
  writeFileSync(join(distDir, PAGE_SEARCH_RUNTIME_FILE), searchCode)
}
