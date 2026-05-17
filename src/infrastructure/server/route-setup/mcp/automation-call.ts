/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` dispatcher for manual-trigger automations (M-8).
 *
 * Translates a JSON-RPC `tools/call` invocation of a tool whose name matches
 * `{appName}_automation_{automationName}` into a `runManualAutomation` Effect
 * program, then converts the result into the canonical MCP success / error
 * envelope.
 *
 * Sibling of `mcp-tool-call.ts` — split out to keep both files under the
 * project-wide 400-line `max-lines` rule and to mirror the conceptual
 * separation between table-record tools (CRUD against `app.tables[]`) and
 * automation tools (running a manual workflow defined in
 * `app.automations[]`).
 *
 * Error mapping mirrors the manual-trigger HTTP route in
 * `presentation/api/routes/automations/index.ts`:
 *   - `AutomationManualRoleRequired` → -32603 (operation not permitted)
 *   - `AutomationNotFound` / `AutomationNotManualTriggered` → -32601
 *   - Anything else (RegistrySeedError, runtime fault) → -32603
 *
 * The role required by the trigger is resolved by `runManualAutomation`
 * itself; we just pass the caller's MCP role through. Static-token callers
 * still produce a meaningful role (admin / member / viewer); OAuth callers
 * map their Better Auth user role through the same path.
 */

import { Effect } from 'effect'
import { type Context } from 'hono'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { jsonRpcError, jsonRpcSuccess } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { App } from '@/domain/models/app'
import type { Automation } from '@/domain/models/app/automations'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

const AUTOMATION_INFIX = '_automation_'

/**
 * Detect whether a tool name targets a manual-trigger automation. Returns
 * the resolved {automation} when the name matches the
 * `{appName}_automation_{automationName}` pattern AND the named automation
 * has aiAccess declared AND its trigger is manual. Returns `undefined` to
 * signal "not an automation tool" — the caller falls back to the
 * table-record dispatcher.
 *
 * The aiAccess + manual-trigger preconditions mirror the discoverability
 * logic in `compileAutomationTools` so a tool name that was never
 * advertised in `tools/list` cannot be resurrected by a hand-crafted
 * `tools/call` payload.
 */
export const resolveAutomationTool = (app: App, toolName: string): Automation | undefined => {
  const prefix = `${app.name}${AUTOMATION_INFIX}`
  if (!toolName.startsWith(prefix)) return undefined
  const automationName = toolName.slice(prefix.length)
  if (automationName.length === 0) return undefined

  const automation = (app.automations ?? []).find((a) => a.name === automationName)
  if (automation === undefined) return undefined
  if (!isAiAccessEnabled(automation.aiAccess)) return undefined
  if (automation.trigger.type !== 'manual') return undefined
  return automation
}

/**
 * Map the MCP caller's bearer-token-derived role into the role string
 * that `runManualAutomation` matches against the trigger's `requiredRole`.
 *
 * The MCP caller role vocabulary (`admin | member | viewer`) is a strict
 * subset of the auth.users.role vocabulary, so the mapping is a no-op
 * pass-through. Centralized here so a future expansion (e.g. custom roles
 * exposed via OAuth) has a single seam to extend.
 */
const callerRoleForManualTrigger = (caller: McpCaller): string => caller.role

/**
 * Translate a `runManualAutomation` failure into the appropriate JSON-RPC
 * error code. Mirrors the HTTP-route mapping in `manualTriggerErrorResponse`
 * but emits JSON-RPC envelopes:
 *
 *   - `AutomationManualRoleRequired` → -32603 (caller authenticated but role
 *     does not satisfy the trigger gate; matches the spec's
 *     "operation not permitted" semantics)
 *   - `AutomationNotFound` / `AutomationNotManualTriggered` → -32601
 *     (defensive — should not fire here because `resolveAutomationTool`
 *     already short-circuits these cases. The dispatcher still maps them
 *     in case the schema reloaded between resolution and execution.)
 *   - `AutomationRegistrySeedError` → -32603 (DB unavailable; the
 *     run-history seed step failed before any action ran)
 */
const automationErrorToJsonRpc = (
  c: Readonly<Context>,
  responseId: number | string,
  error: RunAutomationError
): Response => {
  if (error._tag === 'AutomationManualRoleRequired') {
    return jsonRpcError(
      c,
      responseId,
      -32_603,
      `Operation not permitted: this automation requires the '${error.required}' role`
    )
  }
  if (error._tag === 'AutomationNotFound' || error._tag === 'AutomationNotManualTriggered') {
    return jsonRpcError(c, responseId, -32_601, `Automation not found: ${error.name}`)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return jsonRpcError(c, responseId, -32_603, `Failed to register automation: ${error.name}`)
  }
  // Defensive default — should not fire because RunAutomationError is a
  // closed union, but keeping a fallthrough avoids a TS exhaustiveness
  // hole if the union ever grows.
  return jsonRpcError(c, responseId, -32_603, 'Automation execution failed')
}

/**
 * Build the success body returned in the MCP tool result. Mirrors the public
 * trigger-response body from the HTTP route (`triggerResultBody`) so callers
 * that consume both surfaces see a consistent shape:
 *   - `id` — the run identifier (correlates with `GET /api/automations/runs/:id`)
 *   - `status` — `'completed' | 'failed'` (public-facing alias for
 *     `success` / `failure`)
 *   - `output` — last action's output (DEC-021), omitted when no action
 *     produced output
 *   - `error` — present when the run ended in failure
 */
const buildAutomationResultBody = (result: RunAutomationResult) => {
  const publicStatus: 'completed' | 'failed' = result.status === 'success' ? 'completed' : 'failed'
  return {
    id: result.runId,
    status: publicStatus,
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

/**
 * Bundle the dispatcher inputs into a single record so the public entry
 * point stays under the project-wide `max-params` limit (4). Same pattern
 * as `ExecuteToolInput` in the table-record dispatcher.
 */
export interface HandleAutomationCallInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly automation: Automation
  readonly envelope: CallEnvelope
}

/**
 * Public entry point. Runs the resolved automation through the same
 * application-layer program the HTTP route uses, with the runtime layer
 * providing every infrastructure dependency the action handlers need
 * (state repos, connection repos, table live, etc.).
 *
 * Always returns a 200 HTTP response carrying a JSON-RPC envelope —
 * authorization and runtime failures are surfaced as -32603 errors per
 * MCP convention.
 */
export const handleAutomationCall = async (input: HandleAutomationCallInput): Promise<Response> => {
  const { c, app, caller, automation, envelope } = input
  const program = runManualAutomation({
    name: automation.name,
    app,
    processEnv: process.env,
    userRole: callerRoleForManualTrigger(caller),
    triggerData: { body: envelope.args },
    ...(caller.userId !== undefined ? { userId: caller.userId } : {}),
  })

  const provided = provideAutomationRuntime(program)
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    return automationErrorToJsonRpc(c, envelope.responseId, outcome.left)
  }
  return jsonRpcSuccess(c, envelope.responseId, buildAutomationResultBody(outcome.right))
}
