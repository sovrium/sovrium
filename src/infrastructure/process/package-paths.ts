/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve, basename, dirname } from 'node:path'

/**
 * The roots of Bun's virtual filesystem inside a `bun build --compile` binary.
 *
 * Bun mounts the embedded modules under a different root per platform
 * (`vendor/bun/src/standalone_graph/StandaloneModuleGraph.rs`, `BASE_PATH` and
 * `BASE_PUBLIC_PATH`): `/$bunfs/` on POSIX, and on Windows the drive-lettered
 * `B:\~BUN\` — with `B:/~BUN/` as its forward-slash public spelling, which
 * Bun's own predicate accepts too. A Windows path may also carry an NT prefix
 * (`\\?\`), which Bun strips before comparing, and so does this.
 */
const BUNFS_ROOTS: readonly string[] = ['/$bunfs/', 'B:\\~BUN\\', 'B:/~BUN/']

const NT_PREFIX = '\\\\?\\'

/**
 * Whether a path lies inside Bun's standalone virtual filesystem.
 *
 * A POSIX-only `startsWith('/$bunfs/')` answers `false` on every Windows
 * binary, which sends each compiled-mode branch down its dev-mode disk path —
 * and the first one to run, the migration resolver, then looks for
 * `drizzle/` under the working directory and fails the boot.
 */
export const isBunfsPath = (path: string): boolean => {
  const canonical = path.startsWith(NT_PREFIX) ? path.slice(NT_PREFIX.length) : path
  return BUNFS_ROOTS.some((root) => canonical.startsWith(root))
}

/**
 * Whether we're running inside a `bun build --compile` standalone binary.
 *
 * In compiled mode, import.meta.dir points into Bun's virtual filesystem
 * (`/$bunfs/root` on POSIX, `B:\~BUN\root` on Windows) where only bundled JS
 * modules exist — no templates/, agents/, or package.json on disk.
 */
export const isCompiled = isBunfsPath(import.meta.dir)

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
 * which `rewrite-path-literals.ts` does not sweep at all. Moving the scripts
 * directory therefore means editing this line by hand, and nine unit tests go
 * red until it is.
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

// There is no `examplesPath` / `agentsPath`: the `templates/` and `agents/`
// directories are embedded into the binary and accessed via
// `@/infrastructure/assets/embedded-static-assets` (works in dev, bundled, and
// compiled modes alike).
