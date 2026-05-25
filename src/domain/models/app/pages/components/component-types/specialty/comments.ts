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
  table: Schema.optional(
    Schema.String.annotations({
      description: 'Table whose records the comments belong to (auto-resolved on collection pages)',
    })
  ),
  recordId: Schema.optional(
    Schema.String.annotations({
      description: 'Record id whose comments to display (auto-resolved to $record.id by default)',
    })
  ),
  limit: Schema.optional(
    Schema.Number.annotations({
      description: 'How many comments to load per page (default: 20)',
    })
  ),
  sort: Schema.optional(SortOrderSchema),
  paginationStyle: Schema.optional(PaginationStyleSchema),
  emptyText: Schema.optional(
    Schema.String.annotations({
      description: 'Message displayed when no comments exist (default: "No comments yet")',
    })
  ),
} as const

export const CommentCountTypeLiteral = Schema.Literal('commentCount')

export const commentCountFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  table: Schema.optional(
    Schema.String.annotations({
      description: 'Table whose records the comment count belongs to',
    })
  ),
  recordId: Schema.optional(
    Schema.String.annotations({
      description: 'Record id whose count to display (auto-resolved to $record.id by default)',
    })
  ),
  format: Schema.optional(
    Schema.String.annotations({
      description: 'Format string with {count} placeholder (default: "{count} comments")',
    })
  ),
  emptyText: Schema.optional(
    Schema.String.annotations({
      description: 'Text displayed when count is zero (default: "0 comments")',
    })
  ),
} as const
