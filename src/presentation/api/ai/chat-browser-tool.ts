/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { runBrowserUse } from '@/application/use-cases/agents/browser-use'
import { BROWSER_USE_TOOL } from '@/application/use-cases/automations/action-handlers/browser-agent-tools'
import { buildChatToolDefinitions } from '@/domain/models/app/agents/ai-chat-tools'
import { logError } from '@/infrastructure/logging/logger'
import type { AgentTurnBinding } from './agent-chat'
import type { ToolCallingInput } from './chat-tool-calling'
import type { ChatToolCall, ChatToolDefinition } from '@/application/ports/services/ai-service'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * The `browser.use` agent tool on the chat surface: advertised as
 * `browser_use` to a declared agent granted both `browser.use` and
 * `tools.browser`, and run when the model calls it. Every limit is held by
 * `runBrowserUse` and the browser driver, never by this route.
 */

/** The declared agent a turn is bound to, when it may use the browser. */
const browserAgentOf = (app: App | undefined, agentName: string | undefined): Agent | undefined => {
  if (agentName === undefined) return undefined
  const agent = app?.agents?.find((candidate) => candidate.name === agentName)
  return agent?.tools?.actions.includes('browser.use') === true && agent.tools.browser !== undefined
    ? agent
    : undefined
}

/** The tools a turn advertises: one per readable table, and `browser_use` when granted. */
export const buildTurnTools = (
  toolDefs: Parameters<typeof buildChatToolDefinitions>[0],
  app: App | undefined,
  agent: AgentTurnBinding | undefined
): ReadonlyArray<ChatToolDefinition> => [
  ...buildChatToolDefinitions(toolDefs),
  ...(agent?.builtIn !== true && browserAgentOf(app, agent?.name) !== undefined
    ? [BROWSER_USE_TOOL]
    : []),
]

/**
 * Run a tool call that is not a table tool: `browser_use` for an agent granted
 * it, an unknown-tool error for anything else.
 */
export const executeOtherTool = async (
  call: ChatToolCall,
  input: ToolCallingInput,
  action: ChatAction
): Promise<{ readonly content: string; readonly action: ChatAction; readonly denied: boolean }> => {
  const agent = call.name === 'browser_use' ? browserAgentOf(input.app, input.agentName) : undefined
  if (agent === undefined) {
    return { content: `Error: unknown tool "${call.name}".`, action, denied: false }
  }
  const args =
    call.arguments !== null && typeof call.arguments === 'object'
      ? (call.arguments as Readonly<Record<string, unknown>>)
      : {}
  const content = await Effect.runPromise(
    runBrowserUse(agent, args).pipe(
      Effect.provide(input.services),
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[ai-chat] browser_use stopped on a defect', cause, { agent: agent.name })
        })
      ),
      // effect-swallow: a defect in the browser ends this one tool call, not the chat turn; the model reads that the browser stopped.
      Effect.catchCause(() => Effect.succeed('error: the browser agent stopped'))
    )
  )
  return { content, action, denied: false }
}
