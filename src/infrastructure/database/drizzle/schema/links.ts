/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Tracked short links created at runtime.
 *
 * DEFINITIONS ONLY. There is no `click_count`, no `scan_count` and no
 * `last_clicked_at`, and their absence is a decision rather than an omission
 * ([internal ref] D6): a counter and a `COUNT(*)` over `system.analytics_events`
 * inevitably diverge — Do Not Track suppresses recording, an operator may have
 * analytics off entirely, and retention purges old events — and shipping two
 * figures for one quantity is how an operator stops trusting both.
 *
 * The accepted cost is that `maxClicks` is bounded by the analytics retention
 * window and enforced best-effort under burst. Adding a counter later is a
 * deliberate decision recorded in [internal ref], not an optimisation to be made
 * locally; whoever proposes it should say which divergence source they intend to
 * live with.
 *
 * Config-declared links (`app.links[]`) are NOT rows here. They live in the file
 * and are resolved from memory; a row exists only for a link minted at runtime,
 * plus `shadowed_at` bookkeeping when config later claims the same slug.
 */
export const links = systemSchema.table(
  'links',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    appName: text('app_name').notNull().default('default'),

    /** The path segment after `/l/`. Lowercase and dot-free by schema. */
    slug: text('slug').notNull(),

    /**
     * Where the definition came from: `db` for a runtime link, `config` for a
     * counters-and-overlay row lazily created against a config-declared slug.
     *
     * Stored rather than derived because the boot shadow sweep must be able to
     * skip `config` rows — otherwise every config link would be flagged as
     * shadowing itself.
     */
    source: text('source').notNull().default('db'),

    /** Single destination. Null when the link declares a target list instead. */
    destination: text('destination'),

    /** Candidate destinations with weights. Null for a single-destination link. */
    targets: jsonb('targets'),

    title: text('title'),
    tags: jsonb('tags').notNull().default([]),
    notes: text('notes'),

    enabled: boolean('enabled').notNull().default(true),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    maxClicks: integer('max_clicks'),
    expiredTo: text('expired_to'),

    utm: jsonb('utm'),

    /** Never plaintext. Absent for links that are not gated. */
    passwordHash: text('password_hash'),

    /**
     * The operational overlay — set when an operator disables the link from the
     * console. Works on config-declared links too, and may only ever be MORE
     * restrictive than the file ([internal ref] D3).
     */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),

    /**
     * Set by the boot sweep when `app.links[]` later claims this slug. Nullable
     * rather than a status enum precisely so un-shadowing is its natural inverse
     * when the config entry is removed again.
     */
    shadowedAt: timestamp('shadowed_at', { withTimezone: true }),

    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // PARTIAL on `deleted_at IS NULL`, and the predicate is the point: without it
    // a soft-deleted link would burn its slug for the lifetime of the instance,
    // so an operator could never re-mint a name they had retired.
    uniqueIndex('links_app_slug_unique')
      .on(table.appName, table.slug)
      .where(sql`deleted_at IS NULL`),
    index('links_app_archived_idx').on(table.appName, table.archivedAt),
    index('links_deleted_at_idx').on(table.deletedAt),
  ]
)

export type Link = typeof links.$inferSelect
export type NewLink = typeof links.$inferInsert
