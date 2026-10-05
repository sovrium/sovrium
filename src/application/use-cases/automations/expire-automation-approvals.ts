/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Close the approval requests nobody answered before their timeout.
 *
 * An approval step with `timeout` stores its deadline on the request; this
 * sweep is what enforces it. Every pending automation-step request whose
 * deadline has passed is resolved by its step's `onTimeout` — `approve`
 * resumes the run, `reject` ends it (or resumes it under `onReject:
 * continue`) — through the same `applyApprovalOutcome` a person's answer
 * takes, with the step output reading `resolvedBy: timeout`. A request whose
 * step says `escalate`, or declares no `onTimeout`, stays open.
 *
 * Run every minute and once at start-up by `register-approval-expiry.ts`, and
 * on demand by the token-gated `POST /api/internal/automations/expire-approvals`.
 * The sweep is not what makes a timeout exact: a person answering after the
 * deadline but before the next tick applies the timeout first and is refused
 * (see `resolve-automation-approval.ts`).
 *
 * The sweep pages through the expired rows oldest deadline first, stepping past
 * the ones it leaves open, and resolves at most 200 per run. The claim inside
 * `applyApprovalOutcome` is a compare-and-set on `pending`, so a sweep that
 * races a person, the on-demand route or another server on the same database
 * resolves each request at most once, and the loser moves on without a log.
 */

import { Clock, Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { logError } from '@/infrastructure/logging/logger'
import {
  applyApprovalOutcome,
  loadApprovalRunTarget,
  timeoutOutcomeOf,
  type ResolveApprovalError,
  type ResolveRequirements,
} from './resolve-automation-approval'
import type {
  AutomationApprovalDatabaseError,
  AutomationApprovalRow,
} from '@/application/ports/repositories/automations/automation-approval-repository'
import type { App } from '@/domain/models/app'

/** Expired requests read per page. */
const PAGE_SIZE = 200

/** At most this many requests are resolved per sweep; the next tick takes the rest. */
const MAX_RESOLVED_PER_SWEEP = 200

/**
 * At most this many pages are read per sweep. A page only ends early on the
 * requests the sweep leaves open, so this bounds the reading a large stock of
 * `escalate` requests costs each minute; the stock past it is starved until
 * it is answered, and the sweep's "left open" rows tell the operator so.
 */
const MAX_PAGES_PER_SWEEP = 10

/** "This request stays open" — the union member, not a throwaway void. */
const LEFT_OPEN: string | undefined = undefined

type ExpiredRow = AutomationApprovalRow & { readonly runId: string }

/** Resolve one expired request by its timeout; answers its id, or `undefined` when it stays open. */
const expireOne = (
  row: ExpiredRow,
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>,
  nowMs: number
): Effect.Effect<string | undefined, ResolveApprovalError, ResolveRequirements> =>
  Effect.gen(function* () {
    const target = yield* loadApprovalRunTarget({ runId: row.runId, approval: row, app })
    const decision = timeoutOutcomeOf(target, nowMs)
    if (decision === undefined) return LEFT_OPEN
    yield* applyApprovalOutcome({
      runId: row.runId,
      approvalId: row.id,
      target,
      decision,
      resolver: { by: 'timeout' },
      app,
      processEnv,
    })
    return row.id
  }).pipe(
    // Somebody else resolved it between the read and the claim — a person
    // answering, the on-demand route, or a second server on the same database.
    // The claim refused this sweep, so the run moved on exactly once: nothing
    // to log, nothing to retry.
    Effect.catchTag('ApprovalAlreadyResolved', () => Effect.succeed(LEFT_OPEN))
  )

/** {@link expireOne}, with any failure logged and the request left for the next tick. */
const expireOneOrLeave = (
  row: ExpiredRow,
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>,
  nowMs: number
): Effect.Effect<string | undefined, never, ResolveRequirements> =>
  expireOne(row, app, processEnv, nowMs).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[approval-expiry] expired approval request not resolved', cause, {
          'sovrium.automation.run': row.runId,
        })
      )
    ),
    // effect-swallow: logged above — one request that cannot be resolved (its automation removed from the config, a failed resume) must not keep the others waiting; it is retried on the next tick.
    Effect.catchCause(() => Effect.succeed(LEFT_OPEN))
  )

/** The request rows linked to a run — the only ones a timeout can resolve. */
const linkedToRun = (rows: readonly AutomationApprovalRow[]): readonly ExpiredRow[] =>
  rows.flatMap((row) => (row.runId === null ? [] : [{ ...row, runId: row.runId }]))

/**
 * Sweep one page, then the next past its last row, until a short page, the
 * resolution budget, or the page cap. Answers every id resolved so far.
 */
const sweepPages = (input: {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly nowMs: number
  readonly after: { readonly expiresAt: Date; readonly id: string } | undefined
  readonly pagesLeft: number
  readonly resolved: readonly string[]
}): Effect.Effect<readonly string[], AutomationApprovalDatabaseError, ResolveRequirements> =>
  Effect.gen(function* () {
    const { app, processEnv, nowMs, after } = input
    const repository = yield* AutomationApprovalRepository
    const rows = yield* repository.listExpiredPending({
      now: new Date(nowMs),
      limit: PAGE_SIZE,
      ...(after === undefined ? {} : { after }),
    })
    const resolved = yield* Effect.reduce(
      linkedToRun(rows),
      () => input.resolved,
      (done, row) =>
        done.length >= MAX_RESOLVED_PER_SWEEP
          ? Effect.succeed(done)
          : expireOneOrLeave(row, app, processEnv, nowMs).pipe(
              Effect.map((id) => (id === undefined ? done : [...done, id]))
            )
    )
    // Every row read has a deadline (the query filters on it); the guard only
    // narrows the type.
    const last = rows.at(-1)
    const cursor =
      last === undefined || last.expiresAt === null
        ? undefined
        : { expiresAt: last.expiresAt, id: last.id }
    const isDone =
      cursor === undefined ||
      rows.length < PAGE_SIZE ||
      resolved.length >= MAX_RESOLVED_PER_SWEEP ||
      input.pagesLeft <= 1
    if (isDone) return resolved
    return yield* sweepPages({
      ...input,
      after: cursor,
      pagesLeft: input.pagesLeft - 1,
      resolved,
    })
  })

/**
 * Resolve every pending request past its deadline by its `onTimeout`,
 * answering the ids resolved, in deadline order. One at a time, so two
 * requests of one automation never resume side by side.
 */
export const expireAutomationApprovals = (
  app: App,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<readonly string[], AutomationApprovalDatabaseError, ResolveRequirements> =>
  Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    return yield* sweepPages({
      app,
      processEnv,
      nowMs,
      after: undefined,
      pagesLeft: MAX_PAGES_PER_SWEEP,
      resolved: [],
    })
  }).pipe(Effect.withSpan('automations.expire-automation-approvals'))
