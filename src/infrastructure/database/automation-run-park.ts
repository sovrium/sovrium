/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The queries behind a run parked on a long wait (`waiting-delay`): telling
 * whether any run waits at all, finding the runs that are due, claiming one for its resume, cancelling one that
 * still waits, and rewriting the step row a resume completes.
 *
 * The claim and the cancel are both compare-and-set writes on the run's
 * status, so a sweep, a second sweep, a boot and a cancel racing for the same
 * run end with exactly one of them having acted on it.
 */

import { and, asc, eq, isNotNull, lte, notInArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
  automationRunSteps as automationRunStepsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
  automationRunSteps as automationRunStepsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import type { CreateStepInput } from '@/application/ports/repositories/automations/automation-run-repository'

const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationRunSteps = resolveDialectSchema(automationRunStepsPg, automationRunStepsSqlite)

const WAITING_DELAY = 'waiting-delay'

/**
 * The `waiting-delay` runs whose resume time has come, oldest first, except
 * those of the automations named in `exceptAutomations` (paused ones): left in
 * the batch, they would fill it on every sweep and hold back everyone else.
 */
export const listDueDelayedRuns = async (input: {
  readonly now: Readonly<Date>
  readonly limit: number
  readonly exceptAutomations: readonly string[]
}): Promise<readonly { readonly id: string; readonly automationName: string }[]> =>
  db
    .select({ id: automationRuns.id, automationName: automationDefinitions.name })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(
      and(
        eq(automationRuns.status, WAITING_DELAY),
        isNotNull(automationRuns.resumeAt),
        lte(automationRuns.resumeAt, input.now as Date),
        input.exceptAutomations.length === 0
          ? undefined
          : notInArray(automationDefinitions.name, [...input.exceptAutomations])
      )
    )
    .orderBy(asc(automationRuns.resumeAt))
    .limit(input.limit)

/**
 * Whether any run waits on a long delay at all, due or not. A probe on the
 * leading column of the `(status, resume_at)` index that stops at the first
 * row: the server asks it once per boot, to keep the resume sweep for runs
 * parked under an earlier configuration that no longer declares a long wait.
 */
export const hasWaitingDelayRuns = async (): Promise<boolean> => {
  const [first] = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(eq(automationRuns.status, WAITING_DELAY))
    .limit(1)
  return first !== undefined
}

/**
 * Move one due `waiting-delay` run to `running`, answering its resume cursor —
 * or `undefined` when another caller claimed it first, it was cancelled, or
 * its time has not come. The cursor stays on the row until the run is
 * finalised, which clears it.
 */
export const claimDelayedRun = async (input: {
  readonly id: string
  readonly now: Readonly<Date>
}): Promise<{ readonly cursor: unknown } | undefined> => {
  const [claimed] = await db
    .update(automationRuns)
    .set({ status: 'running', resumeAt: null })
    .where(
      and(
        eq(automationRuns.id, input.id),
        eq(automationRuns.status, WAITING_DELAY),
        lte(automationRuns.resumeAt, input.now as Date)
      )
    )
    .returning({ cursor: automationRuns.resumeCursor })
  return claimed === undefined ? undefined : { cursor: claimed.cursor }
}

/** Cancel a run that still waits, with `error`; answers whether this call did. */
export const cancelWaitingRun = async (input: {
  readonly id: string
  readonly error: string
}): Promise<boolean> => {
  const cancelled = await db
    .update(automationRuns)
    .set({ status: 'cancelled', error: input.error, resumeAt: null, resumeCursor: null })
    .where(and(eq(automationRuns.id, input.id), eq(automationRuns.status, WAITING_DELAY)))
    .returning({ id: automationRuns.id })
  return cancelled.length > 0
}

/** Rewrite the step row at `step.stepIndex` of `runId`; answers whether one matched. */
export const updateRunStep = async (input: {
  readonly runId: string
  readonly step: CreateStepInput
}): Promise<boolean> => {
  const { step } = input
  const updated = await db
    .update(automationRunSteps)
    .set({
      status: step.status,
      input: (step.input ?? null) as object | null,
      output: (step.output ?? null) as object | null,
      error: step.error ?? null,
      logs: (step.logs ?? null) as object | null,
      reads: (step.reads ?? null) as object | null,
      nested: (step.nested ?? null) as object | null,
      ...(step.completedAt === undefined ? {} : { completedAt: step.completedAt }),
    })
    .where(
      and(
        eq(automationRunSteps.runId, input.runId),
        eq(automationRunSteps.stepIndex, step.stepIndex)
      )
    )
    .returning({ id: automationRunSteps.id })
  return updated.length > 0
}
