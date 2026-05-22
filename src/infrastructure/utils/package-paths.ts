/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolve, basename, dirname } from 'node:path'

export const isCompiled = import.meta.dir.startsWith('/$bunfs/')

export const isBundled = !isCompiled && basename(import.meta.dir) === 'dist'

export const SOVRIUM_PACKAGE_ROOT = isCompiled
  ? dirname(process.execPath)
  : isBundled
    ? resolve(import.meta.dir, '..')
    : resolve(import.meta.dir, '..', '..', '..')

export const resolvePackagePath = (...segments: readonly string[]): string =>
  resolve(SOVRIUM_PACKAGE_ROOT, ...segments)

export const clientScriptPath = (filename: string): string =>
  isBundled
    ? resolvePackagePath('dist', 'client-scripts', filename)
    : resolvePackagePath('src', 'presentation', 'scripts', 'client', filename)

