/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, eq, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationDigestDatabaseError,
  AutomationDigestRepository,
} from '@/application/ports/repositories/automation-digest-repository'
import { db } from '@/infrastructure/database'
import {
  automationDigestBuckets,
  automationDigestItems,
} from '@/infrastructure/database/drizzle/schema/automation-digest'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'

const wrap = makeDbWrap((cause) => new AutomationDigestDatabaseError({ cause }))

export const AutomationDigestRepositoryLive = Layer.succeed(AutomationDigestRepository, {
  findOrCreateActiveBucket: ({ automationId, digestKey }) =>
    wrap(async () => {
      const existing = await db
        .select({ id: automationDigestBuckets.id })
        .from(automationDigestBuckets)
        .where(
          and(
            eq(automationDigestBuckets.digestKey, digestKey),
            eq(automationDigestBuckets.status, 'collecting')
          )
        )
        .limit(1)
      if (existing[0] !== undefined) return existing[0].id

      const [created] = await db
        .insert(automationDigestBuckets)
        .values({ automationId, digestKey })
        .returning({ id: automationDigestBuckets.id })
      return created?.id ?? ''
    }),

  addItem: ({ bucketId, item, dedupeKey }) =>
    wrap(async () => {
      if (dedupeKey !== undefined) {
        const existing = await db
          .select({ id: automationDigestItems.id })
          .from(automationDigestItems)
          .where(
            and(
              eq(automationDigestItems.bucketId, bucketId),
              eq(automationDigestItems.dedupeKey, dedupeKey)
            )
          )
          .limit(1)
        if (existing[0] === undefined) {
          await db
            .insert(automationDigestItems)
            .values({ bucketId, item: jsonbLiteral(item), dedupeKey })
        }
      } else {
        await db.insert(automationDigestItems).values({ bucketId, item: jsonbLiteral(item) })
      }

      const [sizeRow] = await db
        .select({ size: count() })
        .from(automationDigestItems)
        .where(eq(automationDigestItems.bucketId, bucketId))
      return sizeRow?.size ?? 0
    }),

  release: ({ digestKey, sort, limit }) =>
    wrap(async () => {
      const buckets = await db
        .select({ id: automationDigestBuckets.id })
        .from(automationDigestBuckets)
        .where(
          and(
            eq(automationDigestBuckets.digestKey, digestKey),
            eq(automationDigestBuckets.status, 'collecting')
          )
        )
        .limit(1)
      const bucketId = buckets[0]?.id
      if (bucketId === undefined) return []

      const orderClause =
        sort === undefined
          ? asc(automationDigestItems.collectedAt)
          : sql`${automationDigestItems.item} ->> ${sql.raw(`'${sort.field.replace(/'/g, "''")}'`)} ${sql.raw(sort.direction === 'desc' ? 'DESC' : 'ASC')}`

      const itemsQuery = db
        .select({ item: automationDigestItems.item })
        .from(automationDigestItems)
        .where(eq(automationDigestItems.bucketId, bucketId))
        .orderBy(orderClause)
      const items = limit !== undefined ? await itemsQuery.limit(limit) : await itemsQuery

      await db
        .update(automationDigestBuckets)
        .set({ status: 'released', releasedAt: new Date() })
        .where(eq(automationDigestBuckets.id, bucketId))

      return items.map((row) => row.item)
    }),
})
