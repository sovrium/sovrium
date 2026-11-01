/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The run history reads — `GET /api/automations/runs`, `/runs/:id` and
 * `/:name/runs` — and the two gates every run route opens with: who may read
 * which runs, and whether she may read this one.
 */

import { Effect } from 'effect'
import {
  AutomationRunRepository,
  type PersistedRun,
  type PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import { findPendingApprovalId } from '@/application/use-cases/automations/list-automation-approvals'
import {
  findReadableRun,
  loadRunAccess,
  type ReadableRun,
  type RunAccess,
} from '@/application/use-cases/automations/run-access'
import { runDetailSchema } from '@/domain/models/api/automations/automations'
import {
  listRunsByNameResponseSchema,
  listRunsResponseSchema,
} from '@/domain/models/api/automations/runs'
import { logError } from '@/infrastructure/logging/logger'
import { notFound, requireSession } from '@/presentation/api/runtime/auth-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import {
  listedRuns,
  readListRunsQuery,
  runTriggerDataOf,
  runTriggerFields,
  triggerNameFilterOf,
} from './run-list-body'
import { publishedNestedSteps } from './run-nested-steps'
import { judgedRunOf, runDetailAsSeenByCaller, runsAsSeenByCaller } from './run-step-output-reach'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** A gate's verdict: go on with the value, or send the response instead. */
export type Gated<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly response: Response }

/**
 * The run `id` when the signed-in caller may read it (an admin, the person who
 * started it by hand, an approver a request on it names). No session → 401; a
 * run they may not read → the same 404 an unknown id gets; a store that did
 * not answer → the sanitized error, never a 404 that would claim absence.
 */
export const gateReadableRun = (c: Context, app: App, id: string) =>
  Effect.gen(function* (): Effect.fn.Return<
    Gated<ReadableRun>,
    never,
    Effect.Services<ReturnType<typeof findReadableRun>>
  > {
    const auth = requireSession(c)
    if (!auth.ok) return { ok: false, response: auth.response }
    const found = yield* Effect.result(
      findReadableRun({ runId: id, userId: auth.session.userId, app })
    )
    if (found._tag === 'Failure') return { ok: false, response: toErrorResponse(c, found.failure) }
    if (found.success === undefined) return { ok: false, response: notFound(c, 'Run not found') }
    return { ok: true, value: found.success }
  })

/**
 * What the signed-in caller may read, for the run lists. Mounted behind the
 * session gate, so a missing session is answered 401 here too.
 */
export const gateRunAccess = (c: Context, app: App) =>
  Effect.gen(function* (): Effect.fn.Return<
    Gated<RunAccess>,
    never,
    Effect.Services<ReturnType<typeof loadRunAccess>>
  > {
    const auth = requireSession(c)
    if (!auth.ok) return { ok: false, response: auth.response }
    const loaded = yield* Effect.result(loadRunAccess({ userId: auth.session.userId, app }))
    if (loaded._tag === 'Failure') {
      return { ok: false, response: toErrorResponse(c, loaded.failure) }
    }
    return { ok: true, value: loaded.success }
  })

/**
 * Handle GET /api/automations/:name/runs
 *
 * Returns persisted run history for ONE named automation as a FLAT array
 * (not a `{ runs }` envelope) including full step-level detail. Used by
 * the retry-and-failure spec corpus (timeout, partial-failure, etc.) so
 * test code can do `const runs = await res.json(); runs[0].steps[…]`.
 */
export function handleListRunsByName(c: Context, app: App): Promise<Response> | Response {
  const name = c.req.param('name')
  if (name === undefined) {
    return c.json({ success: false, message: 'Automation name required' }, 400)
  }
  // An automation the config does not declare answers the API's 404, as every
  // other `/:name` route does — an empty list would read as "never ran".
  if (!app.automations?.some((automation) => automation.name === name)) {
    return notFound(c, 'Automation not found')
  }

  return runHandlerEffect(c, answerFailures(c, runsByNameProgram(c, app, name)))
}

/** The runs of one automation the caller may read, each as she may read it. */
const runsByNameProgram = (c: Context, app: App, name: string) =>
  Effect.gen(function* () {
    const access = yield* gateRunAccess(c, app)
    if (!access.ok) return access.response
    const readableBy = access.value.kind === 'scoped' ? access.value.scope : undefined

    // DB-backed read: list runs by name, then enrich each with its steps.
    // Returns a flat array (newest first; `listByAutomationName` already
    // orders by created_at DESC at the SQL level).
    const program = Effect.gen(function* () {
      const repo = yield* AutomationRunRepository
      const runs = yield* repo.listByAutomationName(name, readableBy)
      return yield* Effect.forEach(runs, (run) =>
        Effect.gen(function* () {
          const steps = yield* repo.findStepsByRunId(run.id)
          return { run, steps, detail: buildDbRunDetailBody(app, run, steps) }
        })
      )
    })

    const result = yield* Effect.result(program)
    if (result._tag === 'Failure') {
      logError('[automations] run history read failed', result.failure)
      return c.json({ success: false, message: 'Failed to read run history' }, 500)
    }
    const seen = yield* Effect.forEach(
      result.success,
      ({ run, steps, detail }) =>
        runDetailAsSeenByCaller(c, app, {
          access: { readsEveryRun: readableBy === undefined, run },
          detail,
          judged: judgedRunOf(run, steps),
        }),
      { concurrency: 'unbounded' }
    )
    return yield* respondWith(c, Effect.succeed(seen), listRunsByNameResponseSchema)
  })

/**
 * Handle GET /api/automations/runs
 *
 * Returns persisted run history from `system.automation_runs`. Query
 * parameters:
 *   - `automationName` — filter by automation user-facing name
 *   - `status`         — filter by run status (e.g. `completed`, `failed`)
 *   - `triggerName`    — filter by the trigger entry that started the run
 *   - `page`           — 1-indexed page number (paired with `pageSize`)
 *   - `pageSize`       — items per page; when present, `pagination` envelope
 *                        is included in the response
 *
 * The response is `{ runs, pagination? }`.
 */
export function handleListRuns(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, listRunsProgram(c, app)))
}

/** One page of the runs the caller may read, each as she may read it. */
const listRunsProgram = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { automationName, status, triggerName, page, pageSize } = readListRunsQuery(c)
    // In the query, not after it: the total must count only the runs listed.
    const access = yield* gateRunAccess(c, app)
    if (!access.ok) return access.response
    const readableBy = access.value.kind === 'scoped' ? access.value.scope : undefined

    // Steps are fetched per-run so `attempt` reflects retry history
    // (an API automation runs spec reads `run.attempt`). The N+1 cost is acceptable
    // for the runs API (typically paginated to ≤50 rows); a JOIN-based reader
    // could replace this if the cost becomes material.
    const program = Effect.gen(function* () {
      const repo = yield* AutomationRunRepository
      const result = yield* repo.listAll({
        ...(automationName !== undefined ? { automationName } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(triggerName === undefined
          ? {}
          : { triggerName: triggerNameFilterOf(app, automationName, triggerName) }),
        ...(page !== undefined ? { page } : {}),
        ...(pageSize !== undefined ? { pageSize } : {}),
        ...(readableBy !== undefined ? { readableBy } : {}),
      })
      const stepsPerRun = yield* Effect.forEach(result.runs, (run) => repo.findStepsByRunId(run.id))
      return { ...result, stepsPerRun }
    })

    const result = yield* Effect.result(program)
    if (result._tag === 'Failure') {
      logError('[automations] run history read failed', result.failure)
      return c.json({ success: false, message: 'Failed to read run history' }, 500)
    }

    const { runs, total, stepsPerRun } = result.success
    // The trigger data a run captured is judged as its detail judges it.
    const runsBody = {
      runs: yield* runsAsSeenByCaller(c, app, {
        readsEveryRun: readableBy === undefined,
        runs: listedRuns(app, runs, stepsPerRun),
      }),
    }
    if (pageSize !== undefined) {
      const effectivePage = page !== undefined && page >= 1 ? page : 1
      const pagination = {
        page: effectivePage,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      }
      return yield* respondWith(
        c,
        Effect.succeed({ ...runsBody, pagination }),
        listRunsResponseSchema
      )
    }
    return yield* respondWith(c, Effect.succeed(runsBody), listRunsResponseSchema)
  })

/**
 * Pull per-attempt history off the last failing step's `output.attempts`
 * (populated by `dispatchWithRetry` when an action's retry budget is in
 * play — an automation retry spec). Returns an empty array when no step
 * has attempt records (most non-retrying runs).
 */
const extractAttempts = (
  steps: ReadonlyArray<{ readonly output?: unknown; readonly status?: string }>
): ReadonlyArray<Readonly<Record<string, unknown>>> => {
  const lastWithAttempts = steps.findLast(
    (s) =>
      s.output !== undefined &&
      s.output !== null &&
      typeof s.output === 'object' &&
      Array.isArray((s.output as { attempts?: unknown }).attempts)
  )
  if (!lastWithAttempts) return []
  const out = lastWithAttempts.output as { readonly attempts: ReadonlyArray<unknown> }
  return out.attempts as ReadonlyArray<Readonly<Record<string, unknown>>>
}

/** The runDetailSchema body of a run row and its step rows (`type: ''`: rows do not keep it). */
const buildDbRunDetailBody = (app: App, run: PersistedRun, steps: readonly PersistedStep[]) => ({
  id: run.id,
  automationName: run.automationName,
  status: run.status,
  ...runTriggerFields(app, run),
  triggerData: runTriggerDataOf(app, run),
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  durationMs: run.durationMs,
  attempt: 1,
  attempts: extractAttempts(steps),
  error: run.error,
  valuesErasedAt: run.valuesErasedAt,
  resumeAt: run.resumeAt,
  steps: steps.map((step) => ({
    name: step.actionName,
    type: '',
    status: step.status,
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    durationMs: step.durationMs,
    output: step.output ?? null,
    error: step.error,
    ...(Array.isArray(step.logs) ? { logs: step.logs } : {}),
    ...publishedNestedSteps(step.nested, step),
  })),
})

/**
 * Effect program that loads the run + its steps from the DB-backed
 * repository. Returns `undefined` when the run id has no row, which the
 * route reports as 404. Errors propagate so the route can report them.
 */
const loadDbRunDetail = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const run = yield* repo.findById(id)
    if (run === undefined) return undefined
    const steps = yield* repo.findStepsByRunId(id)
    // The pending request the run waits on, so a client can resolve it.
    const approvalId = yield* findPendingApprovalId(id)
    return { run, steps, approvalId }
  })

/**
 * Handle GET /api/automations/runs/:id
 *
 * Returns the runDetailSchema shape — run metadata plus per-step execution
 * results. This is the canonical endpoint for callers that need per-action
 * visibility: the trigger response only exposes the last action's
 * `output`, so anything richer (intermediate step outputs, skipped steps,
 * step-level error messages) lives here.
 */
export function handleGetRunDetail(c: Context, app: App): Promise<Response> | Response {
  const id = c.req.param('id')
  if (id === undefined) {
    return c.json({ success: false, message: 'Run id required' }, 400)
  }
  return runHandlerEffect(c, answerFailures(c, runDetailProgram(c, app, id)))
}

/** One run, whole or as the caller may read it. */
const runDetailProgram = (c: Context, app: App, id: string) =>
  Effect.gen(function* () {
    // A run the caller may not read answers exactly what an unknown id answers.
    const gate = yield* gateReadableRun(c, app, id)
    if (!gate.ok) return gate.response

    // effect-swallow: a detail that cannot be read answers the 404 an unknown id does.
    const dbResult = yield* Effect.result(loadDbRunDetail(id))
    if (dbResult._tag === 'Failure' || dbResult.success === undefined) {
      return notFound(c, 'Run not found')
    }
    // S4: the body leaves through its published contract, so a field the
    // OpenAPI document does not declare cannot reach a client.
    const { run, steps, approvalId } = dbResult.success
    // A step's output is what it read under the run's authority: a reader who
    // does not read every run sees it only within her own reach.
    const detail = yield* runDetailAsSeenByCaller(c, app, {
      access: { readsEveryRun: gate.value.readsEveryRun, run },
      detail: buildDbRunDetailBody(app, run, steps),
      judged: judgedRunOf(run, steps),
    })
    return yield* respondWith(
      c,
      Effect.succeed({ ...detail, approvalId: approvalId ?? null }),
      runDetailSchema
    )
  })
