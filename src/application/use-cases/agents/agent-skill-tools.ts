/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An agent's skills as a turn uses them: the index in the system
 * prompt, and the built-in `load_skill` tool that reads a skill, or one of its
 * files, when the model asks.
 *
 * {@link withAgentSkills} is what the agent runtime does to every turn, on
 * every surface. An agent that lists no skill gets its turn unchanged.
 *
 * `load_skill` is read-only, so it never waits for a human. A refused load —
 * another agent's skill, a path leaving the skill, a missing file — is the
 * tool's result, worded for the model, and the turn goes on.
 */

import { Effect } from 'effect'
import { messageText } from '@/application/ports/services/ai-service'
import {
  loadedSkillText,
  loadSkillToolDefinition,
  LOAD_SKILL_TOOL_NAME,
  parseLoadSkillArguments,
  skillIndexText,
} from '@/domain/models/app/agents/skill-tool-service'
import { listAgentSkills, loadAgentSkill, loadSkillReference } from './agent-skills'
import type { AgentTurnTools, OtherToolResult } from './agent-tool-call'
import type {
  ChatMessage,
  ChatToolCall,
  ChatToolDefinition,
} from '@/application/ports/services/ai-service'

/** The agent fields this module reads. */
interface SkilledAgent {
  readonly name: string
  readonly skills?: readonly string[] | undefined
}

/** A turn, with the agent's skills added. */
export interface AgentSkillTurn<R> {
  /** The conversation, its system prompt carrying the skill index. */
  readonly messages: ReadonlyArray<ChatMessage>
  /** The definitions to advertise, after the turn's own. */
  readonly toolDefinitions: ReadonlyArray<ChatToolDefinition>
  readonly tools: AgentTurnTools<R>
}

/**
 * The conversation with the index in its system prompt: appended to the first
 * system message when it is text, otherwise placed before everything. A
 * conversation already carrying it — a turn resumed after an approval — is
 * left as it is.
 */
const withSkillIndex = (
  messages: ReadonlyArray<ChatMessage>,
  index: string
): ReadonlyArray<ChatMessage> => {
  if (messages.some((message) => messageText(message.content).includes(index))) return messages
  const first = messages.findIndex((message) => message.role === 'system')
  const system = messages[first]
  if (system === undefined || typeof system.content !== 'string') {
    return [{ role: 'system', content: index }, ...messages]
  }
  return messages.with(first, { ...system, content: `${system.content}\n\n${index}` })
}

/** What the model reads for one `load_skill` call. */
const runLoadSkill = (agent: SkilledAgent, call: ChatToolCall): Effect.Effect<OtherToolResult> => {
  const request = parseLoadSkillArguments(call.arguments)
  if (request.kind === 'invalid') {
    return Effect.succeed({ content: `Error: ${request.message}`, denied: false, failed: true })
  }
  const read =
    request.kind === 'skill'
      ? Effect.map(loadAgentSkill(agent, request.name), loadedSkillText)
      : loadSkillReference(agent, request.name, request.path)
  return read.pipe(
    Effect.match({
      onSuccess: (content): OtherToolResult => ({ content, denied: false }),
      // A refusal is not a denied action: it is the answer, and the turn goes on.
      onFailure: (error): OtherToolResult => ({
        content: `Error: ${error.message}`,
        denied: false,
        failed: true,
      }),
    })
  )
}

/**
 * Add `agent`'s skills to a turn: the index joins the system prompt, and
 * `load_skill` is advertised and run through `runOther`. Any other call goes
 * to the turn's own `runOther`, unchanged.
 *
 * `toolDefinitions` leaves `load_skill` out when the turn already advertises
 * it, so a turn resumed with the definitions it paused with is not offered it
 * twice.
 */
export const withAgentSkills = <R>(
  agent: SkilledAgent | undefined,
  turn: AgentSkillTurn<R>
): Effect.Effect<AgentSkillTurn<R>> =>
  Effect.gen(function* () {
    if (agent === undefined || (agent.skills ?? []).length === 0) {
      return { ...turn, toolDefinitions: [] }
    }
    const index = skillIndexText(yield* listAgentSkills(agent))
    if (index === undefined) return { ...turn, toolDefinitions: [] }
    const advertised = turn.toolDefinitions.some(
      (definition) => definition.function.name === LOAD_SKILL_TOOL_NAME
    )
    const { runOther } = turn.tools
    return {
      messages: withSkillIndex(turn.messages, index),
      toolDefinitions: advertised ? [] : [loadSkillToolDefinition()],
      tools: {
        ...turn.tools,
        runOther: (call: ChatToolCall) =>
          call.name === LOAD_SKILL_TOOL_NAME
            ? runLoadSkill(agent, call)
            : runOther === undefined
              ? Effect.succeed({
                  content: `Error: unknown tool "${call.name}".`,
                  denied: false,
                  failed: true,
                })
              : runOther(call),
      },
    }
  }).pipe(Effect.withSpan('agents.skills.turn-tools'))
