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
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { toApproverList } from '@/domain/models/app/automations/actions/approval/approver-validation'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { requireSession, validationError } from '@/presentation/api/runtime/auth-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { ApprovalCaller } from '@/domain/models/app/automations/actions/approval/approver-validation'
import type { Context } from 'hono'

/**
 * Resolve the signed-in caller for the approver rule, or the response to send
 * instead: the canonical 401 when there is no session, the sanitized error
 * envelope when the account store did not answer.
 */
export const resolveApprovalCaller = async (
  c: Context
): Promise<
  | { readonly ok: true; readonly caller: ApprovalCaller }
  | { readonly ok: false; readonly response: Response }
> => {
  const auth = requireSession(c)
  if (!auth.ok) return { ok: false, response: auth.response }
  const loaded = await runRequestEffect(
    c,
    Effect.result(provideDomain(c, loadApprovalCaller(auth.session.userId)))
  )
  if (loaded._tag === 'Failure') return { ok: false, response: toErrorResponse(c, loaded.failure) }
  return { ok: true, caller: loaded.success }
}

/* eslint-disable unicorn/no-null -- the wire row declares these timestamps nullable */
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
/* eslint-enable unicorn/no-null */

/**
 * Handle GET /api/automations/approvals?status=pending|approved|rejected
 *
 * `status` defaults to `pending`. 401 without a session; 400 for any other
 * status value.
 */
export async function handleListApprovals(c: Context, app: App): Promise<Response> {
  const resolved = await resolveApprovalCaller(c)
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
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') return toErrorResponse(c, result.failure)
  // S4: the body leaves through its published contract.
  const body = { approvals: result.success.map(toWireApproval) }
  return c.json(decodeOrThrow(listAutomationApprovalsResponseSchema)(body), 200)
}
