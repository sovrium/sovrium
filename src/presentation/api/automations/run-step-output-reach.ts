/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a reader who does not read every run is shown of a run, on every road
 * she takes to it: its detail, its lists, and the requests it asks her to sign.
 *
 * An admin reads every run whole. Anyone else reads a run only as its
 * hand-starter or a named approver (`run-access.ts`); a run she started by
 * hand read as her, so she sees every value of it — but each person a record
 * step expanded reaches her with its address masked, as it reaches every
 * reader who is not an admin (`run-person-address-mask.ts`), and so does each
 * person in the trigger data of a run she did not start. Every other
 * reader is shown a value the run captured or produced only as far as it
 * stays within what she may read (`run-step-reach.ts`):
 *
 *  - its trigger data, unless it is withheld from her — and then every step's
 *    output, logs and error with it, since data flows forward;
 *  - each step's output, logs and error up to the first step whose reach
 *    exceeds hers, and none from there on; step names, statuses and timings
 *    stay, so a failed step still reads `failed`;
 *  - the run's own error, unless any step's error is withheld;
 *  - a request's message, judged as the request step's output is: it reads
 *    `null` when she may not read what fed it.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  stepWithMaskedAddresses,
  triggerDataWithMaskedAddresses,
} from '@/application/use-cases/automations/run-person-address-mask'
import { getUserAccessRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { withheldStep } from './run-nested-steps'
import { visibleStepCount, type JudgedRun } from './run-step-reach'
import type { Reader } from './run-record-reach'
import type {
  PersistedRun,
  PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Who reads a run: whoever started it or reads every run, as `access` says. */
interface RunAccess {
  readonly readsEveryRun: boolean
  readonly run: { readonly startedByHand: boolean; readonly triggeredByUserId: string | null }
}

/**
 * The caller of this request as a run's reader: one who sees it whole (an
 * admin-equivalent), the person who started it by hand (every value — it read
 * as her — with each person's address masked), nobody signed in, or a reader
 * whose reach each captured value is judged by.
 */
type RunCaller = 'whole' | 'starter' | 'nobody' | Reader

const callerOfRun = async (c: Context, app: App, access: RunAccess): Promise<RunCaller> => {
  if (access.readsEveryRun) return 'whole'
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return 'nobody'
  const [role, groups, accessRoles] = await runDomainPromise(
    c,
    Effect.all([getUserRole(userId), getUserGroups(userId), getUserAccessRoles(userId)])
  )
  const startedItByHand = access.run.startedByHand && access.run.triggeredByUserId === userId
  if (isAdminEquivalent(role, app)) return 'whole'
  if (startedItByHand) return 'starter'
  return { role, groups, accessRoles, userId }
}

/** A persisted run and its steps as the judgement reads them. */
export const judgedRunOf = (run: PersistedRun, steps: readonly PersistedStep[]): JudgedRun => ({
  automationName: run.automationName,
  triggerData: run.triggerData,
  relay: run.relay,
  valuesErasedAt: run.valuesErasedAt,
  steps: steps.map((step) => ({
    name: step.actionName,
    status: step.status,
    output: step.output,
    reads: step.reads,
  })),
})

/** What a reader is shown of one run: its trigger data, and how many leading steps whole. */
interface Verdict {
  readonly triggerVisible: boolean
  readonly visibleSteps: number
  readonly stepCount: number
}

/** The verdict for `caller` on `judged`: everything for a whole reader or a starter, nothing for nobody. */
const verdictFor = async (
  c: Context,
  app: App,
  caller: RunCaller,
  judged: JudgedRun
): Promise<Verdict> => {
  const stepCount = judged.steps.length
  if (caller === 'whole' || caller === 'starter') {
    return { triggerVisible: true, visibleSteps: stepCount, stepCount }
  }
  if (caller === 'nobody') return { triggerVisible: false, visibleSteps: 0, stepCount }
  return { ...(await visibleStepCount({ c, app, reader: caller, run: judged })), stepCount }
}

/**
 * The trigger data a reader is shown: none past her reach; her own input when
 * she started the run by hand; otherwise each person it carries — a record
 * trigger's expanded `user` field, a comment's author, its thread and the
 * people it mentions — with the address masked.
 */
const triggerDataFor = (
  app: App,
  input: { readonly caller: RunCaller; readonly verdict: Verdict; readonly judged: JudgedRun },
  triggerData: unknown
): unknown => {
  const { caller, verdict, judged } = input
  if (!verdict.triggerVisible) return null
  if (caller === 'starter') return triggerData
  return triggerDataWithMaskedAddresses(app, judged.automationName, triggerData)
}

/** True when every value of the run reaches the reader: her run error is shown. */
const isWhole = (verdict: Verdict): boolean =>
  verdict.triggerVisible && verdict.visibleSteps >= verdict.stepCount

/**
 * The runs of a list as the signed-in caller of this request may see them:
 * each one's trigger data and own error judged as {@link runDetailAsSeenByCaller}
 * judges them.
 */
export const runsAsSeenByCaller = <
  R extends { readonly triggerData?: unknown; readonly error?: string | null },
>(
  c: Context,
  app: App,
  input: {
    readonly readsEveryRun: boolean
    readonly runs: ReadonlyArray<readonly [RunAccess['run'], R, JudgedRun]>
  }
): Promise<ReadonlyArray<R>> =>
  Promise.all(
    input.runs.map(async ([run, body, judged]) => {
      const caller = await callerOfRun(c, app, { readsEveryRun: input.readsEveryRun, run })
      // A listed run carries no step output: a starter's own trigger input is hers.
      if (caller === 'whole' || caller === 'starter') return body
      const verdict = await verdictFor(c, app, caller, judged)
      return {
        ...body,
        triggerData: triggerDataFor(app, { caller, verdict, judged }, body.triggerData),
        ...(isWhole(verdict) ? {} : { error: null }),
      }
    })
  )

/** A run detail body: what triggered it, its own error and its steps. */
interface RunDetailLike<T> {
  readonly triggerData?: unknown
  readonly error?: string | null
  readonly steps: ReadonlyArray<T>
}

/**
 * A run's detail as the signed-in caller of this request may see it: whole for
 * a caller who reads every run (an admin); every value for the person who
 * started it by hand; otherwise its trigger data, each step's output, logs and
 * error, and its own error withheld past her reach. Anyone but an admin reads
 * each expanded person with the address masked (see the module header).
 */
export const runDetailAsSeenByCaller = async <
  T extends Parameters<typeof stepWithMaskedAddresses>[2] & { readonly logs?: unknown },
  D extends RunDetailLike<T>,
>(
  c: Context,
  app: App,
  input: { readonly access: RunAccess; readonly detail: D; readonly judged: JudgedRun }
): Promise<D> => {
  const { access, detail, judged } = input
  const caller = await callerOfRun(c, app, access)
  if (caller === 'whole') return detail
  const verdict = await verdictFor(c, app, caller, judged)
  const steps = detail.steps.map((step, index) =>
    index < verdict.visibleSteps
      ? stepWithMaskedAddresses(app, judged.automationName, step)
      : withheldStep(step)
  )
  return {
    ...detail,
    steps,
    triggerData: triggerDataFor(app, { caller, verdict, judged }, detail.triggerData),
    ...(isWhole(verdict) ? {} : { error: null }),
  }
}

/** A request to sign as the approvals list reads it: the run it pauses, and its step. */
interface ApprovalLike {
  readonly runId: string
  readonly stepIndex: number
  readonly message: string | null
}

/** The run a request pauses, with its access and its steps, or `undefined`. */
const loadRequestRun = (
  c: Context,
  runId: string
): Promise<{ readonly run: PersistedRun; readonly judged: JudgedRun } | undefined> =>
  runDomainPromise(
    c,
    Effect.gen(function* () {
      const repo = yield* AutomationRunRepository
      const run = yield* repo.findById(runId)
      if (run === undefined) return undefined
      return { run, judged: judgedRunOf(run, yield* repo.findStepsByRunId(runId)) }
    })
  ).catch(() => undefined)

/**
 * The requests of the approvals list as the signed-in caller may read them:
 * each message — rendered from what its run carries — judged as the request
 * step's output is, and `null` when she may not read what fed it.
 */
export const approvalsAsSeenByCaller = <A extends ApprovalLike>(
  c: Context,
  app: App,
  input: { readonly readsEveryRun: boolean; readonly approvals: ReadonlyArray<A> }
): Promise<ReadonlyArray<A>> =>
  Promise.all(
    input.approvals.map(async (approval) => {
      if (input.readsEveryRun || approval.message === null) return approval
      const loaded = await loadRequestRun(c, approval.runId)
      if (loaded === undefined) return { ...approval, message: null }
      const caller = await callerOfRun(c, app, { readsEveryRun: false, run: loaded.run })
      if (caller === 'whole' || caller === 'starter') return approval
      const verdict = await verdictFor(c, app, caller, loaded.judged)
      return verdict.visibleSteps > approval.stepIndex ? approval : { ...approval, message: null }
    })
  )
