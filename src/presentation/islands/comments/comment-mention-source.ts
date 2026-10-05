/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import {
  decodeMentionMarkup,
  type MentionPick,
} from '@/domain/models/app/tables/comment-mention-markup-service'
import type { CommentRecord } from './comment-thread-types'

/**
 * The record a thread's composers mention people on. Provided once by the
 * thread island so the reply and edit forms deep in the list need no props
 * threaded through every row to reach the picker's endpoint.
 */
export const CommentMentionSource = createContext<
  { readonly tableName: string; readonly recordId: string } | undefined
>(undefined)

/**
 * What a reader sees for one token: `@<name>` for a person the server resolved
 * among the record's readers, the neutral placeholder for anyone else — never
 * the markup, the id, or the name of someone who cannot read the record.
 */
export function mentionLabel(comment: CommentRecord, unknownUser: string): (id: string) => string {
  const names = new Map((comment.mentions ?? []).map((mention) => [mention.id, mention.name]))
  return (id) => {
    const name = names.get(id)
    return name === undefined ? unknownUser : `@${name}`
  }
}

/**
 * The body as its author edits it — names in place of markup — and the picks
 * that write the same markup back on save.
 */
export function decodeForEdit(
  comment: CommentRecord,
  unknownUser: string
): {
  readonly text: string
  readonly picks: readonly MentionPick[]
} {
  return decodeMentionMarkup(comment.content, mentionLabel(comment, unknownUser))
}
