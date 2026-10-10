/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a later step reads about an earlier one beside its output: how long it
 * took, how it ended and, when it failed, why.
 *
 * Kept in a map PARALLEL to the step outputs so it is readable without being
 * recorded: the outputs map feeds the stored step output, the run's
 * `lastOutput` and a webhook's answer, none of which gains these keys. It is
 * merged UNDER the output wherever steps are read, so an action whose output
 * already names `status` or `error` keeps its own value.
 */

/** The metadata of one settled step, in the words of the runs API. */
export type StepMetadata = {
  /** Whole milliseconds from dispatch to settle, every retry attempt and wait included. */
  readonly durationMs: number
  readonly status: 'completed' | 'failed'
  /** The error text the run history records for the step, when it failed. */
  readonly error?: { readonly message: string }
}

export type StepMetadataMap = Readonly<Record<string, StepMetadata>>

type StepOutputs = Readonly<Record<string, Readonly<Record<string, unknown>>>>

/**
 * The metadata of a step record, or `undefined` when it has none: a step that
 * was not timed, or one that neither completed nor failed (a filter halt, a
 * pause), which no later step of its sequence reads.
 */
export const stepMetadataOf = (step: {
  readonly status: string
  readonly error?: string
  readonly durationMs?: number
}): StepMetadata | undefined => {
  if (step.durationMs === undefined) return undefined
  if (step.status !== 'success' && step.status !== 'failure') return undefined
  return {
    durationMs: step.durationMs,
    status: step.status === 'success' ? 'completed' : 'failed',
    ...(step.error === undefined ? {} : { error: { message: step.error } }),
  }
}

/** `metadata` with the entry of the step named `name` set from its record, when it has one. */
export const withMetadataOf = (
  metadata: StepMetadataMap,
  name: string,
  step: Parameters<typeof stepMetadataOf>[0] | undefined
): StepMetadataMap => {
  const own = step === undefined || name === '' ? undefined : stepMetadataOf(step)
  return own === undefined ? metadata : { ...metadata, [name]: own }
}

/**
 * One step as a later step reads it. Its `.result` alias (see
 * `buildStepsResultView`) stays the action's OUTPUT, set here before the
 * metadata could be swept into it; a step that produced no output has none.
 */
const readEntry = (
  own: StepMetadata,
  output: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> => {
  if (output === undefined) return { ...own, result: undefined }
  return 'result' in output ? { ...own, ...output } : { ...own, ...output, result: output }
}

/**
 * The steps as a later step reads them: each output, with its step's metadata
 * underneath (the output wins on a shared key), and an entry for a step that
 * produced no output but has metadata — a failure that put nothing in its output.
 */
export const withStepMetadata = (
  outputs: StepOutputs,
  metadata: StepMetadataMap | undefined
): StepOutputs =>
  metadata === undefined || Object.keys(metadata).length === 0
    ? outputs
    : {
        ...outputs,
        ...Object.fromEntries(
          Object.entries(metadata).map(([name, own]) => [name, readEntry(own, outputs[name])])
        ),
      }
