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

const wrap = makeDbWrap((cause) => new AiFactsDatabaseError({ cause }))

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

export const AiFactsRepositoryLive = Layer.succeed(AiFactsRepository, {
  storeFact: ({ namespace, agentName, userId, fact, maxFacts }) =>
    wrap(
      (): Promise<void> =>
        db
          .insert(aiFacts)
          .values({ namespace, agentName, userId, fact })
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
        })
        .from(aiFacts)
        .where(and(eq(aiFacts.namespace, namespace), eq(aiFacts.userId, userId)))
        .orderBy(asc(aiFacts.createdAt))
      return rows
    }),
})
