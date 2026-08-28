/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Result } from 'effect'
import type { TSValidationError } from '@/infrastructure/automations/typescript-validator/errors'
import type { Cause } from 'effect'

/**
 * The code-action type-check, as a step any command can run.
 *
 * WHAT THIS CLOSES. `sovrium start` refuses a config whose `code` action body
 * does not type-check; `sovrium validate` and `sovrium build` used to accept the
 * same file — `validate` printing `Valid configuration` and `build` emitting a
 * complete site for a deployment that dies at boot with `TSValidationError`.
 * That is the deploy gate green on something that cannot start, which is the one
 * failure mode a deploy gate exists to prevent.
 *
 * WHY THIS GATE AND NOT THE OTHERS. `startServer` runs eleven checks after
 * `decodeAppConfigObject`, and only this one is a pure function of the config
 * file. The rest read `process.env`, probe the network for a local Ollama, or
 * stat an S3 bucket — a `validate` that reproduced them would answer differently
 * on a laptop than in CI, which is the opposite of a deploy gate. The contract
 * being kept here is "a config `validate` accepts is a config `start` will not
 * REFUSE", never "the server will definitely come up".
 *
 * WHY IT IS NOT INSIDE `decodeAppConfigObject`, where a reader would look for
 * it. That decoder is synchronous and is called on every boot, build, watch
 * reload and progress-pipeline sweep. This check needs the `typescript`
 * compiler, whose module load alone is ~85 ms and whose API surface here is
 * async. Folding it in would tax every decode in the process for a check most
 * configs have no work for.
 */

/**
 * Run the code-action type-check over an app config.
 *
 * THE GATE ON `collectCodeActions` IS A PERFORMANCE CONTRACT, not an
 * optimization detail. `sovrium validate` completes in ~0.22 s; importing the
 * validator costs ~85 ms of `typescript` module load before it examines
 * anything, and ~260 ms once there is a body to check. Configs with no code
 * action have nothing for the type-checker to do, so they must pay nothing —
 * hence the cheap `typescript`-free walk first and the heavy import only behind
 * it. The cost is dominated by *whether a config has any code action at all*:
 * the lib corpus is memoized per process, so twenty bodies cost barely more than
 * one.
 *
 * The walk is imported by its own path rather than through the package barrel
 * on purpose — the barrel re-exports `./layer`, which imports `typescript`, so
 * routing through it would load the compiler and defeat the gate.
 *
 * @returns one human-readable message per refusal, empty when the config is
 *   clean or carries no code actions at all.
 */
export const validateCodeActionBodies = async (app: unknown): Promise<readonly string[]> => {
  const { collectCodeActions } =
    await import('@/infrastructure/automations/typescript-validator/collect-code-actions')
  if (collectCodeActions(app).length === 0) return []

  const { TypeScriptValidator, TypeScriptValidatorLive } =
    await import('@/infrastructure/automations/typescript-validator')

  const program = Effect.gen(function* () {
    const validator = yield* TypeScriptValidator
    yield* validator.validateAll(app)
  }).pipe(Effect.provide(TypeScriptValidatorLive), Effect.result)

  const result = await Effect.runPromise(program)
  return Result.isFailure(result) ? [formatCodeActionRefusal(result.failure)] : []
}

/**
 * Render one code-action refusal as the line an author reads.
 *
 * The tsc diagnostic is quoted VERBATIM and last. Everything before it is
 * location, so a reader who already knows the defect can find the body, and a
 * reader who does not gets the compiler's own words rather than our paraphrase
 * of them. `validate` must report what boot reports; a summary that said only
 * "this code action is invalid" would satisfy the exit code and tell the author
 * nothing.
 *
 * The `TypeScript validation` opening is load-bearing beyond readability:
 * [internal ref] matches boot's refusal on
 * `/TSValidationError|TypeScript validation/`, and this string is what that
 * refusal now carries once it is re-raised as a plain config rejection.
 *
 * Pure.
 */
const formatCodeActionRefusal = (error: Readonly<TSValidationError>): string =>
  `TypeScript validation failed in automation "${error.automationId}", ` +
  `code action #${String(error.actionIndex)} ` +
  `(line ${String(error.line)}, column ${String(error.column)}): ${error.message}`

/** Narrow an unknown to the tagged shape without importing the class at runtime. */
const isTSValidationError = (value: unknown): value is TSValidationError =>
  typeof value === 'object' &&
  value !== null &&
  (value as { readonly _tag?: unknown })._tag === 'TSValidationError'

/**
 * Recover a code-action refusal from whatever a thrown/rejected value carries.
 *
 * WHY THIS EXISTS. `startServer` raises `TSValidationError` in its typed error
 * channel. `TSValidationError` is a `Data.TaggedError` and therefore cannot
 * also extend `ConfigRejectedError` (there is no multiple inheritance to give
 * it both), so `isConfigRejectedError` returns false and boot would otherwise
 * dress an author's type error as an engine fault: `Sovrium failed to start: …
 * If this looks like a bug, please open an issue`. It is not a bug in Sovrium
 * and there is no issue to open — it is a typo in the caller's config, and it
 * prints as the refusal it is.
 *
 * EFFECT 4 REMOVED THE WRAPPER THIS USED TO UNPACK. Under v3 the rejection was
 * a `FiberFailure` holding its `Cause` under `Runtime.FiberFailureCauseId`, and
 * this function had a second branch to dig it out. v4 deletes `FiberFailure`,
 * `FiberFailureCauseId` and `isFiberFailure` outright and rejects with the
 * SQUASHED error value instead — measured across a typed failure, a defect, and
 * arbitrarily nested `Effect.gen`. So the branch is deleted rather than
 * translated, and the direct check now carries every case.
 *
 * That deletion is not cosmetic. A branch calling a removed function does not
 * quietly stop matching, it THROWS — and this guard sits in `start()`'s catch
 * block, on the path of every boot failure, so a `TypeError` raised here
 * destroys the `Sovrium failed to start: …` report for unrelated faults too.
 * `validate-code-actions.test.ts` pins both halves.
 *
 * Returns `undefined` for every other failure so the caller keeps its stack.
 */
export const extractCodeActionRefusal = (caught: unknown): string | undefined =>
  isTSValidationError(caught) ? formatCodeActionRefusal(caught) : undefined

/**
 * Recover a code-action refusal from a `Cause`, independently of which reason
 * `Cause.squash` would have chosen.
 *
 * `extractCodeActionRefusal` above is correct for every failure this pipeline
 * actually produces, because `startServer` validates code actions in one
 * sequential step and squash surfaces that error. This exists so the guard does
 * not DEPEND on that: a cause carrying several reasons (a failure alongside a
 * finalizer defect, say) squashes to one of them, and if squash picks the other
 * the author silently gets the generic wrapper back. Searching the reasons
 * removes the dependency on a choice we do not control.
 *
 * Pure. Returns `undefined` when no reason carries a `TSValidationError`.
 */
export const findCodeActionRefusalInCause = (cause: Cause.Cause<unknown>): string | undefined => {
  // A `TSValidationError` counts whether it was FAILED or DIED. v3's
  // `Cause.findErrorOption` looked only at typed failures and returned `None`
  // for a defect, so a thrown validation error fell through to the engine-fault
  // wrapper. Reading both fields closes that.
  const carried = cause.reasons
    .map((reason) =>
      reason._tag === 'Fail' ? reason.error : reason._tag === 'Die' ? reason.defect : undefined
    )
    .find(isTSValidationError)
  return carried === undefined ? undefined : formatCodeActionRefusal(carried)
}
