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

const PaginationStyleSchema = Schema.Literal('loadMore', 'numbered').annotations({
  description: "Pagination style: 'loadMore' (default) or 'numbered'",
})

const SortOrderSchema = Schema.Literal('newest', 'oldest').annotations({
  description: "Sort order: 'newest' (default) or 'oldest'",
})

export const commentsFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Table whose records the comments belong to. Optional on collection pages (auto-resolved). */
  table: Schema.optional(
    Schema.String.annotations({
      description: 'Table whose records the comments belong to (auto-resolved on collection pages)',
    })
  ),
  /** Optional explicit record id (overrides `$record.id`). */
  recordId: Schema.optional(
    Schema.String.annotations({
      description: 'Record id whose comments to display (auto-resolved to $record.id by default)',
    })
  ),
  /** Comments per page (default: 20). */
  limit: Schema.optional(
    Schema.Number.annotations({
      description: 'How many comments to load per page (default: 20)',
    })
  ),
  /** Sort order. */
  sort: Schema.optional(SortOrderSchema),
  /** Pagination style. */
  paginationStyle: Schema.optional(PaginationStyleSchema),
  /** Empty-state copy. */
  emptyText: Schema.optional(
    Schema.String.annotations({
      description: 'Message displayed when no comments exist (default: "No comments yet")',
    })
  ),
} as const

/**
 * Comment-count page-component
 *
 * Lightweight companion to the `comments` component that shows a formatted
 * total. Auto-resolves the table + record on collection pages; supports a
 * `{count}` placeholder in `format`.
 *
 * Specs: [internal ref] … 035
 */
export const CommentCountTypeLiteral = Schema.Literal('commentCount')

export const commentCountFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Table whose records the count belongs to (auto-resolved on collection pages). */
  table: Schema.optional(
    Schema.String.annotations({
      description: 'Table whose records the comment count belongs to',
    })
  ),
  /** Explicit record id (overrides `$record.id`). */
  recordId: Schema.optional(
    Schema.String.annotations({
      description: 'Record id whose count to display (auto-resolved to $record.id by default)',
    })
  ),
  /** Format with optional `{count}` placeholder. Default: `"{count} comments"`. */
  format: Schema.optional(
    Schema.String.annotations({
      description: 'Format string with {count} placeholder (default: "{count} comments")',
    })
  ),
  /** Text to display when count is 0. Default: `"0 comments"`. */
  emptyText: Schema.optional(
    Schema.String.annotations({
      description: 'Text displayed when count is zero (default: "0 comments")',
    })
  ),
} as const
