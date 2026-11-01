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
import { gatherTurnKnowledge } from '@/application/use-cases/agents/chat-turn/turn-knowledge'
import {
  citationsOf,
  knowledgePromptSection,
  type KnowledgePassage,
} from '@/domain/models/app/agents/knowledge-citation-service'
import {
  filterHitsThroughReadGate,
  filterServableHits,
  type HitReadRequirements,
} from './rag-search-read-gate'
import type { ChatReader } from './chat-read-scope'
import type { ChatTurnInput } from './chat-turn-completion'
import type { EmbeddingSearchResult } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { ChatCitation } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'

/** A turn input with its knowledge folded in, and the passages it was handed. */
export interface TurnKnowledge {
  readonly input: ChatTurnInput
  readonly passages: ReadonlyArray<KnowledgePassage>
}

/**
 * Search the turn's agent's knowledge for its question, keep the chunks the
 * caller may read, number them, and fold them into the turn's system prompt.
 * The search is `gatherTurnKnowledge`, with the caller's read gate exactly as
 * the search route runs it.
 */
export const withTurnKnowledge = (input: ChatTurnInput) =>
  Effect.map(
    gatherTurnKnowledge({
      app: input.app,
      agent: input.agent,
      question: input.message,
      keepReadable: (app, hits) => keepReadableHits(app, input.reader, hits),
    }),
    (passages): TurnKnowledge => {
      if (passages.length === 0) return { input, passages }
      const section = knowledgePromptSection(passages)
      return { input: { ...input, systemPrompt: `${input.systemPrompt}\n\n${section}` }, passages }
    }
  )

/**
 * The knowledge chunks `reader` may read: in an app with no sign-in, those
 * open to everyone; otherwise those her records read gate admits.
 */
export const keepReadableHits = <T extends EmbeddingSearchResult>(
  app: App,
  reader: ChatReader,
  hits: ReadonlyArray<T>
): Effect.Effect<ReadonlyArray<T>, never, HitReadRequirements> =>
  app.auth === undefined
    ? Effect.succeed(filterServableHits(app, hits))
    : filterHitsThroughReadGate({ app, reader, results: hits })

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
