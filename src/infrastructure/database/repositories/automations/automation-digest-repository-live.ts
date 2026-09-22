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
} from '@/application/ports/repositories/automations/automation-digest-repository'
import { escapeSqlString } from '@/domain/kernel/sql/sql-formatting'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDigestBuckets as automationDigestBucketsPg,
  automationDigestItems as automationDigestItemsPg,
} from '@/infrastructure/database/drizzle/schema/automation-digest'
import {
  automationDigestBuckets as automationDigestBucketsSqlite,
  automationDigestItems as automationDigestItemsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation-digest'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'

const automationDigestBuckets = resolveDialectSchema(
  automationDigestBucketsPg,
  automationDigestBucketsSqlite
)
const automationDigestItems = resolveDialectSchema(
  automationDigestItemsPg,
  automationDigestItemsSqlite
)

/** Wrap a DB promise, adapting failures to AutomationDigestDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationDigestDatabaseError({ cause }))

/**
 * Automation Digest Repository Implementation (Drizzle).
 *
 * Active bucket = the one row in `automation_digest_buckets` with
 * `status = 'collecting'` for a given `digest_key`. Buckets are scoped by
 * `digest_key` alone — NOT by `(automation_id, digest_key)` — because the
 * digest lifecycle is intentionally cross-automation: one automation may
 * `collect` items under a key while a separate automation `release`s them
 *. `automation_id` is still
 * recorded on each bucket (it is a non-null FK) using the automation that
 * created the bucket, but it is not a lookup discriminator.
 *
 * The schema doesn't enforce uniqueness on `digest_key`+`status` (only an
 * index), so this layer takes the first `collecting` row when one exists
 * and creates a new row otherwise. After `release`, the row's status flips
 * to `released` and subsequent `findOrCreateActiveBucket` calls produce a
 * fresh bucket.
 *
 * Sort over JSONB items uses `item ->> '$field'` to extract a text value;
 * the natural sort gives lexicographic order which lines up with ISO 8601
 * for timestamp-shaped strings. Numeric fields would need an explicit
 * cast; out of scope until a spec demands it.
 */
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
      // The `item` JSONB value is inlined via `jsonbLiteral` (`'…'::jsonb`)
      // rather than passed as a typed bind. drizzle-orm + bun-sql binds a
      // JS object to a `jsonb` column by `JSON.stringify`-ing it, and the
      // bun-sql driver then JSON-encodes that string AGAIN — the cell ends
      // up holding a JSON *string scalar* (`"{…}"`) instead of a JSON
      // object. That double-encoding makes `item ->> 'field'` return NULL,
      // which silently broke `digest:release`'s sort. See `jsonbLiteral`'s
      // doc and drizzle-orm issue #4385.
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
          await db
            .insert(automationDigestItems)
            .values({ bucketId, item: jsonbLiteral(item), dedupeKey })
        }
      } else {
        // eslint-disable-next-line functional/no-expression-statements
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

      // Build the ORDER BY clause. For a JSONB-field sort the direction
      // keyword must live INSIDE the `sql` fragment — wrapping a `sql`
      // expression with Drizzle's `desc()`/`asc()` helper does not emit
      // the keyword reliably for a `jsonb ->> key` expression, so the
      // rows come back in physical (insertion) order. The field name is
      // inlined as a single-quoted SQL literal (it is a JSONB key, not a
      // table column) with embedded quotes escaped to prevent injection.
      const orderClause =
        sort === undefined
          ? asc(automationDigestItems.collectedAt)
          : sql`${automationDigestItems.item} ->> ${sql.raw(`'${escapeSqlString(sort.field)}'`)} ${sql.raw(sort.direction === 'desc' ? 'DESC' : 'ASC')}`

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
    }),
})
