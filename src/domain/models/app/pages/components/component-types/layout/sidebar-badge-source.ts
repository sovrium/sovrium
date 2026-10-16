/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A live count beside a sidebar entry, fetched from a read endpoint.
 *
 * The alternative — a literal `badge: '12'` — is the other branch of
 * {@link SidebarNavItemSchema}'s `badge`. It is right for a static marker
 * ("Beta", "New") and wrong for a count, which is stale the moment the config
 * is written.
 *
 * `valuePath` is a dot path into the response envelope, so the same endpoint a
 * `table` already binds to can also feed the badge beside its own nav
 * entry — one endpoint, not two.
 *
 * Both fields' `examples` name REAL routes and envelope keys: an example is
 * the first thing an author copies.
 */
export const SidebarBadgeSourceSchema = Schema.Struct({
  /** Read endpoint whose response carries the count */
  endpoint: Schema.String.pipe(
    Schema.annotate({
      description: 'Read endpoint whose response carries the badge count',
      examples: ['/api/admin/tables/overview', '/api/admin/automations/runs'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/^\//, {
        message:
          'sidebar badge endpoint must be a path starting with / — the badge reads this instance, never another origin',
      })
    )
  ),
  /** Dot path to the count within the response envelope (default: `total`) */
  valuePath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: "Dot path to the count in the response envelope (default: 'total')",
        examples: ['total', 'totals.tables', 'summary.failed'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * How loud the count is — shadcn/ui's Badge `variant`, narrowed to the two a
   * count can honestly carry.
   *
   * `secondary` (the default) is a quiet tally: rows in a table, files in a
   * bucket. `destructive` is a count of things that went WRONG — failed runs,
   * expired tokens — and it is the one an operator must not miss, so it is
   * also what a collapsible group reads: a group holding a non-zero
   * destructive count opens on arrival, and while it is shut the count is
   * repeated beside the group's own label. A destructive count of zero is not
   * drawn at all: "0 failed" is not something to look at.
   */
  variant: Schema.optional(
    Schema.Literals(['secondary', 'destructive']).annotate({
      description:
        "Badge variant: 'secondary' (default) for a tally, 'destructive' for a count of failures — drawn only when non-zero, and repeated beside a collapsed group's label",
    })
  ),
}).annotate({
  identifier: 'SidebarBadgeSource',
  title: 'Sidebar Badge Source',
  description: 'Read endpoint and value path feeding a live count beside a sidebar entry',
})

/** @public */
export type SidebarBadgeSource = Schema.Schema.Type<typeof SidebarBadgeSourceSchema>
