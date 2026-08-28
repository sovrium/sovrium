/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `approval/request` action handler — PAUSE an automation and record a
 * pending human-approval request.
 *
 * When an automation step of `type: 'approval'` runs, this handler inserts
 * a row into `system.automation_approval_requests` with `status = 'pending'`
 * and the rendered approver-facing message, then returns `pause: true` so the
 * run loop SUSPENDS the run: the run row persists with the non-terminal
 * `waiting-approval` status and every subsequent action is withheld until an
 * out-of-band approver resolves the request via the run-scoped approve/reject
 * endpoint (mirroring the AI-agent approval surface in
 * `src/presentation/api/routes/agents/approval-*.ts`, which shares the same
 * table).
 *
 * The `run_id` column links the pending row to the paused run ([internal ref] /
 * [internal ref]) — the resolution endpoint locates the run via that link
 * and resumes it by re-running the actions AFTER `step_index`. `run_id` is
 * threaded through the handler's `AutomationContext.runId`; when the scheduler
 * could not persist a run row it stays null (the request is still recorded).
 *
 * `props.message`, `props.approvers`, and the rest were already
 * template-substituted by the run loop's `resolveActionPropsForDispatch`
 * pass, so `${{trigger.data.amount}}` is concrete by the time this handler
 * runs.
 *
 * The handler's `output` carries `status: 'pending'` plus the configured
 * `timeout` / `onTimeout`, which the run loop shallow-merges into
 * `lastOutput` and the webhook dispatcher surfaces as the response
 * `body.output`.
 *
 * Wave: [internal ref].
 */

import { Effect } from 'effect'
import { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import { parseDuration } from '@/domain/utils/parse-duration'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * Insert a pending approval row (best-effort) via
 * `AutomationApprovalRepository.insertPending`.
 *
 * A DB failure must not crash the automation run, so the port's typed error is
 * swallowed: on failure the handler still returns a `pending` outcome (the run
 * loop records the step as successful and the webhook response is unaffected).
 * The `Effect.catchAll` keeps the Effect total, replacing the `.catch` that used
 * to sit on the raw Drizzle promise.
 */
const insertApprovalRequest = (input: {
  readonly message: string
  readonly timeoutSeconds: number | undefined
  readonly expiresAt: Date | undefined
  readonly runId: string | undefined
  readonly stepIndex: number
}): Effect.Effect<void, never, AutomationApprovalRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationApprovalRepository
    yield* repo.insertPending(input)
  }).pipe(Effect.ignore)

/**
 * Derive the `{ timeoutSeconds, expiresAt }` pair from the raw `timeout`
 * duration string (e.g. `'24h'`). An absent / unparseable / non-positive
 * timeout yields both fields undefined (the row is recorded without expiry).
 * Extracted so the handler generator stays under the complexity cap.
 */
const deriveTimeout = (
  timeout: unknown
): { readonly timeoutSeconds: number | undefined; readonly expiresAt: Date | undefined } => {
  const timeoutMs =
    typeof timeout === 'string' && timeout.trim() !== '' ? parseDuration(timeout) : NaN
  const hasTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0
  return {
    timeoutSeconds: hasTimeout ? Math.floor(timeoutMs / 1000) : undefined,
    expiresAt: hasTimeout ? new Date(Date.now() + timeoutMs) : undefined,
  }
}

/**
 * `approval/request` — record a pending approval request and surface the
 * approval configuration on the step output.
 */
export const handleApprovalRequest: ActionHandler = (action, _app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const message = stringProp(props, 'message')
    const { timeout, onTimeout } = props
    const { timeoutSeconds, expiresAt } = deriveTimeout(timeout)

    yield* insertApprovalRequest({
      message,
      timeoutSeconds,
      expiresAt,
      runId: automation.runId,
      stepIndex: runContext?.stepIndex ?? 0,
    })

    return {
      // `pause: true` SUSPENDS the run: the step records as a success
      // (surfacing `output.status: 'pending'`), but the run loop withholds every
      // subsequent action and persists `waiting-approval` until an approver
      // resolves the request via the run-scoped endpoint.
      status: 'success',
      pause: true,
      output: {
        status: 'pending',
        ...(typeof timeout === 'string' ? { timeout } : {}),
        ...(typeof onTimeout === 'string' ? { onTimeout } : {}),
      },
    } as const satisfies ActionOutcome
  })
