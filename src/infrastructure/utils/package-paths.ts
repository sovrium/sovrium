/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve } from 'node:path'

/**
 * Absolute path to the Sovrium package root directory.
 *
 * Resolved from this module's location using import.meta.dir, ensuring it
 * always points to the Sovrium installation — even when consumed as an npm
 * dependency where process.cwd() would point to the consumer's project.
 *
 * This file lives at:  src/infrastructure/utils/package-paths.ts
 * import.meta.dir  =>  <root>/src/infrastructure/utils
 * 3 levels up       =>  <root>
 */
export const SOVRIUM_PACKAGE_ROOT = resolve(import.meta.dir, '..', '..', '..')

/**
 * Resolve a path relative to the Sovrium package root.
 */
export const resolvePackagePath = (...segments: readonly string[]): string =>
  resolve(SOVRIUM_PACKAGE_ROOT, ...segments)

/**
 * Resolve a client-side script path shipped with the Sovrium package.
 */
export const clientScriptPath = (filename: string): string =>
  resolvePackagePath('src', 'presentation', 'scripts', 'client', filename)
