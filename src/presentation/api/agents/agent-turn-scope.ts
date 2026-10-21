/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The principal a DECLARED agent's chat turn acts as — one rule for every road
 * that runs one: `POST /api/ai/chat` and its stream with an `agent`, and the
 * edit and regenerate of a stored conversation held with one.
 */

import { requireDomainContext } from '@/infrastructure/logging/request-effect'
import { mayTriggerAgentNamed } from '@/presentation/api/agents/agent-trigger-guard'
import { findDeclaredAgent, resolveAgentTurnBinding, type AgentTurnBinding } from './agent-chat'
import { agentCaller, agentReader, type ChatReader } from './chat-read-scope'
import { toToolCallTables } from './chat-tool-calling'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** The binding of an agent-bound turn and the principal its tools read as. */
export interface AgentTurnScope {
  readonly binding: AgentTurnBinding
  readonly userRole: string
  readonly effectiveRoles: readonly string[]
  readonly reader: ChatReader
}

/**
 * The scope of a turn with the declared agent `agentName`, or `undefined` when
 * the app declares no such agent or the caller may not trigger it — both read
 * as an agent that does not exist.
 *
 * A DECLARED agent acts under its declared role, not the caller's — that is
 * what makes an agent's reach a property of the config rather than of whoever
 * happens to be chatting with it. An agent has no user identity and therefore
 * no group memberships, so its effective-role list is its declared role alone:
 * widening this to the CALLER's groups would be a privilege escalation, not a
 * group-awareness fix.
 *
 * Its reach is a ceiling, never a grant to its caller: when a signed-in person
 * chats with it, its tools read the intersection of its reach and hers
 * (`agentReader`), so an admin-role agent never hands a member a row her
 * row-level rule hides or a field she may not read. A visitor signed in to
 * nothing, using an agent open to everyone, reads the anonymous reach
 * (`agentCaller`).
 *
 * The tables its prompt describes are built here, per turn, from that same
 * reader: the ones its tools read for her, with the fields both may read. A
 * table she may not read or whose list admits her no row is named nowhere in
 * what the model is sent.
 */
export const resolveDeclaredAgentTurnScope = async (
  c: Context,
  app: App,
  agentName: string
): Promise<AgentTurnScope | undefined> => {
  const agent = findDeclaredAgent(app, agentName)
  // Its trigger grant, as on every road into an agent; refused as undeclared.
  if (agent === undefined || !(await mayTriggerAgentNamed(c, app, agentName))) return undefined
  const reader = agentReader(agent.role, await agentCaller(c, app))
  const tables = await toToolCallTables(requireDomainContext(c), app, reader)
  const binding = resolveAgentTurnBinding(app, agent, tables)
  return { binding, userRole: binding.role, effectiveRoles: [binding.role], reader }
}
