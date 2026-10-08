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
 * Variable substitution: the template is filled in ONCE, before the run
 * (`fillInvokedTemplateAction`): `{{varName}}` and `{{trigger.data.varName}}`
 * read a caller arg, a `$varName` a declared parameter, `$env.X` the app's
 * env. A caller arg is a value the template pass inserts without parsing it,
 * and the run executes the filled action with its props FINAL, so no step
 * reads an arg again for `$env.` or `{{...}}`. An arg is placed by position,
 * as run data is in any step (one URL segment or query value, one JSON string,
 * text in an email body, exactly one recipient); one that cannot be placed
 * safely is a -32602 before any run is synthesised, so nothing is sent.
 * Caller args are also forwarded as `triggerData.body` for the run's history.
 */

import { Effect } from 'effect'
import { TemplateEngine, type TemplateRenderer } from '@/application/ports/services/template-engine'
import { defaultActionHandlers } from '@/application/use-cases/automations/action-handlers'
import { buildEnvLookup } from '@/application/use-cases/automations/resolve-env-vars'
import {
  fillInvokedTemplateAction,
  type FilledTemplateAction,
} from '@/application/use-cases/automations/run/prop-substitution'
import {
  executeAutomationRun,
  resolveAutomationId,
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { isAiAccessEnabled } from '@/domain/models/app/auth/ai-access'
import { runOnDomain } from '@/infrastructure/logging/request-effect'
import { toolFailure, toolSuccess, type McpToolResult } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { RuntimeActionTemplate } from '@/application/use-cases/automations/run/types'
import type { App } from '@/domain/models/app'
import type { ActionTemplate } from '@/domain/models/app/actions'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
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

/** The parameters a template's tool declares: its whitelist, else its variables. */
const declaredParameterNames = (template: ActionTemplate): ReadonlyArray<string> => {
  const access = template.aiAccess
  return typeof access === 'object' && access.fieldExposure === 'whitelist'
    ? (access.whitelistFields ?? [])
    : Object.keys(template.variables ?? {})
}

/**
 * Fill the action template in once with the caller args (see the module
 * header), by position: an arg that cannot be placed safely comes back as a
 * `refusal`, and nothing runs.
 */
const fillTemplate = (
  app: App,
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): FilledTemplateAction =>
  fillInvokedTemplateAction({
    // The decoded template, read as the run loop reads `app.actions[]`.
    template: template as unknown as RuntimeActionTemplate,
    args,
    parameterNames: declaredParameterNames(template),
    envLookup: buildEnvLookup(app.env, process.env),
    templates,
  })

/**
 * Synthesise a single-step manual automation from the filled action. The
 * resulting automation is fed to `executeAutomationRun` with `propsFinal`, so
 * persistence (run row in `system.automation_runs`, step rows, in-memory
 * store) and handler dispatch follow the exact same code path as a regular
 * manual automation, without a second pass over the filled props.
 */
const synthesizeAutomation = (
  template: ActionTemplate,
  filledAction: Readonly<Record<string, unknown>>
): NonNullable<App['automations']>[number] =>
  ({
    name: `mcp-action:${template.name}`,
    trigger: { type: 'manual' },
    actions: [filledAction],
    enabled: true,
  }) as unknown as NonNullable<App['automations']>[number]

/**
 * Translate a `runActionTemplate` failure into the appropriate JSON-RPC
 * error code. Action templates don't gate by role themselves (the
 * MCP-level aiAccess + the per-role tool catalog filter in `mcp-routes.ts`
 * already handle that), so the only failures we expect from
 * `executeAutomationRun` are seed errors — everything else is collapsed
 * into a generic -32603.
 */
const actionErrorToJsonRpc = (error: RunAutomationError): never => {
  if (error._tag === 'AutomationRegistrySeedError') {
    return toolFailure(-32_603, `Failed to register action template: ${error.name}`)
  }
  return toolFailure(-32_603, 'Action template execution failed')
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
  readonly domainContext: DomainContext
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
export const handleActionCall = async (input: HandleActionCallInput): Promise<McpToolResult> => {
  const { app, caller, template, envelope } = input

  const extra = findFirstWhitelistViolation(template, envelope.args)
  if (extra !== undefined) {
    return toolFailure(-32_602, `Parameter '${extra}' is not in aiAccess.whitelistFields`)
  }
  const missing = findFirstMissingRequiredParam(template, envelope.args)
  if (missing !== undefined) {
    return toolFailure(-32_602, `Missing required parameter '${missing}'`)
  }

  const program = Effect.gen(function* () {
    const filled = fillTemplate(app, template, envelope.args, yield* TemplateEngine)
    const { refusal } = filled
    if (refusal !== undefined) return { _tag: 'Refused', refusal } as const
    const automation = synthesizeAutomation(template, filled.action)
    const automationId = yield* resolveAutomationId(automation.name, automation)
    const run = yield* executeAutomationRun({
      name: automation.name,
      automation,
      automationId,
      app,
      processEnv: process.env,
      triggerData: { body: envelope.args },
      handlers: defaultActionHandlers,
      userId: caller.userId,
      // An action template is called by a person: its record actions write as them.
      startedByHand: true,
      // Filled in once above: no step reads a caller arg again.
      propsFinal: true,
    })
    return { _tag: 'Ran', run } as const
  })

  // See `automation-call.ts`: an MCP tool call reaches the server's services
  // through the mount-time context, never through a rebuilt layer.
  const outcome = await runOnDomain(input.domainContext, Effect.result(program))

  if (outcome._tag === 'Failure') {
    return actionErrorToJsonRpc(outcome.failure)
  }
  // An arg that cannot be placed safely: no run was synthesised, nothing sent.
  if (outcome.success._tag === 'Refused') return toolFailure(-32_602, outcome.success.refusal)
  return toolSuccess(buildActionResultBody(outcome.success.run))
}
