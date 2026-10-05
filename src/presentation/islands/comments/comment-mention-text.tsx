/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { splitMentionMarkup } from '@/domain/models/app/tables/comment-mention-markup-service'
import { mentionLabel } from './comment-mention-source'
import { useMentionString } from './comment-mention-strings'
import type { CommentRecord } from './comment-thread-types'
import type { ReactElement } from 'react'

/**
 * A comment body with its mentions rendered as names.
 *
 * Every run — text and mention alike — is a React text child, so a body can
 * never inject markup into the page (S2); nothing here builds an HTML string.
 * A segment's position in an immutable body is its only identity, hence the
 * index key.
 */
export function CommentBodyText({ comment }: { readonly comment: CommentRecord }): ReactElement {
  const labelFor = mentionLabel(comment, useMentionString('unknownUser'))
  return (
    <>
      {splitMentionMarkup(comment.content).map((segment, index) =>
        segment.kind === 'text' ? (
          segment.text
        ) : (
          <span
            key={index}
            data-comment-mention=""
            className="font-medium"
          >
            {labelFor(segment.id)}
          </span>
        )
      )}
    </>
  )
}
