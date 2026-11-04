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
 * collapse to 404 here for the same reason. Past it, the press is judged on
 * the record: a `visibleWhen` that does not hold answers 404, as an absent
 * button does, and a `disabledWhen` that holds answers 409 with the reason.
 *
 * A run still waiting for a concurrency slot, or still running, when the
 * request's time budget runs out (`runAnswerBudgetMs`) is answered `202` with
 * its run id and whether it is queued or running; it goes on in the
 * background and completes. Holding the request longer would let the
 * listener's idle guard cut it, and the press would read as a failure.
 */

import { Effect, Fiber, Option } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log-emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { runErrorAsSeenBy } from '@/application/use-cases/automations/run-admin-only-output'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  triggerAcceptedResponseSchema,
  triggerResponseSchema,
} from '@/domain/models/api/automations/automations'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { pressDisabledResponse } from '@/presentation/api/runtime/press-disabled-response'
import { runAnswerBudgetMs } from '@/presentation/api/runtime/run-answer-budget'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import { refuseUnlistedRow } from './readable-table-gate'
import { formMutationGate, guardForTable, passesUnguardedTableGate } from './row-level-guard'
import type {
  RunAutomationError,
  RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

type SessionContext = ReturnType<typeof getTableContext>['session']

const notFoundResponse = (c: Context): Response => notFound(c)

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

/**
 * Object-level write gate. Returns a 404 response to refuse, `undefined` to
 * proceed. A record the presser's list of the table does not admit is refused
 * as a missing one is.
 */
const enforceButtonWriteGate = (input: Parameters<typeof enforceButtonRoleGate>[0]) =>
  Effect.gen(function* () {
    const refusal = yield* enforceButtonRoleGate(input)
    if (refusal) return refusal
    return yield* refuseUnlistedRow(input.c, input.app, input.context.recordId)
  })

/** The table's write grant and row-level rules on the pressed record. */
const enforceButtonRoleGate = (input: {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly session: SessionContext
  readonly context: {
    readonly tableName: string
    readonly recordId: string
    readonly userRole: string
    readonly userGroups: readonly string[]
  }
}) =>
  Effect.gen(function* () {
    const { c, app, table, session } = input
    const { tableName, recordId, userRole, userGroups } = input.context

    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)
    if (guard) {
      return yield* formMutationGate({ c, table, session, tableName, recordId, guard, op: 'write' })
    }
    return passesUnguardedTableGate(app, table, { userRole, userGroups }, 'write')
      ? undefined
      : notFoundResponse(c)
  })

/**
 * Map a run failure onto an HTTP response, mirroring the manual-trigger
 * route: every "you may not run this / it is not runnable" tag collapses to
 * 404, and only a registry-seed fault — an engine problem, not a caller
 * problem — surfaces as 500.
 */
function buttonRunErrorResponse(c: Context, error: RunAutomationError): Response {
  if (error._tag === 'AutomationPressDisabled') return pressDisabledResponse(c, error.message)
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

/**
 * The press's answer. Its `error` is the run's own as the presser reads it, as
 * a manual trigger answers it (`runErrorAsSeenBy`): whole to an
 * admin-equivalent; to anyone else, a write the database refused for a value
 * another record holds reads as any refused write does, and an admin-only
 * line is painted over.
 */
const buttonResultBody = (result: RunAutomationResult, error: string | undefined) => ({
  success: true,
  id: result.runId,
  status: PUBLIC_RUN_STATUS[result.status] ?? 'failed',
  ...(error === undefined ? {} : { error }),
})

/**
 * Record who pressed which button, on which record, and how the run ended.
 *
 * This is the ONLY durable record of the actor: `system.automation_runs` has
 * no actor column in either dialect, so the caller identity threaded into the
 * run never lands beside it. Emitted AFTER the run so the run id is known,
 * and only past both gates so a refusal leaves no trace to enumerate.
 */
const recordButtonInvocation = (input: {
  readonly userId: string
  readonly recordId: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly succeeded: boolean
}) =>
  Effect.flatMap(resolveActor(input.userId), (actor) =>
    emitAuditEvent({
      action: AUDIT_ACTIONS.TABLE_RECORD_BUTTON_INVOKED,
      actor,
      resourceId: input.recordId,
      severity: 'info',
      result: input.succeeded ? 'success' : 'failure',
      metadata: input.metadata,
    })
  )

export async function handleInvokeRecordButton(c: Context, app: App) {
  const { tableName } = getTableContext(c)
  const fieldName = c.req.param('fieldName')!

  const table = app.tables?.find((t) => t.name === tableName)
  const automationName = resolveButtonAutomation(table, fieldName)
  if (!automationName) return notFoundResponse(c)

  return runHandlerEffect(
    c,
    answerFailures(c, buttonPressResponse({ c, app, table, fieldName, automationName }))
  )
}

/** What a press needs past its gates: who pressed what, on which record. */
interface PressInput {
  readonly c: Context
  readonly app: App
  readonly fieldName: string
  readonly automationName: string
  readonly recordId: string
}

/**
 * Run the pressed automation and record the press once the run ends, as one
 * program that may outlive the request. `progress` is told the run's id when
 * its row lands and again once it holds a slot.
 */
const runAndRecordPress = (
  input: PressInput,
  progress: { readonly persisted: (id: string) => void; readonly admitted: () => void }
) =>
  Effect.gen(function* () {
    const { c, app, fieldName, automationName, recordId } = input
    const { session, tableName, userRole } = getTableContext(c)
    const result = yield* Effect.result(
      runManualAutomation({
        name: automationName,
        app,
        userRole,
        // The record the button was pressed on rides in as the manual trigger's
        // input payload, reachable from action templates as
        // `{{trigger.data.input.recordId}}`.
        triggerData: { input: { table: tableName, recordId, field: fieldName } },
        userId: session.userId,
        // Past the dispatch, write and role gates: the button's `visibleWhen`
        // (hidden answers 404) and `disabledWhen` (409), judged on this record.
        press: { table: tableName, recordId, control: `field:${fieldName}` },
        onPersisted: progress.persisted,
        onAdmitted: progress.admitted,
      })
    )
    if (result._tag === 'Failure') return result

    const error = runErrorAsSeenBy(app, {
      automationName,
      readsWhole: isAdminEquivalent(userRole, app),
      result: result.success,
    })
    const body = buttonResultBody(result.success, error)
    yield* recordButtonInvocation({
      userId: session.userId,
      recordId,
      metadata: {
        table: tableName,
        field: fieldName,
        automation: automationName,
        runId: result.success.runId,
        runStatus: result.success.status,
      },
      succeeded: body.status !== 'failed',
    })
    return { _tag: 'Answered' as const, body }
  })

/**
 * Start the press's run in the background and wait for it up to the time
 * budget: its outcome when it ends in time, else `202` with the run's id and
 * whether it still waits for a slot or already runs.
 */
const runPressWithinBudget = (input: PressInput) =>
  Effect.gen(function* () {
    const { c } = input
    const progress: { runId?: string; admitted: boolean } = { admitted: false }
    const bridge = yield* AutomationFiberBridge
    const fiber = yield* Effect.forkDetach(
      bridge.trackBackground(
        runAndRecordPress(input, {
          persisted: (id) => {
            progress.runId = id
          },
          admitted: () => {
            progress.admitted = true
          },
        })
      )
    )
    const inTime = yield* Fiber.join(fiber).pipe(Effect.timeoutOption(runAnswerBudgetMs()))
    // A run with no row yet has no id to follow: wait for its outcome instead.
    const outcome = Option.isSome(inTime)
      ? inTime.value
      : progress.runId === undefined
        ? yield* Fiber.join(fiber)
        : undefined
    if (outcome === undefined) {
      const accepted = {
        runId: progress.runId!,
        status: progress.admitted ? 'running' : 'queued',
      }
      return yield* respondWith(c, Effect.succeed(accepted), triggerAcceptedResponseSchema, 202)
    }
    if (outcome._tag === 'Failure') return buttonRunErrorResponse(c, outcome.failure)
    return yield* respondWith(c, Effect.succeed(outcome.body), triggerResponseSchema)
  })

/** Gate a press, run its automation, and record and answer it, as one program. */
const buttonPressResponse = (input: {
  readonly c: Context
  readonly app: App
  readonly table: Table | undefined
  readonly fieldName: string
  readonly automationName: string
}) =>
  Effect.gen(function* () {
    const { c, app, table, fieldName, automationName } = input
    const { session, tableName, userRole, userGroups } = getTableContext(c)
    const recordId = c.req.param('recordId')!

    const gateError = yield* enforceButtonWriteGate({
      c,
      app,
      table,
      session,
      context: { tableName, recordId, userRole, userGroups },
    })
    if (gateError) return gateError

    return yield* runPressWithinBudget({ c, app, fieldName, automationName, recordId })
  })
