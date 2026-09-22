/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

/**
 * Comments page-component
 *
 * Renders the record comments section on a (typically collection-bound) page.
 *
 * Reuses the existing Record Comments API
 * (`/api/tables/:tableId/records/:recordId/comments`). When placed on a
 * collection page, the bound `table` and `$record.id` resolve automatically;
 * `props.table` overrides the collection's table.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 029
 */
export const CommentsTypeLiteral = Schema.Literal('comments')

/**
 * `loadMore` names the CONCERN, not a control — the same way
 * `listDisplay.loadMore: 'infinite' | 'button'` reads it next door. Under it
 * the next page is fetched as the reader reaches the end of the thread, with
 * nothing to press; `numbered` draws page numbers instead. The two literals
 * are unchanged, so an existing config keeps decoding.
 */
const PaginationStyleSchema = Schema.Literals(['loadMore', 'numbered']).annotate({
  description:
    "Pagination style: 'loadMore' (default, the next page is fetched as the reader reaches the end of the thread) or 'numbered'",
})

const SortOrderSchema = Schema.Literals(['newest', 'oldest']).annotate({
  description: "Sort order: 'newest' (default) or 'oldest'",
})

/**
 * Which comments surface to draw: the full thread, or the inline total.
 *
 * `count` absorbs what used to be the separate `commentCount` component type.
 */
const CommentsDisplaySchema = Schema.Literals(['thread', 'count']).annotate({
  description:
    "Which surface to draw: 'thread' (default, the full section) or 'count' (an inline total)",
})

export const commentsFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Table whose records the comments belong to. Optional on collection pages (auto-resolved). */
  table: Schema.optional(
    Schema.String.annotate({
      description: 'Table whose records the comments belong to (auto-resolved on collection pages)',
    })
  ),
  /** Optional explicit record id (overrides `$record.id`). */
  recordId: Schema.optional(
    Schema.String.annotate({
      description: 'Record id whose comments to display (auto-resolved to $record.id by default)',
    })
  ),
  /** Comments per page (default: 20). */
  limit: Schema.optional(
    Schema.Finite.annotate({
      description: 'How many comments to load per page (default: 20)',
    })
  ),
  /** Sort order. */
  sort: Schema.optional(SortOrderSchema),
  /** Pagination style. */
  paginationStyle: Schema.optional(PaginationStyleSchema),
  /**
   * Empty-state copy.
   *
   * ONE key, TWO defaults, because the two displays say different things when
   * there is nothing: a thread says "No comments yet", a counter says
   * "0 comments". The resolver for each display supplies its own default, so an
   * author who sets this gets it verbatim in either mode and an author who does
   * not gets the sentence that belongs to the mode they chose.
   */
  emptyText: Schema.optional(
    Schema.String.annotate({
      description:
        'Message displayed when there are no comments (default: "No comments yet" for display: thread, "0 comments" for display: count)',
    })
  ),
  /**
   * Which of the two surfaces to draw. Default `thread`.
   *
   * `thread` is the full section — the list, its pagination and its composer.
   * `count` is the lightweight companion: one inline span holding a formatted
   * total, the shape that used to be its own `commentCount` component type.
   *
   * They are one type because they are one feature read at two sizes, and they
   * already shared every binding key that matters (`table`, `recordId`,
   * `emptyText`) plus the whole record-resolution path. Two type names meant
   * two kit entries, two published sections, and an author choosing between
   * them before knowing they were the same thing.
   */
  display: Schema.optional(CommentsDisplaySchema),
  /**
   * Count format, with an optional `{count}` placeholder. Default
   * `"{count} comments"`.
   *
   * Read only under `display: count` — a thread has no single number to format.
   * Left inert rather than refused on a thread, matching how `limit`, `sort`
   * and `paginationStyle` are inert under `display: count`: the union of both
   * shapes is one open struct, and refusing per-display would need a
   * per-branch refinement hook `buildComponentUnion` does not have.
   */
  format: Schema.optional(
    Schema.String.annotate({
      description:
        'Count format with a {count} placeholder, read under display: count (default: "{count} comments")',
    })
  ),
} as const
