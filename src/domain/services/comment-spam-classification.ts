/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type CommentSpamStatus = 'approved' | 'pending' | 'rejected'

export interface CommentSpamProtectionConfig {
  readonly maxLinksBeforeModeration?: number
  readonly blockedWords?: ReadonlyArray<string>
}

export function countLinks(content: string): number {
  if (content.length === 0) return 0
  const pattern = /https?:\/\/|www\./gi
  const matches = content.match(pattern)
  return matches?.length ?? 0
}

export function hasBlockedWord(content: string, words: ReadonlyArray<string>): boolean {
  if (words.length === 0) return false
  const lowered = content.toLowerCase()
  return words.some((word) => {
    if (word.length === 0) return false
    return lowered.includes(word.toLowerCase())
  })
}

export function classifyCommentBySpam(
  content: string,
  config: CommentSpamProtectionConfig | undefined
): CommentSpamStatus {
  if (config === undefined) return 'approved'
  const blockedWords = config.blockedWords ?? []
  if (hasBlockedWord(content, blockedWords)) return 'rejected'
  const threshold = config.maxLinksBeforeModeration
  if (typeof threshold === 'number' && countLinks(content) > threshold) return 'pending'
  return 'approved'
}
