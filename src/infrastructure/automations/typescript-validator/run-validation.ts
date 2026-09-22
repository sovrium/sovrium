/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The composition root for a one-shot code-action type-check.
 *
 * `sovrium validate` and `sovrium build` both need a verdict on the `code`
 * action bodies in a config, and neither has a server — so neither has a
 * runtime to run the check on. Something has to bind `TypeScriptValidatorLive`
 * and start a fiber, and standing rule E1 says that something is not a use
 * case. It is this module: one import away from the validator it composes, and
 * reached only through `validateCodeActionBodies`, which keeps the decision of
 * WHETHER to run.
 *
 * LOADING THIS MODULE LOADS `typescript`. That is the whole reason the split
 * exists rather than an inline `Effect.provide` at the call site: the caller
 * runs its `typescript`-free walk first and imports this only when there is a
 * body to check. Importing the package barrel here — rather than the deeper
 * paths — is safe for the same reason and deliberate: by the time anything
 * reaches this file the compiler is being paid for anyway.
 */

import { Effect, Result } from 'effect'
import { TypeScriptValidator, TypeScriptValidatorLive } from '.'
import type { TSValidationError } from './errors'

/**
 * Type-check every `code` action body in `app`.
 *
 * @returns the first refusal, or `undefined` when every body type-checks.
 */
export const runCodeActionValidation = async (
  app: unknown
): Promise<TSValidationError | undefined> => {
  const program = Effect.gen(function* () {
    const validator = yield* TypeScriptValidator
    yield* validator.validateAll(app)
  }).pipe(Effect.provide(TypeScriptValidatorLive), Effect.result)

  const result = await Effect.runPromise(program)
  return Result.isFailure(result) ? result.failure : undefined
}
