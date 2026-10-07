/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * Compiled CSS result
 */
export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
}

/**
 * CSS compilation error
 */
export interface CSSCompilationError {
  readonly _tag: 'CSSCompilationError'
  readonly cause: unknown
}

/** The pre-compiled stylesheet could not be written. */
export class PrecompiledCssWriteError extends Data.TaggedError('PrecompiledCssWriteError')<{
  readonly cause: unknown
}> {}

/**
 * CSS Compiler port for compiling Tailwind CSS
 *
 * This interface defines the contract for CSS compilation,
 * allowing the Application layer to remain decoupled from
 * Infrastructure implementations (PostCSS, Tailwind, etc.).
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const cssCompiler = yield* CSSCompiler
 *   const result = yield* cssCompiler.compile(app)
 *   console.log(`Compiled ${result.css.length} bytes of CSS`)
 * })
 * ```
 */
export class CSSCompiler extends Context.Service<
  CSSCompiler,
  {
    /**
     * Compiles CSS from app theme configuration
     *
     * @param app - Optional app configuration containing theme
     * @returns Effect that yields compiled CSS string or CSSCompilationError
     */
    readonly compile: (app?: App) => Effect.Effect<CompiledCSS, CSSCompilationError>
    /**
     * The content-versioned stylesheet name the rendered HTML links for this
     * app (`output-<hash>.css`). Derived from the same inputs the compiled CSS
     * depends on, so a change that alters the stylesheet always alters the name.
     */
    readonly versionedFileName: (app: App) => string
    /**
     * Persist compiled CSS where a production `start` reads it instead of
     * compiling at boot, and answer the path written.
     */
    readonly writePrecompiled: (css: string) => Effect.Effect<string, PrecompiledCssWriteError>
  }
>()('CSSCompiler') {}
