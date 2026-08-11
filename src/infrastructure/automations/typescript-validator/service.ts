/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, type Effect } from 'effect'
import type { TSValidationError } from './errors'

/**
 * Effect Context.Tag exposing the in-process TypeScript validator. The
 * live implementation runs `ts.createProgram` over a virtual file system
 * where each `code` action body becomes a synthetic `.ts` file with a
 * prepended ambient `CodeContext` declaration.
 *
 * Provided by `TypeScriptValidatorLive`; consumed at server startup by
 * `startServer`. Validation failures short-circuit `startServer` with a
 * `TSValidationError` before the HTTP listener binds.
 */
export class TypeScriptValidator extends Context.Tag('TypeScriptValidator')<
  TypeScriptValidator,
  {
    readonly validateAll: (app: unknown) => Effect.Effect<void, TSValidationError>
  }
>() {}
