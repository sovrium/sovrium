/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: embed the pre-built client/island/script runtime assets into the
 * compiled binary.
 *
 * Run AFTER `scripts/build/build-runtime-assets.ts` has produced `dist/` and BEFORE
 * `bun build --compile`. Emits `src/infrastructure/assets/embedded-runtime-assets.generated.ts`,
 * whose `with { type: 'file' }` imports embed each dist asset into the binary;
 * `static-assets.ts` serves them via `Bun.file()` in compiled mode.
 *
 * The generated file is committed (so tsc/eslint and the guarded dynamic import
 * resolve in dev/CI without a build); its `../../../dist/...` imports are
 * `@ts-nocheck`-suppressed and never evaluated in dev (compiled-mode only).
 * Bun content-hashes chunk names, so regeneration is a no-op unless an island
 * actually changes.
 */

import { existsSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { listDirSync, walkSync } from '../lib/drift/walk'
import { fileImportSpecifier, posixRelative } from '../lib/posix-path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DIST_DIR = join(PROJECT_ROOT, 'dist')
const ISLAND_DIR = join(DIST_DIR, 'island-chunks')
const CLIENT_SCRIPTS_DIR = join(DIST_DIR, 'client-scripts')
const OUT_FILE = join(
  PROJECT_ROOT,
  'src',
  'infrastructure',
  'assets',
  'embedded-runtime-assets.generated.ts'
)
const REL_ROOT = '../../..'

if (!existsSync(join(DIST_DIR, 'client-bundle.js'))) {
  printStderr('dist/client-bundle.js not found — run scripts/build/build-runtime-assets.ts first')
  process.exit(1)
}

interface ImportLine {
  readonly varName: string
  readonly importPath: string
}
const imports: ImportLine[] = []
let counter = 0
/** Add a `type: 'file'` import for a dist-relative path, return its var name. */
const addImport = (distRelPath: string): string => {
  const varName = `_r${counter++}`
  imports.push({ varName, importPath: fileImportSpecifier(REL_ROOT, 'dist', distRelPath) })
  return varName
}

// Recursively list files under a dir, returned as POSIX paths relative to that
// dir. POSIX and not the platform separator because these strings are BOTH the
// manifest keys and the tail of a `with { type: 'file' }` specifier — see
// `[internal ref]` for what a Windows backslash does to the latter.
const listFiles = (dir: string, base = dir): readonly string[] =>
  walkSync({ root: dir }).map((abs) => posixRelative(base, abs))

const clientBundleVar = addImport('client-bundle.js')

const clientScriptEntries = existsSync(CLIENT_SCRIPTS_DIR)
  ? listDirSync({ root: CLIENT_SCRIPTS_DIR, extensions: ['.js'] })
      .map((abs) => basename(abs))
      .toSorted()
      .map((f) => `    ${JSON.stringify(f)}: ${addImport(`client-scripts/${f}`)},`)
  : []

const islandEntries = existsSync(ISLAND_DIR)
  ? listFiles(ISLAND_DIR)
      .toSorted()
      .map((rel) => `    ${JSON.stringify(rel)}: ${addImport(`island-chunks/${rel}`)},`)
  : []

// Refuse to embed zero-byte assets: served through Bun.file() they collapse to
// a bodiless 204 that browsers reject as an ES module, killing hydration.
const emptyAssets = imports
  .map((i) => i.importPath.replace(`${REL_ROOT}/`, ''))
  .filter((rel) => statSync(join(PROJECT_ROOT, rel)).size === 0)
if (emptyAssets.length > 0) {
  printStderr(`refusing to embed zero-byte asset(s): ${emptyAssets.join(', ')}`)
  process.exit(1)
}

// Refuse to embed a `dist/` older than the island sources it claims to be built
// from.
//
// This manifest is a list of PATHS, and `check-generated-assets-drift.ts` detects
// drift by byte-comparing a regeneration of it against the committed copy. That
// makes a CONTENT change visible only when it moves a path. It does for the
// `[name]-[hash].js` split chunks; it does not for the five fixed-name assets —
// `client-bundle.js`, the three `client-scripts/*.js`, and `island-entry.js` —
// whose bytes can change under an identical manifest. And it never sees a stale
// `dist/` at all: the check regenerates the MANIFEST from `dist/`, never `dist/`
// from `src/`, so a `dist/` and a manifest that are stale together read as clean.
//
// Comparing mtimes is what closes that: `dist/` is written by
// `[internal ref]` immediately before this script runs, so
// in the binary/npm flows every asset is newer than every source and this cannot
// fire. It fires only when this script meets a `dist/` it did not just produce.
//
// Scoped to the two trees that exist SOLELY to be bundled client-side. The real
// dependency set is `client.ts`'s transitive graph, which reaches most of
// `src/presentation/` and parts of `src/domain/` — keying on that would turn any
// server-side edit into a red gate for every developer who happens to have a
// `dist/` lying around. This narrower scope trades those misses for zero false
// alarms, and it covers the case that motivates the guard: an island edited
// without rebuilding the bundle that carries it.
const BUNDLE_ONLY_SOURCE_DIRS = [
  join(PROJECT_ROOT, 'src', 'presentation', 'islands'),
  // `'src','presentation','scripts','client'` until W8. W6 moved that tree to
  // `presentation/render/scripts/`, and this entry was the half of the move that
  // nothing caught: the path is assembled from SEGMENTS, so no import resolves
  // it, no literal sweep matches it, and a grep for the directory finds nothing.
  //
  // The miss was SILENT by construction, because the list is filtered by
  // `existsSync` two lines down — a dead entry is dropped rather than reported,
  // so the staleness guard simply stopped watching the three static client
  // scripts and the build stayed green. Editing `banner-dismiss.js` without
  // rebuilding the bundle would not have been caught, which is the one case the
  // guard exists for.
  //
  // `[internal ref]` carries the SAME path with the CORRECT
  // spelling and a docblock about this exact hazard, and that is the part worth
  // noticing: one of the two sites was repaired by hand during W6 and the other
  // was not, because nothing can enumerate them.
  join(PROJECT_ROOT, 'src', 'presentation', 'render', 'scripts', 'client'),
]
const isBundledSource = (name: string): boolean => !name.includes('.test.') && !name.endsWith('.md')

const newestSourceMtime = BUNDLE_ONLY_SOURCE_DIRS.filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    listFiles(dir)
      .filter(isBundledSource)
      .map((rel) => join(dir, rel))
  )
  .reduce((newest, abs) => Math.max(newest, statSync(abs).mtimeMs), 0)

const stalest = imports
  .map((i) => i.importPath.replace(`${REL_ROOT}/`, ''))
  .map((rel) => ({ rel, mtimeMs: statSync(join(PROJECT_ROOT, rel)).mtimeMs }))
  .reduce<{ rel: string; mtimeMs: number } | null>(
    (oldest, a) => (oldest === null || a.mtimeMs < oldest.mtimeMs ? a : oldest),
    null
  )

if (stalest !== null && stalest.mtimeMs < newestSourceMtime) {
  printStderr(
    `dist/ is older than the island sources it would be embedded from:\n` +
      `    dist/${stalest.rel} last written ${new Date(stalest.mtimeMs).toISOString()}\n` +
      `    newest bundled source           ${new Date(newestSourceMtime).toISOString()}\n` +
      `  Embedding it would ship a client bundle that predates its own source.\n` +
      `  Rebuild first: bun run scripts/build/build-runtime-assets.ts`
  )
  process.exit(1)
}

const header = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable */
// @ts-nocheck
// AUTO-GENERATED by scripts/build/generate-embedded-runtime-assets.ts — DO NOT EDIT.
// Embeds the pre-built dist/ runtime assets into the compiled binary. The
// dist/ imports below resolve only at binary/npm build time and are never
// evaluated in dev (static-assets.ts uses runtime Bun.build in dev).
`

const importBlock = imports
  .map((i) => `import ${i.varName} from '${i.importPath}' with { type: 'file' }`)
  .join('\n')

const body = `
/** Pre-built client/island/script assets, keyed by served filename. */
export const RUNTIME_ASSETS = {
  clientBundle: ${clientBundleVar},
  clientScripts: {
${clientScriptEntries.join('\n')}
  },
  islands: {
${islandEntries.join('\n')}
  },
}
`

Bun.write(OUT_FILE, `${header}\n${importBlock}\n${body}`)
console.log(
  `embedded-runtime-assets.generated.ts — ${imports.length} files ` +
    `(1 client bundle, ${clientScriptEntries.length} scripts, ${islandEntries.length} island files)`
)
