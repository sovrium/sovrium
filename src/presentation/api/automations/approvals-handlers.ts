/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/automations/approvals` and the caller lookup the approval
 * endpoints share.
 *
 * The list answers only the automation-step requests the signed-in caller may
 * resolve — the rule the resolution endpoint enforces — so a page table bound
 * to it (`rowsKey: approvals`, `idKey: approvalId`) is each person's own inbox,
 * and every row carries the `runId` and `approvalId` its Approve and Reject
 * buttons post to.
 */

import { Effect, Result, Schema } from 'effect'
import {
  listAutomationApprovals,
  loadApprovalCaller,
  type ListedApproval,
} from '@/application/use-cases/automations/list-automation-approvals'
import {
  listAutomationApprovalsQuerySchema,
  listAutomationApprovalsResponseSchema,
} from '@/domain/models/api/automations/automations'
import { toApproverList } from '@/domain/models/app/automations/actions/approval/approver-validation'
import { requireSession, validationError } from '@/presentation/api/runtime/auth-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import { approvalsAsSeenByCaller } from './run-step-output-reach'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Resolve the signed-in caller for the approver rule, or the response to send
 * instead: the canonical 401 when there is no session, the sanitized error
 * envelope when the account store did not answer.
 */
export const resolveApprovalCaller = (c: Context) =>
  Effect.gen(function* () {
    const auth = requireSession(c)
    if (!auth.ok) return { ok: false, response: auth.response } as const
    const loaded = yield* Effect.result(loadApprovalCaller(auth.session.userId))
    if (loaded._tag === 'Failure') {
      return { ok: false, response: toErrorResponse(c, loaded.failure) } as const
    }
    return { ok: true, caller: loaded.success } as const
  })

const toWireApproval = (row: ListedApproval) => ({
  approvalId: row.id,
  runId: row.runId,
  automationName: row.automationName,
  status: row.status,
  message: row.message,
  approvers: toApproverList(row.approvers),
  requestedAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
  resolvedAt: row.respondedAt === null ? null : row.respondedAt.toISOString(),
})

/**
 * Handle GET /api/automations/approvals?status=pending|approved|rejected
 *
 * `status` defaults to `pending`. 401 without a session; 400 for any other
 * status value.
 */
export function handleListApprovals(c: Context, app: App): Promise<Response> {
  return runHandlerEffect(c, answerFailures(c, listApprovalsProgram(c, app)))
}

const listApprovalsProgram = (c: Context, app: App) =>
  Effect.gen(function* () {
    const resolved = yield* resolveApprovalCaller(c)
    if (!resolved.ok) return resolved.response

    const query = Schema.decodeUnknownResult(listAutomationApprovalsQuerySchema)({
      status: c.req.query('status'),
    })
    if (Result.isFailure(query)) {
      return validationError(c, [
        { field: 'status', message: 'status must be one of pending, approved, rejected' },
      ])
    }

    const program = listAutomationApprovals({
      status: query.success.status ?? 'pending',
      caller: resolved.caller,
      app,
    })
    const listed = yield* program
    // A message is rendered from what its run carries: judged as the request
    // step's output is, for a reader who does not read every run.
    const seen = yield* approvalsAsSeenByCaller(c, app, { readsEveryRun: false, approvals: listed })
    // S4: the body leaves through its published contract.
    return yield* respondWith(
      c,
      Effect.succeed({ approvals: seen.map(toWireApproval) }),
      listAutomationApprovalsResponseSchema
    )
  })
