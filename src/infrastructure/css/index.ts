/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CSS Infrastructure Module
 *
 * Provides CSS compilation utilities using Tailwind CSS via PostCSS.
 * Compiles Tailwind CSS on-demand for development and production builds.
 *
 * @example
 * ```typescript
 * import { compileCSS } from '@/infrastructure/css'
 *
 * const program = Effect.gen(function* () {
 *   const compiledCSS = yield* compileCSS()
 *   return compiledCSS
 * })
 * ```
 */

export { compileCSS } from './compiler'
