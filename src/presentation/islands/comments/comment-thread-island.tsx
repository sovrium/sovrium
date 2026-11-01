/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, type ReactElement } from 'react'
import {
  computeCommentSortBarClasses,
  computeCommentTitleClasses,
} from '@/presentation/design/comments-default-classes'
import { CommentMentionSource } from './comment-mention-source'
import { CommentStringsContext, type CommentStrings } from './comment-strings'
import { SortDropdown } from './comment-thread-controls'
import {
  CommentThreadBody,
  CommentThreadComposer,
  CommentThreadPager,
} from './comment-thread-sections'
import { useCommentThread } from './use-comment-thread'
import type { CommentThreadIslandProps } from './comment-thread-types'

/** The provider value of a thread whose host sent no strings: English throughout. */
const NO_UI_STRINGS: CommentStrings = {}

/**
 * Comment-thread island.
 *
 * Hydrates the SSR `<section data-component="comments">` placeholder with:
 * - paged comment list (TanStack Query)
 * - authenticated comment form (POST /comments)
 * - per-comment edit / delete (PATCH / DELETE) by author or admin
 * - scroll-fetched pages OR numbered pagination (per `paginationStyle`)
 * - sort dropdown (newest first / oldest first)
 *
 * Requires `tableName` AND `recordId` at SSR time — the placeholder only
 * emits the `data-island` marker when both are resolvable.
 *
 * Specs covered (subset): [internal ref] … 029.
 *
 * The section's `aria-busy`: a reader who cannot see the scroll has no button
 * left to hear. Taking the control away obliges the thread to announce the
 * fetch it now makes on its own — and to say `"false"` at rest rather than
 * nothing, so an assistive technology reads a settled region rather than an
 * unknown one. (React renders an `aria-*` boolean as the string
 * `"true"`/`"false"`, so the attribute is always present rather than dropped
 * when false.)
 *
 * FRAMELESS on purpose. `island-client.tsx` calls `createRoot(host)`, so
 * this subtree renders INSIDE the SSR `<section>` that already carries the
 * thread frame — border, ground, radius and outer margin. Drawing the frame
 * here too would nest two identical borders once the island mounts, which is
 * the card-in-card the row layout exists to remove.
 *
 * AND UNNAMED, for the same reason. The host already carries the author's
 * `props.id`, so stamping it here too put the SAME id on two nested
 * elements the moment the island mounted — invalid, and worse than
 * cosmetic: `#thread` then matches twice, so a `#id` assertion passes
 * before hydration and fails after it. That is a race an author meets as
 * a flaky page rather than as a duplicate id, which is why the id stays
 * on the ONE element that exists whether or not this subtree ever mounts.
 *
 * The ACCESSIBLE NAME stays on that host too, and it stayed here by
 * oversight when the id moved. A named `<section>` is a landmark, so
 * naming both left a reader navigating by landmark hearing one name twice
 * with no way to tell which of the two nested regions held the thread —
 * and left a lookup by that name resolving to one element before
 * hydration and to two after it.
 */

export default function CommentThreadIsland(props: CommentThreadIslandProps): ReactElement {
  const { tableName, recordId, limit, paginationStyle, 'data-testid': testId } = props
  const thread = useCommentThread(props)
  const mentionSource = useMemo(() => ({ tableName, recordId }), [tableName, recordId])

  return (
    <CommentStringsContext.Provider value={props.uiStrings ?? NO_UI_STRINGS}>
      <CommentMentionSource.Provider value={mentionSource}>
        <section
          ref={thread.rootRef}
          data-component="comments"
          data-component-type="comments"
          data-comments-limit={String(limit)}
          data-comments-sort={thread.sort}
          data-comments-pagination-style={paginationStyle}
          data-comments-table={tableName}
          data-comments-record-id={recordId}
          data-comments-threading={String(props.threading === true)}
          data-testid={testId}
          aria-busy={thread.isFetching}
          className="comments flex flex-col"
        >
          {props.title !== undefined && (
            <h2
              id={props.titleId}
              className={computeCommentTitleClasses()}
            >
              {props.title}
            </h2>
          )}
          <div className={computeCommentSortBarClasses()}>
            <SortDropdown
              sort={thread.sort}
              onChange={thread.changeSort}
            />
          </div>
          <CommentThreadBody
            thread={thread}
            props={props}
          />
          <CommentThreadPager
            thread={thread}
            paginationStyle={paginationStyle}
          />
          <CommentThreadComposer
            thread={thread}
            props={props}
          />
        </section>
      </CommentMentionSource.Provider>
    </CommentStringsContext.Provider>
  )
}
