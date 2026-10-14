/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import {
  isRetrievableChunk,
  searchesKnowledge,
} from '@/domain/models/app/agents/knowledge-citation-service'
import type { EmbeddingSearchResult } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * The knowledge chunks a chat turn hands its agent, before anyone has judged
 * whether the caller may read them.
 *
 * An agent searches its knowledge on a chat turn when it declares any:
 * `knowledge.documents`, `knowledge.tables`, or `memory.knowledge.enabled`.
 * It reads its OWN table index and the document knowledge (stored globally),
 * never another agent's index, and of the documents:
 *
 * - the ones it declares in `knowledge.documents`, when it declares any;
 * - else, with `memory.knowledge.enabled`, every document under one of its
 *   `memory.knowledge.sources` (all of them when it names none) — the rule its
 *   automation runs follow;
 * - else none.
 *
 * Table chunks still have to pass the caller's read gate (the presentation
 * layer runs it, as the search route does) before they are handed over.
 */

/** What decides how much a turn retrieves. */
export interface KnowledgeRetrievalLimits {
  /** At most this many chunks. */
  readonly maxResults: number
  /** Only chunks at least this similar to the question. */
  readonly minSimilarity: number
}

/**
 * Over-fetch factor: the index ranks before the agent's own filter runs, so a
 * page of chunks another agent owns would otherwise crowd out its own.
 */
const OVER_FETCH = 4

/**
 * Retrieve the chunks a chat turn hands `agent` for `question`, most similar
 * first. Best-effort: retrieval ENRICHES an answer, so a provider or index
 * failure leaves the agent answering from its prompt — logged, never fatal.
 */
export const retrieveAgentKnowledge = (input: {
  readonly agent: Agent
  readonly question: string
  readonly limits: KnowledgeRetrievalLimits
}): Effect.Effect<ReadonlyArray<EmbeddingSearchResult>, never, AiService | AiEmbeddingRepository> =>
  Effect.gen(function* () {
    const { agent, question, limits } = input
    if (!searchesKnowledge(agent) || limits.maxResults <= 0) return []
    const ai = yield* AiService
    const repo = yield* AiEmbeddingRepository
    const { embedding } = yield* ai.embed({ text: question })
    const hits = yield* repo.search({
      embedding,
      query: question,
      agentName: agent.name,
      includeGlobal: true,
      minSimilarity: limits.minSimilarity,
      maxResults: limits.maxResults * OVER_FETCH,
    })
    return hits.filter((hit) => isRetrievableChunk(agent, hit)).slice(0, limits.maxResults)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('[ai] knowledge retrieval for a chat turn failed', cause)
    ),
    // effect-swallow: retrieval is an enrichment — a failed search leaves the agent answering from its prompt, as a search that matched nothing does; the cause is logged above.
    Effect.orElseSucceed((): ReadonlyArray<EmbeddingSearchResult> => []),
    Effect.withSpan('agents.retrieve-knowledge')
  )
