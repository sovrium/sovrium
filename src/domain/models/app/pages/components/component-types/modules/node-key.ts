/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The optional, author-chosen identity of one node on a page.
 *
 * A node already has a position — its path in the page tree — and that is
 * enough to find it while nothing moves. A position stops being an identity
 * the moment a designer reorders a list or drags a block into another column:
 * the node at `children/2` is now a different node. A `key` is what survives
 * the move, so a drawing brought back from a design tool is matched to the
 * node it was drawn from by its key first, and by its position only when no
 * key is set.
 *
 * Kebab-case, the spelling every other identifier of a page config uses.
 * Unique within one page: two nodes sharing a key would make a match
 * ambiguous, and that rule is checked across the whole page rather than
 * here, since one node cannot see its siblings.
 *
 * Optional, and inert at runtime: the renderer draws a node the same with or
 * without one. It exists for the tools that read the page, never for the
 * page's visitors.
 */
export const NodeKeySchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Node Key',
    description:
      'A stable name for this node, unique within its page, in kebab-case. It changes nothing on the rendered page: it lets a design tool match a node it drew back to this node after the node was moved or reordered. Without it, a node is matched by its position in the page tree.',
    examples: ['hero-cta', 'pricing-table', 'footer-links'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message:
        'A node key is kebab-case: lowercase letters and digits, words joined by single hyphens',
    })
  )
)

/** The `key` field every component branch and every reference placement carries. */
export const nodeKeyFields = {
  key: Schema.optional(NodeKeySchema),
} as const
