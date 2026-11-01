/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { extractAttachmentText } from './document-parser'

/**
 * The extracted text of chat attachments, kept so a file is parsed once.
 *
 * Every turn of a conversation hands the model its whole history again, and a
 * PDF in that history would be re-parsed in-process on each of them. The
 * text depends only on the file's bytes and the media type it was judged to
 * be, so it is keyed by those: a SHA-256 of the content and the type. The same
 * file uploaded twice is parsed once.
 *
 * Bounded both ways, least recently used first out: {@link MAX_ENTRIES} files
 * and {@link MAX_TOTAL_CHARACTERS} characters of text in all. A text larger
 * than the whole budget is never kept. Only a successful read is kept; a file
 * with no text, or one that failed to parse, is read again next time.
 */

const MAX_ENTRIES = 64
const MAX_TOTAL_CHARACTERS = 16 * 1024 * 1024

export interface AttachmentTextCache {
  readonly extract: (input: {
    readonly mediaType: string
    readonly bytes: Uint8Array
  }) => Promise<string | undefined>
  /** Files currently kept. */
  readonly size: () => number
}

type Extract = typeof extractAttachmentText

const keyOf = (mediaType: string, bytes: Uint8Array): string =>
  `${mediaType}:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`

/** A bounded cache in front of `extract` (the real parser unless a test injects one). */
export const makeAttachmentTextCache = (
  extract: Extract = extractAttachmentText,
  limits: { readonly maxEntries: number; readonly maxTotalCharacters: number } = {
    maxEntries: MAX_ENTRIES,
    maxTotalCharacters: MAX_TOTAL_CHARACTERS,
  }
): AttachmentTextCache => {
  const texts = new Map<string, string>()
  const state = { characters: 0 }

  const evictUntilFits = (incoming: number): void => {
    while (
      texts.size > 0 &&
      (texts.size >= limits.maxEntries || state.characters + incoming > limits.maxTotalCharacters)
    ) {
      const oldest = texts.keys().next().value as string
      state.characters -= texts.get(oldest)?.length ?? 0
      texts.delete(oldest)
    }
  }

  const remember = (key: string, text: string): void => {
    if (text.length > limits.maxTotalCharacters) return
    evictUntilFits(text.length)
    texts.set(key, text)
    state.characters += text.length
  }

  return {
    extract: async (input) => {
      const key = keyOf(input.mediaType, input.bytes)
      const kept = texts.get(key)
      if (kept !== undefined) {
        // Re-insert: the Map's order is the recency order.
        texts.delete(key)
        texts.set(key, kept)
        return kept
      }
      const text = await extract(input)
      if (text !== undefined) remember(key, text)
      return text
    },
    size: () => texts.size,
  }
}

/** The process-wide cache the chat reads attachments through. */
export const attachmentTextCache: AttachmentTextCache = makeAttachmentTextCache()
