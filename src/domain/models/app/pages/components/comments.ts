/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Comments Component Schema
 *
 * A page component that renders record comments on collection pages.
 * Reuses the existing Record Comments API and respects table-level
 * comment permissions.
 */
export const CommentsComponentSchema = Schema.Struct({
  /** Placeholder text for the comment form textarea */
  placeholder: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Placeholder text for the comment form textarea' })
    )
  ),

  /** Number of comments to load per page (default: 20) */
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Number of comments per page (default: 20)' })
    )
  ),

  /** Sort order for comments */
  sort: Schema.optional(
    Schema.Literals(['newest', 'oldest']).pipe(
      Schema.annotate({ description: 'Comment sort order (default: newest)' })
    )
  ),

  /** Pagination style */
  paginationStyle: Schema.optional(
    Schema.Literals(['loadMore', 'numbered']).pipe(
      Schema.annotate({ description: 'Pagination style (default: loadMore)' })
    )
  ),

  /** Whether to show the comment count badge */
  showCount: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Show comment count badge (default: true)' })
    )
  ),

  /** Custom empty state message */
  emptyMessage: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Custom message when no comments exist' }))
  ),
}).pipe(
  Schema.annotate({
    identifier: 'CommentsComponent',
    title: 'Comments Component',
    description:
      'Page component that renders record comments using the existing Record Comments API',
  })
)

/** @public */
export type CommentsComponent = typeof CommentsComponentSchema.Type
