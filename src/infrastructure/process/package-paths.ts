/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve, basename, dirname } from 'node:path'

/**
 * Whether we're running inside a `bun build --compile` standalone binary.
 *
 * In compiled mode, import.meta.dir points into Bun's virtual filesystem
 * (/$bunfs/root/...) where only bundled JS modules exist — no templates/,
 * agents/, or package.json on disk.
 */
export const isCompiled = import.meta.dir.startsWith('/$bunfs/')

/**
 * Whether we're running from the bundled dist/ output (npm package)
 * vs the original source tree (development).
 *
 * When bundled by Bun.build, all source files are inlined into dist/cli.js
 * or dist/index.js. import.meta.dir then points to the dist/ directory,
 * so we only need to go 1 level up to reach the package root.
 *
 * In development, this file lives at src/infrastructure/process/package-paths.ts
 * (3 levels deep), so we go 3 levels up.
 */
export const isBundled = !isCompiled && basename(import.meta.dir) === 'dist'

/**
 * Absolute path to the Sovrium package root directory.
 *
 * Development: src/infrastructure/process → 3 levels up → <root>
 * Bundled:     dist/                     → 1 level up  → <root>
 * Compiled:    binary location directory (for locating co-located assets)
 */
export const SOVRIUM_PACKAGE_ROOT = isCompiled
  ? dirname(process.execPath)
  : isBundled
    ? resolve(import.meta.dir, '..')
    : resolve(import.meta.dir, '..', '..', '..')

/**
 * Resolve a path relative to the Sovrium package root.
 */
export const resolvePackagePath = (...segments: readonly string[]): string =>
  resolve(SOVRIUM_PACKAGE_ROOT, ...segments)

/**
 * Resolve a client-side script path shipped with the Sovrium package.
 *
 * Development: src/presentation/render/scripts/client/<filename>
 * Bundled:     dist/client-scripts/<filename>
 *
 * THE DEV PATH IS ASSEMBLED FROM SEGMENTS, so it holds no path-shaped literal
 * and no rewriter can see it. It is the THIRD such site for this one directory
 * — `[internal ref]` holds two more — and the only one in `src/`,
 * which `rewrite-path-literals.ts` does not sweep at all on a `src/` wave. W6
 * moved `presentation/scripts/` to `presentation/render/scripts/`, and this line
 * was edited by hand after nine unit tests went red.
 *
 * That redness is the point worth recording: this is the only one of the three
 * sites with a TEST behind it, because `static-assets.ts` serves these files and
 * `static-assets.test.ts` reads them off disk. A missed edit HERE fails loudly;
 * a missed edit in `runtime-assets.ts` produces an empty `dist/client-scripts/`
 * and three runtime 404s behind a green build.
 */
export const clientScriptPath = (filename: string): string =>
  isBundled
    ? resolvePackagePath('dist', 'client-scripts', filename)
    : resolvePackagePath('src', 'presentation', 'render', 'scripts', 'client', filename)

// `examplesPath` / `agentsPath` were removed: the `templates/` and `agents/`
// directories are now embedded into the binary and accessed via
// `@/infrastructure/assets/embedded-static-assets` (works in dev, bundled, and
// compiled modes alike).
