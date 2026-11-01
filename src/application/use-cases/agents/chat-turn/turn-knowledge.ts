/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The knowledge passages a chat turn is handed: the agent's knowledge search
 * for the question, kept to what the caller may read, numbered `[1]…[n]`.
 *
 * A turn with no declared agent, or an agent that declares no knowledge,
 * retrieves nothing and is handed no passage.
 */

import { Effect } from 'effect'
import { retrieveAgentKnowledge } from '@/application/use-cases/agents/agent-knowledge-passages'
import {
  numberPassages,
  type KnowledgePassage,
} from '@/domain/models/app/agents/knowledge-citation-service'
import { resolveRagConfig } from '@/domain/models/app/agents/rag-config'
import type {
  AiEmbeddingRepository,
  EmbeddingSearchResult,
} from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/** The agent a turn runs as, as the turn names it. */
export interface TurnAgentRef {
  readonly name: string
  /** True for the System Agent, which declares no knowledge. */
  readonly builtIn?: boolean | undefined
}

/** The `memory.knowledge.similarityThreshold` an agent enabling knowledge memory gets by default. */
const KNOWLEDGE_MEMORY_THRESHOLD = 0.7

/** The declared agent a turn runs as — none for a generic turn or the System Agent. */
const declaredAgentOf = (
  app: App | undefined,
  agent: TurnAgentRef | undefined
): Agent | undefined =>
  agent === undefined || agent.builtIn === true
    ? undefined
    : app?.agents?.find((candidate) => candidate.name === agent.name)

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
 * Search the turn's agent's knowledge for `question`, keep the chunks
 * `keepReadable` lets the caller read, and number them. `keepReadable` is the
 * caller's read gate, run exactly as the search route runs it: a table chunk
 * she could not read through the records API is never handed to the model.
 */
export const gatherTurnKnowledge = <E, R>(input: {
  readonly app: App | undefined
  readonly agent: TurnAgentRef | undefined
  readonly question: string
  readonly keepReadable: (
    app: App,
    hits: ReadonlyArray<EmbeddingSearchResult>
  ) => Effect.Effect<ReadonlyArray<EmbeddingSearchResult>, E, R>
}): Effect.Effect<ReadonlyArray<KnowledgePassage>, E, AiService | AiEmbeddingRepository | R> =>
  Effect.withSpan('agents.chat.gather-knowledge')(
    Effect.gen(function* () {
      const { app, question } = input
      const agent = declaredAgentOf(app, input.agent)
      if (agent === undefined || app === undefined) return []
      const hits = yield* retrieveAgentKnowledge({
        agent,
        question,
        limits: retrievalLimits(agent),
      })
      const readable = yield* input.keepReadable(app, hits)
      return numberPassages(readable, agent.knowledge?.documents ?? [])
    })
  )
