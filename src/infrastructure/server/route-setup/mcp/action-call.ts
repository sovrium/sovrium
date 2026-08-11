/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * MCP `tools/call` dispatcher for action templates (M-9).
 *
 * Translates a JSON-RPC `tools/call` invocation of a tool whose name matches
 * `{appName}_action_{templateName}` into a single-step manual automation
 * synthesised on the fly from the action template's `action` body, then
 * runs it through the same `executeAutomationRun` pipeline as manual
 * automations (M-8). This keeps the persistence + handler-dispatch contract
 * identical regardless of whether the side effect is reached via
 * `app.automations[]` or `app.actions[]`.
 *
 * Sibling of `mcp-automation-call.ts` and `mcp-tool-call.ts` — split out so
 * each dispatcher stays under the project-wide 400-line `max-lines` rule and
 * mirrors the conceptual separation between table-record tools (CRUD against
 * `app.tables[]`), automation tools (running a manual workflow defined in
 * `app.automations[]`), and action-template tools (invoking a single
 * preconfigured action declared in `app.actions[]`).
 *
 * Wire-input gates enforced before dispatch:
 *
 *  - `fieldExposure: 'whitelist'` + extra parameter → -32602 (the same input
 *    contract advertised in `tools/list` is enforced again at call time so a
 *    hand-crafted payload can't bypass the discovery surface).
 *  - `fieldExposure: 'whitelist'` + missing whitelisted parameter → -32602
 *    (the schema author declared every whitelisted field as required;
 *    optional inputs would be expressed via `template.variables` defaults
 *    instead, which the run-time substitution would resolve transparently).
 *
 * Synthesised-automation naming: `mcp-action:{templateName}`. The colon is
 * intentional — automation names declared in `app.automations[]` use the
 * same kebab pattern as action templates, so prefixing with `mcp-action:`
 * guarantees no collision with a user-declared automation. The seeded row
 * in `system.automation_definitions` is idempotent (findByName before
 * create), so repeated invocations reuse the same FK.
 *
 * Variable substitution: caller args become the Handlebars context for
 * `{{varName}}` placeholders in the template's action body. Pre-substituted
 * before the run loop so the action handler sees concrete literals — the
 * run loop's own `{{trigger.data.X}}` substitution then becomes a no-op for
 * these tools (no `{{...}}` remains). Caller args are also forwarded as
 * `triggerData.body` so cross-cutting `{{trigger.data.X}}` references in
 * any nested action sub-shape continue to resolve.
 */

import { Effect } from 'effect'
import { type Context } from 'hono'
import { defaultActionHandlers } from '@/application/use-cases/automations/action-handlers'
import { resolveTriggerInValue } from '@/application/use-cases/automations/resolve-trigger-data'
import {
  executeAutomationRun,
  resolveAutomationId,
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { jsonRpcError, jsonRpcSuccess } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { App } from '@/domain/models/app'
import type { ActionTemplate } from '@/domain/models/app/actions'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

const ACTION_INFIX = '_action_'

/**
 * Detect whether a tool name targets an action template. Returns the
 * resolved {template} when the name matches the
 * `{appName}_action_{templateName}` pattern AND the named template has
 * aiAccess declared. Returns `undefined` to signal "not an action-template
 * tool" — the caller falls back to the table-record dispatcher.
 *
 * The aiAccess precondition mirrors the discoverability logic in
 * `compileActionTemplateTools` so a tool name that was never advertised in
 * `tools/list` cannot be resurrected by a hand-crafted `tools/call` payload.
 */
export const resolveActionTemplateTool = (
  app: App,
  toolName: string
): ActionTemplate | undefined => {
  const prefix = `${app.name}${ACTION_INFIX}`
  if (!toolName.startsWith(prefix)) return undefined
  const templateName = toolName.slice(prefix.length)
  if (templateName.length === 0) return undefined

  const template = (app.actions ?? []).find((t) => t.name === templateName)
  if (template === undefined) return undefined
  if (!isAiAccessEnabled(template.aiAccess)) return undefined
  return template as ActionTemplate
}

/**
 * Validate caller args against the template's `aiAccess.whitelistFields`
 * when whitelist mode is set. Returns the first violating field name, or
 * `undefined` when every arg is allowed.
 *
 * Mirrors `findFirstWhitelistViolation` in `mcp-tool-call.ts` but operates
 * on action-template aiAccess (which lives at `template.aiAccess`, not
 * `table.aiAccess`).
 */
const findFirstWhitelistViolation = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): string | undefined => {
  const access = template.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const allowed = new Set(access.whitelistFields ?? [])
  return Object.keys(args).find((name) => !allowed.has(name))
}

/**
 * Validate that every required (whitelisted) parameter is present in the
 * caller args. When whitelist mode is set, every whitelisted field is
 * required at the wire level — optional inputs must be expressed via
 * `template.variables` defaults instead. Returns the first missing field
 * name, or `undefined` when every required input is present.
 *
 * The cross-validator `validateAllAiAccessRules` already guarantees that
 * `whitelist` mode without a non-empty `whitelistFields` array fails at
 * decode time, so this function is safe to read `whitelistFields` without
 * a fallback.
 */
const findFirstMissingRequiredParam = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): string | undefined => {
  const access = template.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const required = access.whitelistFields ?? []
  return required.find((name) => !(name in args))
}

/**
 * Synthesise a single-step manual automation from the action template, with
 * caller args pre-substituted into `{{varName}}` placeholders in the
 * template's action body. The resulting automation is fed to
 * `executeAutomationRun` so persistence (run row in `system.automation_runs`,
 * step rows, in-memory store) and handler dispatch follow the exact same
 * code path as a regular manual automation.
 *
 * Pre-substitution uses the caller args directly as the Handlebars context
 * — `{{name}}` resolves to `args.name`, `{{recipient}}` to `args.recipient`,
 * etc. — rather than nesting them under `trigger.data.X`. This matches the
 * schema-author intent: action-template variables are first-class
 * parameters, not trigger-envelope leaves.
 */
const synthesizeAutomation = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): NonNullable<App['automations']>[number] => {
  const substitutedAction = resolveTriggerInValue(template.action, args) as Record<string, unknown>
  const synthName = `mcp-action:${template.name}`
  return {
    name: synthName,
    trigger: { type: 'manual' },
    actions: [substitutedAction],
    enabled: true,
  } as unknown as NonNullable<App['automations']>[number]
}

/**
 * Translate a `runActionTemplate` failure into the appropriate JSON-RPC
 * error code. Action templates don't gate by role themselves (the
 * MCP-level aiAccess + the per-role tool catalog filter in `mcp-routes.ts`
 * already handle that), so the only failures we expect from
 * `executeAutomationRun` are seed errors — everything else is collapsed
 * into a generic -32603.
 */
const actionErrorToJsonRpc = (
  c: Readonly<Context>,
  responseId: number | string,
  error: RunAutomationError
): Response => {
  if (error._tag === 'AutomationRegistrySeedError') {
    return jsonRpcError(c, responseId, -32_603, `Failed to register action template: ${error.name}`)
  }
  return jsonRpcError(c, responseId, -32_603, 'Action template execution failed')
}

/**
 * Build the success body returned in the MCP tool result. Mirrors the
 * automation dispatcher's shape so callers that consume both surfaces see
 * a consistent envelope (`id`, `status`, optional `output`, optional
 * `error`). `id` is the run UUID — correlates with
 * `GET /api/automations/runs/:id`.
 */
const buildActionResultBody = (result: RunAutomationResult) => {
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
 * as `HandleAutomationCallInput` in the automation dispatcher.
 */
export interface HandleActionCallInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly template: ActionTemplate
  readonly envelope: CallEnvelope
}

/**
 * Public entry point. Validates the caller args against the template's
 * whitelist (when declared), synthesises a one-step manual automation, and
 * runs it through the same Effect program the manual-trigger HTTP route
 * uses, with the runtime layer providing every infrastructure dependency
 * the action handlers need.
 *
 * Always returns a 200 HTTP response carrying a JSON-RPC envelope —
 * authorization and runtime failures are surfaced as -32602 / -32603
 * errors per MCP convention.
 */
export const handleActionCall = async (input: HandleActionCallInput): Promise<Response> => {
  const { c, app, caller, template, envelope } = input

  const extra = findFirstWhitelistViolation(template, envelope.args)
  if (extra !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Parameter '${extra}' is not in aiAccess.whitelistFields`
    )
  }
  const missing = findFirstMissingRequiredParam(template, envelope.args)
  if (missing !== undefined) {
    return jsonRpcError(c, envelope.responseId, -32_602, `Missing required parameter '${missing}'`)
  }

  const automation = synthesizeAutomation(template, envelope.args)
  const program = Effect.gen(function* () {
    const automationId = yield* resolveAutomationId(automation.name, automation)
    return yield* executeAutomationRun({
      name: automation.name,
      automation,
      automationId,
      app,
      processEnv: process.env,
      triggerData: { body: envelope.args },
      handlers: defaultActionHandlers,
      userId: caller.userId,
    })
  })

  const provided = provideAutomationRuntime(program)
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    return actionErrorToJsonRpc(c, envelope.responseId, outcome.left)
  }
  return jsonRpcSuccess(c, envelope.responseId, buildActionResultBody(outcome.right))
}
