/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
}

export interface CSSCompilationError {
  readonly _tag: 'CSSCompilationError'
  readonly cause: unknown
}

export class CSSCompiler extends Context.Tag('CSSCompiler')<
  CSSCompiler,
  {
    readonly compile: (app?: App) => Effect.Effect<CompiledCSS, CSSCompilationError>
  }
>() {}
