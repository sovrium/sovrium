/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for calendar feed address operations. */
export class CalendarFeedTokenDatabaseError extends Data.TaggedError(
  'CalendarFeedTokenDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * One live feed address as the application layer sees it: whose it is, for
 * which table, and since when. There is no token and no digest on this shape —
 * the plaintext exists only inside the mint use case and the digest only inside
 * the repository, so neither can be serialised into a response by accident.
 */
export interface CalendarFeedTokenRecord {
  readonly userId: string
  readonly tableName: string
  readonly createdAt: Date
}

/**
 * `system.calendar_feed_tokens` port — one live address per person and table.
 *
 * Lookups are BY DIGEST, so a replaced, revoked or unknown token are the same
 * miss to every caller above this line.
 */
export class CalendarFeedTokenRepository extends Context.Service<
  CalendarFeedTokenRepository,
  {
    /**
     * Store `tokenDigest` as the person's address for the table, replacing any
     * earlier one (whose address then stops answering).
     */
    readonly replace: (input: {
      readonly userId: string
      readonly tableName: string
      readonly tokenDigest: string
    }) => Effect.Effect<CalendarFeedTokenRecord, CalendarFeedTokenDatabaseError>

    /** The person's live address for the table, if any. */
    readonly find: (
      userId: string,
      tableName: string
    ) => Effect.Effect<CalendarFeedTokenRecord | undefined, CalendarFeedTokenDatabaseError>

    /** The address bearing this digest, if any. */
    readonly findByDigest: (
      tokenDigest: string
    ) => Effect.Effect<CalendarFeedTokenRecord | undefined, CalendarFeedTokenDatabaseError>

    /** Delete the person's address for the table; `false` when there was none. */
    readonly revoke: (
      userId: string,
      tableName: string
    ) => Effect.Effect<boolean, CalendarFeedTokenDatabaseError>

    /**
     * Delete every address of a table NOT named in `keep` — a table that does
     * not declare a feed, or is not in the config. An empty `keep` deletes
     * every address. Answers the number of addresses deleted.
     */
    readonly purgeTablesWithoutFeed: (
      keep: ReadonlySet<string>
    ) => Effect.Effect<number, CalendarFeedTokenDatabaseError>
  }
>()('CalendarFeedTokenRepository') {}
