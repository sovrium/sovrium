/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AiFactsDatabaseError,
  AiFactsRepository,
} from '@/application/ports/repositories/ai/ai-facts-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { aiFacts as aiFactsPg } from '@/infrastructure/database/drizzle/schema/ai'
import { aiFacts as aiFactsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { AiFact } from '@/application/ports/repositories/ai/ai-facts-repository'

const aiFacts = resolveDialectSchema(aiFactsPg, aiFactsSqlite)

/** Wrap a DB promise, adapting failures to AiFactsDatabaseError. */
const wrap = makeDbWrap((cause) => new AiFactsDatabaseError({ cause }))

/**
 * Evict the oldest facts in a namespace until at most `maxFacts` rows remain.
 *
 * Eviction is FIFO by `created_at`: the rows
 * are listed newest-first, the most recent `maxFacts` are kept, and any
 * surplus older rows are deleted. The cap is enforced per `namespace` so two
 * agents sharing a namespace share the budget.
 */
const enforceMaxFacts = (namespace: string, maxFacts: number): Promise<void> =>
  db
    .select({ id: aiFacts.id })
    .from(aiFacts)
    .where(eq(aiFacts.namespace, namespace))
    .orderBy(desc(aiFacts.createdAt))
    .then((rows) => {
      const surplusIds = rows.slice(maxFacts).map((r) => r.id)
      return surplusIds.length === 0
        ? Promise.resolve()
        : db
            .delete(aiFacts)
            .where(inArray(aiFacts.id, surplusIds))
            .then(() => undefined)
    })

/**
 * The tables a stored fact names, read off its `metadata`. A fact stored
 * before facts recorded their tables, or with any other `metadata` shape,
 * names none.
 */
const tablesOf = (metadata: unknown): ReadonlyArray<string> => {
  const tables =
    typeof metadata === 'object' && metadata !== null
      ? (metadata as { readonly tables?: unknown }).tables
      : undefined
  return Array.isArray(tables)
    ? tables.filter((table): table is string => typeof table === 'string')
    : []
}

/**
 * AI Facts Repository Implementation (Drizzle).
 *
 * Persists learned facts to `system.ai_facts`, scoped by namespace, agent,
 * and user so facts never leak across namespaces or users.
 */
export const AiFactsRepositoryLive = Layer.succeed(AiFactsRepository, {
  storeFact: ({ namespace, agentName, userId, fact, maxFacts, tables }) =>
    wrap((): Promise<void> =>
      db
        .insert(aiFacts)
        .values({
          namespace,
          agentName,
          userId,
          fact,
          ...(tables !== undefined && tables.length > 0 && { metadata: { tables: [...tables] } }),
        })
        .then(() => enforceMaxFacts(namespace, maxFacts))
    ),

  recallFacts: ({ namespace, userId }) =>
    wrap(async (): Promise<ReadonlyArray<AiFact>> => {
      const rows = await db
        .select({
          fact: aiFacts.fact,
          namespace: aiFacts.namespace,
          agentName: aiFacts.agentName,
          userId: aiFacts.userId,
          createdAt: aiFacts.createdAt,
          metadata: aiFacts.metadata,
        })
        .from(aiFacts)
        .where(and(eq(aiFacts.namespace, namespace), eq(aiFacts.userId, userId)))
        .orderBy(asc(aiFacts.createdAt))
      return rows.map(({ metadata, ...row }) => ({ ...row, tables: tablesOf(metadata) }))
    }),
})
