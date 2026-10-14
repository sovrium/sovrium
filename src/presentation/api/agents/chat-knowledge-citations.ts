/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The knowledge passages of a chat turn, and the citations its answer makes.
 *
 * Two calls bracket a turn, whichever transport carries it:
 *
 * 1. {@link withTurnKnowledge} before the turn: the agent's knowledge search
 *    for the question, through the caller's read gate, numbered `[1]…[n]` and
 *    folded into the system prompt. It answers the turn input to run and the
 *    passages it was handed.
 * 2. {@link turnCitations} once the answer is known: the passages it marks.
 *    The buffered reply carries them as `citations`; a stream carries the same
 *    value on its `done` event.
 *
 * A turn with no declared agent, or an agent that declares no knowledge, reads
 * exactly as before: no search, no prompt section, no `citations`.
 */

import { Effect } from 'effect'
import { retrieveAgentKnowledge } from '@/application/use-cases/agents/agent-knowledge-passages'
import {
  citationsOf,
  knowledgePromptSection,
  numberPassages,
  type KnowledgePassage,
} from '@/domain/models/app/agents/knowledge-citation-service'
import { resolveRagConfig } from '@/domain/models/app/agents/rag-config'
import { AiEmbeddingRepositoryActive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
import { filterHitsThroughReadGate, filterServableHits } from './rag-search-read-gate'
import type { ChatTurnInput } from './chat-turn-completion'
import type { ChatCitation } from '@/domain/models/api/ai/chat'
import type { Agent } from '@/domain/models/app/agents/agent'

/** A turn input with its knowledge folded in, and the passages it was handed. */
export interface TurnKnowledge {
  readonly input: ChatTurnInput
  readonly passages: ReadonlyArray<KnowledgePassage>
}

/** The declared agent a turn runs as — none for a generic turn or the System Agent. */
const declaredAgentOf = (input: ChatTurnInput): Agent | undefined =>
  input.agent === undefined || input.agent.builtIn === true
    ? undefined
    : input.app?.agents?.find((candidate) => candidate.name === input.agent?.name)

/** The `memory.knowledge.similarityThreshold` an agent enabling knowledge memory gets by default. */
const KNOWLEDGE_MEMORY_THRESHOLD = 0.7

/**
 * How much a chat turn retrieves: the agent's `memory.knowledge.retrievalLimit`,
 * else `AI_RAG_MAX_RESULTS`. With knowledge memory enabled, only passages at
 * least `memory.knowledge.similarityThreshold` similar (0.7 by default), as on
 * its automation runs. Without it, the agent declared sources and nothing about
 * tuning: the model is handed the closest passages and cites what it uses.
 */
const retrievalLimits = (agent: Agent) => {
  const memory = agent.memory?.knowledge
  return {
    maxResults: memory?.retrievalLimit ?? resolveRagConfig(process.env, '').maxResults,
    minSimilarity:
      memory?.similarityThreshold ?? (memory?.enabled === true ? KNOWLEDGE_MEMORY_THRESHOLD : 0),
  }
}

/**
 * Search the turn's agent's knowledge for its question, keep the chunks the
 * caller may read, number them, and fold them into the turn's system prompt.
 */
export const withTurnKnowledge = async (input: ChatTurnInput): Promise<TurnKnowledge> => {
  const agent = declaredAgentOf(input)
  const { app } = input
  if (agent === undefined || app === undefined) return { input, passages: [] }
  const hits = await Effect.runPromise(
    retrieveAgentKnowledge({ agent, question: input.message, limits: retrievalLimits(agent) }).pipe(
      Effect.provide(AiEmbeddingRepositoryActive),
      Effect.provide(input.services)
    )
  )
  // The caller's read gate, exactly as the search route runs it: a table chunk
  // she could not read through the records API is never handed to the model.
  const readable =
    app.auth === undefined
      ? filterServableHits(app, hits)
      : await filterHitsThroughReadGate({
          services: input.services,
          app,
          reader: input.reader,
          results: hits,
        })
  const passages = numberPassages(readable, agent.knowledge?.documents ?? [])
  if (passages.length === 0) return { input, passages }
  const section = knowledgePromptSection(passages)
  return { input: { ...input, systemPrompt: `${input.systemPrompt}\n\n${section}` }, passages }
}

/**
 * The citations an answer makes of the passages its turn was handed, or
 * `undefined` when it cites none — a reply without sources carries no
 * `citations` at all. The same value rides on a stream's `done` event.
 */
export const turnCitations = (
  answer: string,
  passages: ReadonlyArray<KnowledgePassage>
): ReadonlyArray<ChatCitation> | undefined => {
  const cited = citationsOf(answer, passages)
  return cited.length === 0 ? undefined : cited
}
