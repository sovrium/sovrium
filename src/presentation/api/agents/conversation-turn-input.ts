/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat turn a stored conversation continues: an edited question, or a
 * regenerated answer.
 *
 * It is built the way `POST /api/ai/chat` builds a turn, from the agent the
 * conversation was held with:
 *
 *  - a DECLARED agent acts under the scope every agent-bound chat turn takes
 *    (`resolveDeclaredAgentTurnScope`): its declared role, capped by the
 *    caller's own reach, and only while she may still trigger it — an agent she
 *    may no longer trigger is answered as one that does not exist;
 *  - a generic conversation reads as the caller, with the per-request context
 *    prompt rebuilt for her current role.
 */

import { requireDomainContext } from '@/infrastructure/logging/request-effect'
import { resolveDeclaredAgentTurnScope } from './agent-turn-scope'
import { buildChatContextPrompt } from './chat-context-prompt'
import { resolveUserPrincipal } from './chat-read-scope'
import type { ChatTurnInput } from './chat-turn-completion'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The turn for `question` in the caller's conversation, or `undefined` when
 * the conversation's agent is no longer declared or she may no longer trigger it.
 */
export const resolveConversationTurnInput = async (
  c: Context,
  app: App,
  request: {
    readonly userId: string
    readonly sessionId: string
    readonly question: string
    readonly agentName: string | null
  }
): Promise<ChatTurnInput | undefined> => {
  const turn = {
    services: requireDomainContext(c),
    message: request.question,
    sessionId: request.sessionId,
    actorName: request.userId,
    app,
  }
  if (request.agentName === null) {
    const { userRole, effectiveRoles, reader } = await resolveUserPrincipal(c)
    const caller = { userRole, reader, services: turn.services }
    const systemPrompt = await buildChatContextPrompt(app, caller, undefined)
    return { ...turn, systemPrompt, userRole, effectiveRoles, reader }
  }
  const scope = await resolveDeclaredAgentTurnScope(c, app, request.agentName)
  if (scope === undefined) return undefined
  return {
    ...turn,
    systemPrompt: scope.binding.systemPrompt,
    userRole: scope.userRole,
    effectiveRoles: scope.effectiveRoles,
    reader: scope.reader,
    agent: scope.binding,
  }
}
