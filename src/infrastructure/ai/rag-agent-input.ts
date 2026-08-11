/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The structural shape the RAG infrastructure reads from `app.agents[]`.
 *
 * `knowledge-sync.ts`, `ai-knowledge-listener.ts` and `rag-route.ts` all need
 * the same minimal slice of an agent — its `name` plus its `knowledge.tables`
 * configuration. This inline type was declared four times before this module;
 * `RagAgent` is the single source of truth so a schema change propagates to
 * every consumer through one definition.
 */

/** One table-knowledge entry as declared in `agent.knowledge.tables[]`. */
export interface RagKnowledgeTable {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter?: Readonly<Record<string, unknown>>
}

/** The slice of an `app.agents[]` entry the RAG infrastructure consumes. */
export interface RagAgent {
  readonly name: string
  readonly knowledge?: {
    readonly tables?: ReadonlyArray<RagKnowledgeTable>
  }
}
