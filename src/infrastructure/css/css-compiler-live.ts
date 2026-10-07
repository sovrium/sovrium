/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { CSSCompiler, PrecompiledCssWriteError } from '@/application/ports/services/css-compiler'
import { writePrecompiledCSS } from '@/infrastructure/css/cache/css-cache-service'
import { compileCSS } from '@/infrastructure/css/compiler'
import { getVersionedCssFileName } from '@/infrastructure/css/versioned-css-path'

/**
 * Live implementation of CSSCompiler using PostCSS and Tailwind
 *
 * This layer provides the production implementation of CSS compilation
 * using the infrastructure's PostCSS-based compiler.
 */
export const CSSCompilerLive = Layer.succeed(CSSCompiler, {
  compile: compileCSS,
  versionedFileName: getVersionedCssFileName,
  writePrecompiled: (css) =>
    writePrecompiledCSS(css).pipe(
      Effect.mapError((cause) => new PrecompiledCssWriteError({ cause }))
    ),
})
