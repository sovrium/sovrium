/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCommentString } from './comment-strings'

/**
 * The English of each string the mention picker speaks, and of a mention the
 * thread cannot name. Each is catalogued as `comments.mention.<name>`, and the
 * server resolves it against the page language with the rest of `comments.*`.
 */
const MENTION_STRINGS = {
  label: 'Mention someone',
  noMatches: 'No matches',
  loading: 'Searching…',
  loadFailed: 'Could not load people',
  unknownUser: '@unknown user',
} as const

/** One mention string in the page language. */
export function useMentionString(name: keyof typeof MENTION_STRINGS): string {
  return useCommentString(`comments.mention.${name}`, MENTION_STRINGS[name])
}
