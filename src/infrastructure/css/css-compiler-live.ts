/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { CSSCompiler } from '@/application/ports/css-compiler'
import { compileCSS } from '@/infrastructure/css/compiler'

/**
 * Live implementation of CSSCompiler using PostCSS and Tailwind
 *
 * This layer provides the production implementation of CSS compilation
 * using the infrastructure's PostCSS-based compiler.
 */
export const CSSCompilerLive = Layer.succeed(CSSCompiler, {
  compile: compileCSS,
})
