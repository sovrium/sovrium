/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code-action type-check, as the boot sequence sees it.
 *
 * The live implementation runs `ts.createProgram` over a virtual file system
 * where each `code` action body becomes a synthetic `.ts` file with a
 * prepended ambient `CodeContext` declaration. Validation failures
 * short-circuit `startServer` with a {@link TSValidationError} before the HTTP
 * listener binds.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * Failure raised when in-process `tsc` finds a type error in a
 * `runTypescript` code action body. The `message` carries the raw tsc
 * diagnostic; `automationId`, `actionIndex`, `file`, `line`, `column`
 * pinpoint the exact source location so the operator can fix the
 * offending action before the listener binds.
 */
export class TSValidationError extends Data.TaggedError('TSValidationError')<{
  readonly automationId: string
  readonly actionIndex: number
  readonly file: string
  readonly line: number
  readonly column: number
  readonly message: string
}> {}

export class TypeScriptValidator extends Context.Service<
  TypeScriptValidator,
  {
    readonly validateAll: (app: unknown) => Effect.Effect<void, TSValidationError>
  }
>()('TypeScriptValidator') {}
