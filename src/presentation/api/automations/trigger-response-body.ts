/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The body a run started by hand answers with — a manual trigger, a page
 * press, a replay — as the caller who started it may read it.
 */

import { runErrorAsSeenBy } from '@/application/use-cases/automations/run-admin-only-output'
import { lastOutputAsSeenBy } from '@/application/use-cases/automations/run-person-address-mask'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { RunAutomationResult } from '@/application/use-cases/automations/run-automation'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Map an engine run status to the public trigger-response status enum. */
const PUBLIC_TRIGGER_STATUS: Readonly<Record<string, string>> = {
  success: 'completed',
  'completed-with-errors': 'completed-with-errors',
  skipped: 'skipped',
  cancelled: 'cancelled',
  'waiting-approval': 'waiting-approval',
  'waiting-delay': 'waiting-delay',
}
const toPublicTriggerStatus = (s: RunAutomationResult['status']): string =>
  PUBLIC_TRIGGER_STATUS[s] ?? 'failed'

/**
 * Map a `RunAutomationResult` (engine-internal: `success`/`failure`) into the
 * public trigger-response body. The public contract uses `'completed' |
 * 'failed'` to align with `system.automation_runs.status` and surfaces the
 * run identifier as `id` (matches the runs API).
 *
 * Surfaces only the **last action's output** as `output`, mirroring
 * n8n's "When Last Node Finishes" mode. Per-action visibility lives at
 * `GET /api/automations/runs/:id`. `output` is omitted when no action
 * produced output (filter-only / state-set-only runs).
 *
 * `'completed-with-errors'` and the two waits (`'waiting-approval'`,
 * `'waiting-delay'`) are surfaced verbatim so callers can tell a
 * degraded happy path (a `continueOnError` action failed) from both a clean
 * completion and a hard failure; the engine's failure/exhausted/timed-out
 * variants collapse to `'failed'`. When the run failed, the redacted `error`
 * string is surfaced so callers need no follow-up GET.
 */
const triggerResultBody = (
  result: RunAutomationResult,
  seen: { readonly output: unknown; readonly error: string | undefined }
) => ({
  success: true,
  id: result.runId,
  status: toPublicTriggerStatus(result.status),
  ...(seen.output !== undefined ? { output: seen.output } : {}),
  ...(seen.error !== undefined ? { error: seen.error } : {}),
})

/**
 * True when the signed-in caller of this request is an admin-equivalent. The
 * run has already happened by the time this is asked, so a role that cannot be
 * read is not a failed request — it is a reader shown the masked body.
 */
const callerIsAdmin = async (c: Context, app: App): Promise<boolean> => {
  const userId = getSessionContext(c)?.userId
  if (userId === undefined) return false
  const role = await runDomainPromise(c, getUserRole(userId)).catch((cause: unknown) => {
    logError('[automation] trigger response: caller role unreadable, masking the output', cause)
    return undefined
  })
  return role !== undefined && isAdminEquivalent(role, app)
}

/**
 * The trigger-response body of a run started by hand, as its starter reads
 * it: whole for an admin-equivalent; for anyone else, each person a record
 * step expanded keeps its id and name and has its address masked, as the run
 * history shows it to her (`run-step-output-reach.ts`). The run itself
 * already read — and mailed — the full address.
 */
export const triggerResponseAsSeenByCaller = async (
  c: Context,
  app: App,
  input: { readonly automationName: string; readonly result: RunAutomationResult }
) => {
  const { automationName, result } = input
  // Nothing to judge, no role to read: a run with neither an output nor an error.
  const judged = result.lastOutput !== undefined || result.error !== undefined
  const readsWhole = !judged || (await callerIsAdmin(c, app))
  return triggerResultBody(result, {
    output: lastOutputAsSeenBy(app, { automationName, readsWhole, result }),
    error: runErrorAsSeenBy(app, { automationName, readsWhole, result }),
  })
}
