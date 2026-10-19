/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import {
  compileCacheKeyOf,
  compilerSourceFiles,
  fileStatsFingerprint,
  isCompileCacheDisabled,
  resolveCompileCacheDir,
  type CompileCacheTarget,
} from '@/infrastructure/css/cache/compile-disk-cache'
import { isCompiled, SOVRIUM_PACKAGE_ROOT } from '@/infrastructure/process/package-paths'
import { getSovriumVersionSync } from '@/infrastructure/process/version'
import { cssCompileKey, engineCssFingerprint } from './versioned-css-path'
import type { App } from '@/domain/models/app'

/** {@link engineCodeFingerprint}, computed once per process. */
let codeFingerprint: string | undefined

/**
 * What the compiler's own code is, as far as the compile cache can cheaply
 * tell: the executable for the compiled binary (never a `$bunfs` path), the
 * CSS compiler's modules and the lockfile for a source checkout. The version
 * and source-CSS fingerprint alone would miss an edit to the compiler or a
 * Tailwind bump between two builds of one version.
 */
const engineCodeFingerprint = (): string =>
  (codeFingerprint ??= fileStatsFingerprint(
    isCompiled
      ? [process.execPath]
      : [join(SOVRIUM_PACKAGE_ROOT, 'bun.lock'), ...compilerSourceFiles(SOVRIUM_PACKAGE_ROOT)]
  ))

/**
 * Where this app's compile lives in the on-disk compile cache, or `undefined`
 * when the operator turned it off (`SOVRIUM_TAILWIND_CACHE=off`). The engine
 * half is the version, the engine fingerprint (source CSS and compile path —
 * the same one the pre-compiled stamp carries) and the code fingerprint; the
 * app half is {@link cssCompileKey} — the same expression the in-memory cache
 * and the pre-compiled stamp key on.
 */
export const compileCacheTarget = (app?: App): CompileCacheTarget | undefined =>
  isCompileCacheDisabled()
    ? undefined
    : {
        dir: resolveCompileCacheDir(),
        key: compileCacheKeyOf(
          getSovriumVersionSync(),
          [engineCssFingerprint(), engineCodeFingerprint()],
          cssCompileKey(app)
        ),
      }
