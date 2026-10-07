/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeCommentMentionCaptionClasses,
  computeCommentMentionOptionClasses,
  computeCommentMentionPickerClasses,
} from '@/presentation/design/comments-default-classes'
import { useMentionString } from './comment-mention-strings'
import { mentionOptionId, type MentionComposer } from './use-mention-composer'
import type { ReactElement } from 'react'

/** What the list says when it offers nobody, per search state. */
const EMPTY_STATE = { failed: 'loadFailed', loading: 'loading', ready: 'noMatches' } as const

/**
 * The `@` picker under a comment textarea: a listbox of the record's readers.
 *
 * Focus never leaves the textarea — the writer keeps typing to narrow the list,
 * and the textarea's `aria-activedescendant` points at the active option. So an
 * option must not take focus on press either, which is why the press is
 * cancelled on `mousedown` and the pick happens on `click`.
 *
 * `aria-selected` marks the ACTIVE option (the one Enter or Tab would pick), as
 * a single-select listbox driven from its input does.
 */
export function CommentMentionListbox({
  composer,
  listboxId,
}: {
  readonly composer: MentionComposer
  readonly listboxId: string
}): ReactElement {
  const { candidates, activeIndex, status, pick } = composer
  const label = useMentionString('label')
  const emptyLabel = useMentionString(EMPTY_STATE[status])
  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label={label}
      className={computeCommentMentionPickerClasses()}
    >
      {candidates.length === 0 ? (
        <li className={computeCommentMentionCaptionClasses()}>{emptyLabel}</li>
      ) : (
        candidates.map((candidate, index) => (
          <li
            key={candidate.id}
            id={mentionOptionId(listboxId, index)}
            role="option"
            aria-selected={index === activeIndex}
            className={computeCommentMentionOptionClasses({ active: index === activeIndex })}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(candidate)}
          >
            {candidate.name}
          </li>
        ))
      )}
    </ul>
  )
}
