/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AutomationDigestDatabaseError,
  AutomationDigestRepository,
} from '@/application/ports/repositories/automation-digest-repository'
import { db } from '@/infrastructure/database'
import {
  automationDigestBuckets,
  automationDigestItems,
} from '@/infrastructure/database/drizzle/schema/automation-digest'

/**
 * Automation Digest Repository Implementation (Drizzle).
 *
 * Active bucket = the one row in `automation_digest_buckets` with
 * `status = 'collecting'` for a given `(automation_id, digest_key)`. The
 * schema doesn't enforce uniqueness on that triplet (only an index), so
 * this layer takes the first row when one exists and creates a new row
 * otherwise. After `release`, the row's status flips to `released` and
 * subsequent `findOrCreateActiveBucket` calls produce a fresh bucket.
 *
 * Sort over JSONB items uses `item ->> '$field'` to extract a text value;
 * the natural sort gives lexicographic order which lines up with ISO 8601
 * for timestamp-shaped strings. Numeric fields would need an explicit
 * cast; out of scope until a spec demands it.
 */
export const AutomationDigestRepositoryLive = Layer.succeed(AutomationDigestRepository, {
  findOrCreateActiveBucket: ({ automationId, digestKey }) =>
    Effect.tryPromise({
      try: async () => {
        const existing = await db
          .select({ id: automationDigestBuckets.id })
          .from(automationDigestBuckets)
          .where(
            and(
              eq(automationDigestBuckets.automationId, automationId),
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
      },
      catch: (cause) => new AutomationDigestDatabaseError({ cause }),
    }),

  addItem: ({ bucketId, item, dedupeKey }) =>
    Effect.tryPromise({
      try: async () => {
        // Dedupe: if a row with the same dedupe_key already exists in this
        // bucket, skip the insert and return the current size.
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
            // eslint-disable-next-line functional/no-expression-statements
            await db.insert(automationDigestItems).values({ bucketId, item, dedupeKey })
          }
        } else {
          // eslint-disable-next-line functional/no-expression-statements
          await db.insert(automationDigestItems).values({ bucketId, item })
        }

        const [sizeRow] = await db
          .select({ size: count() })
          .from(automationDigestItems)
          .where(eq(automationDigestItems.bucketId, bucketId))
        return sizeRow?.size ?? 0
      },
      catch: (cause) => new AutomationDigestDatabaseError({ cause }),
    }),

  release: ({ automationId, digestKey, sort, limit }) =>
    Effect.tryPromise({
      try: async () => {
        const buckets = await db
          .select({ id: automationDigestBuckets.id })
          .from(automationDigestBuckets)
          .where(
            and(
              eq(automationDigestBuckets.automationId, automationId),
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
            : sort.direction === 'desc'
              ? desc(sql`${automationDigestItems.item} ->> ${sort.field}`)
              : asc(sql`${automationDigestItems.item} ->> ${sort.field}`)

        const itemsQuery = db
          .select({ item: automationDigestItems.item })
          .from(automationDigestItems)
          .where(eq(automationDigestItems.bucketId, bucketId))
          .orderBy(orderClause)
        const items = limit !== undefined ? await itemsQuery.limit(limit) : await itemsQuery

        // eslint-disable-next-line functional/no-expression-statements
        await db
          .update(automationDigestBuckets)
          .set({ status: 'released', releasedAt: new Date() })
          .where(eq(automationDigestBuckets.id, bucketId))

        return items.map((row) => row.item)
      },
      catch: (cause) => new AutomationDigestDatabaseError({ cause }),
    }),
})
