/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The steps a path or a loop step ran, as `GET /api/automations/runs/:id`
 * publishes them: under `paths` / `iterations`, each step in the top-level
 * step shape, recursively — and as a reader past her reach is shown them,
 * every value withheld at every depth (`run-step-output-reach.ts`). Nothing
 * here is unmasked: every value was masked when its step record was built.
 */

import {
  projectNested,
  readStoredNested,
} from '@/application/use-cases/automations/run/nested-step-record'

/** The timings a nested step carries: its run's, since a nested step keeps none of its own. */
interface StepTimings {
  readonly startedAt: string | null
  readonly completedAt: string | null
}

/** The `paths` / `iterations` keys of a published step, from its row's `nested` column. */
export const publishedNestedSteps = (nested: unknown, timings: StepTimings) =>
  projectNested(readStoredNested(nested), (step) => ({
    name: step.name,
    type: step.type,
    status: step.status,
    startedAt: timings.startedAt,
    completedAt: timings.completedAt,
    durationMs: null,
    output: step.output ?? null,
    error: step.error ?? null,
    ...(step.logs === undefined ? {} : { logs: step.logs }),
  }))

/** The values of a published step a reader past her reach is not shown. */
interface StepValues {
  readonly output: unknown
  readonly logs?: unknown
  readonly paths?: readonly NestedRun[]
  readonly iterations?: readonly NestedRun[]
}

/** One path or item of a published step, with the steps run inside it. */
interface NestedRun {
  readonly steps: readonly StepValues[]
}

/**
 * A published step with its output, logs and error withheld — and those of
 * every step it ran inside a path or a loop, at any depth, since a nested
 * step's values are what its parent read; names, statuses and timings kept.
 */
export const withheldStep = <T extends StepValues>(step: T): T => {
  const { logs: _logs, paths, iterations, ...rest } = step
  // eslint-disable-next-line sovrium/no-double-assertion -- dropping `logs` from a generic step cannot be typed as that step; every published step type declares `output`/`error` nullable and `logs` optional, so the result IS one
  return {
    ...rest,
    output: null,
    error: null,
    ...(paths === undefined ? {} : { paths: paths.map(withheldRun) }),
    ...(iterations === undefined ? {} : { iterations: iterations.map(withheldRun) }),
  } as unknown as T
}

const withheldRun = (run: NestedRun): NestedRun => ({ ...run, steps: run.steps.map(withheldStep) })
