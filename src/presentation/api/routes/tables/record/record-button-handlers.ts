/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `POST /api/tables/:tableId/records/:recordId/buttons/:fieldName`
 *
 * Runs the automation named by a `type: 'button'`, `action: 'automation'`
 * field, against the record the button was pressed on.
 *
 * Two independent gates gate every invocation, and both answer 404:
 *
 *   1. **Dispatch.** The named field must exist, be a button, and carry
 *      `action: 'automation'`. A `url` button has no server-side dispatch —
 *      it navigates client-side — so it is as absent here as a text field or
 *      a name that was never configured. All three answer identically so the
 *      response never reveals which fields a table has.
 *
 *   2. **Object-level write.** Pressing the button hands the automation the
 *      record and lets it mutate the row, so it demands exactly what an
 *      UPDATE demands. Tables declaring `rowLevelPermissions` route through
 *      the same per-row gate the form-update verb uses; the rest fall back to
 *      the coarse role check, as every other write verb does.
 *
 * Denials are 404 rather than 403 throughout (S1 anti-enumeration): an
 * authorization boundary must be indistinguishable from an absent record.
 *
 * The automation's own `manual` trigger gate still applies on top — its
 * `requiredRole` is enforced inside `runManualAutomation` and its refusals
 * collapse to 404 here for the same reason.
 */

import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { hasUpdatePermission } from '@/domain/validators/permission-evaluators'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAutomationLive } from '@/presentation/api/routes/automations/effect-runner'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { enforceFormMutationGate, resolveGuardForTable } from './row-level-guard'
import type {
  RunAutomationError,
  RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type SessionContext = ReturnType<typeof getTableContext>['session']

const notFoundResponse = (c: Context): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

/**
 * The narrow shape this route dispatches on. Checked structurally rather than
 * by narrowing the `Field` union, whose open catch-all member erases the
 * button-specific keys under a `type === 'button'` test.
 */
interface InvocableButtonField {
  readonly type: 'button'
  readonly action: 'automation'
  readonly automation: string
}

const isInvocableButton = (field: unknown): field is InvocableButtonField => {
  const candidate = field as Partial<InvocableButtonField> | undefined
  return (
    candidate?.type === 'button' &&
    candidate.action === 'automation' &&
    typeof candidate.automation === 'string'
  )
}

/**
 * Resolve the automation a button field dispatches to, or `undefined` when
 * the field is not an invocable automation button. Deliberately collapses
 * every "no dispatch" reason into one value — the caller must not be able to
 * tell a url button from a text field from a name that was never configured.
 */
function resolveButtonAutomation(table: Table | undefined, fieldName: string): string | undefined {
  const field = table?.fields?.find((f) => f.name === fieldName)
  return isInvocableButton(field) ? field.automation : undefined
}

/** Object-level write gate. Returns a 404 response to refuse, `undefined` to proceed. */
async function enforceButtonWriteGate(input: {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: SessionContext
  readonly context: {
    readonly tableName: string
    readonly recordId: string
    readonly userRole: string
  }
}): Promise<Response | undefined> {
  const { c, app, table, session } = input
  const { tableName, recordId, userRole } = input.context

  const guard = await resolveGuardForTable(session, userRole, table, app)
  if (guard) {
    return enforceFormMutationGate({ c, table, session, tableName, recordId, guard, op: 'write' })
  }
  return hasUpdatePermission(table, userRole, app.tables) ? undefined : notFoundResponse(c)
}

/**
 * Map a run failure onto an HTTP response, mirroring the manual-trigger
 * route: every "you may not run this / it is not runnable" tag collapses to
 * 404, and only a registry-seed fault — an engine problem, not a caller
 * problem — surfaces as 500.
 */
function buttonRunErrorResponse(c: Context, error: RunAutomationError): Response {
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to run the automation' }, 500)
  }
  return notFoundResponse(c)
}

/** Map an engine run status onto the public trigger-response vocabulary. */
const PUBLIC_RUN_STATUS: Readonly<Record<string, string>> = {
  success: 'completed',
  'completed-with-errors': 'completed-with-errors',
  skipped: 'skipped',
  cancelled: 'cancelled',
  'waiting-approval': 'waiting-approval',
}

const buttonResultBody = (result: RunAutomationResult) => ({
  success: true,
  id: result.runId,
  status: PUBLIC_RUN_STATUS[result.status] ?? 'failed',
  ...(result.error === undefined ? {} : { error: result.error }),
})

/**
 * Record who pressed which button, on which record, and how the run ended.
 *
 * This is the ONLY durable record of the actor: `system.automation_runs` has
 * no actor column in either dialect, so the caller identity threaded into the
 * run never lands beside it. Emitted AFTER the run so the run id is known,
 * and only past both gates so a refusal leaves no trace to enumerate.
 */
async function recordButtonInvocation(input: {
  readonly userId: string
  readonly recordId: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly succeeded: boolean
}): Promise<void> {
  const actor = await resolveActor(input.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.TABLE_RECORD_BUTTON_INVOKED,
    actor,
    resourceId: input.recordId,
    severity: 'info',
    result: input.succeeded ? 'success' : 'failure',
    metadata: input.metadata,
  })
}

export async function handleInvokeRecordButton(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const fieldName = c.req.param('fieldName')!

  const table = app.tables?.find((t) => t.name === tableName)
  const automationName = resolveButtonAutomation(table, fieldName)
  if (!automationName) return notFoundResponse(c)

  const gateError = await enforceButtonWriteGate({
    c,
    app,
    table,
    session,
    context: { tableName, recordId, userRole },
  })
  if (gateError) return gateError

  const program = runManualAutomation({
    name: automationName,
    app,
    processEnv: process.env,
    userRole,
    // The record the button was pressed on rides in as the manual trigger's
    // input payload, reachable from action templates as
    // `{{trigger.data.input.recordId}}`.
    triggerData: { input: { table: tableName, recordId, field: fieldName } },
    userId: session.userId,
  })
  const result = await runRequestEffect(c, Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') return buttonRunErrorResponse(c, result.left)

  const body = buttonResultBody(result.right)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect
  await recordButtonInvocation({
    userId: session.userId,
    recordId,
    metadata: {
      table: tableName,
      field: fieldName,
      automation: automationName,
      runId: result.right.runId,
      runStatus: result.right.status,
    },
    succeeded: body.status !== 'failed',
  })

  return c.json(body, 200)
}
