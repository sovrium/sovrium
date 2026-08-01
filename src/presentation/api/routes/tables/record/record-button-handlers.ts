/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { hasUpdatePermission } from '@/application/use-cases/tables/permissions/permissions'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
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

function resolveButtonAutomation(table: Table | undefined, fieldName: string): string | undefined {
  const field = table?.fields?.find((f) => f.name === fieldName)
  return isInvocableButton(field) ? field.automation : undefined
}

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

function buttonRunErrorResponse(c: Context, error: RunAutomationError): Response {
  if (error._tag === 'AutomationRegistrySeedError') {
    return c.json({ success: false, message: 'Failed to run the automation' }, 500)
  }
  return notFoundResponse(c)
}

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

async function recordButtonInvocation(input: {
  readonly userId: string
  readonly recordId: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly succeeded: boolean
}): Promise<void> {
  const actor = await resolveActor(input.userId)
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
    triggerData: { input: { table: tableName, recordId, field: fieldName } },
    userId: session.userId,
  })
  const result = await runRequestEffect(c, Effect.either(provideAutomationLive(program)))

  if (result._tag === 'Left') return buttonRunErrorResponse(c, result.left)

  const body = buttonResultBody(result.right)
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
