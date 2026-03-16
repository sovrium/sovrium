/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve, basename } from 'node:path'

/**
 * Whether we're running from the bundled dist/ output (npm package)
 * vs the original source tree (development).
 *
 * When bundled by Bun.build, all source files are inlined into dist/cli.js
 * or dist/index.js. import.meta.dir then points to the dist/ directory,
 * so we only need to go 1 level up to reach the package root.
 *
 * In development, this file lives at src/infrastructure/utils/package-paths.ts
 * (3 levels deep), so we go 3 levels up.
 */
export const isBundled = basename(import.meta.dir) === 'dist'

/**
 * Absolute path to the Sovrium package root directory.
 *
 * Resolved from this module's location using import.meta.dir, ensuring it
 * always points to the Sovrium installation — even when consumed as an npm
 * dependency where process.cwd() would point to the consumer's project.
 *
 * Development: src/infrastructure/utils → 3 levels up → <root>
 * Bundled:     dist/                     → 1 level up  → <root>
 */
export const SOVRIUM_PACKAGE_ROOT = isBundled
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
 * Development: src/presentation/scripts/client/<filename>
 * Bundled:     dist/client-scripts/<filename>
 */
export const clientScriptPath = (filename: string): string =>
  isBundled
    ? resolvePackagePath('dist', 'client-scripts', filename)
    : resolvePackagePath('src', 'presentation', 'scripts', 'client', filename)
