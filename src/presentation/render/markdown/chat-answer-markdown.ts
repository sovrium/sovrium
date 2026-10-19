/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An assistant's chat answer as the window draws it: its Markdown rendered by
 * the chat renderer (no raw HTML, no images), its blocks of code highlighted by
 * Shiki into token classes, the whole cleaned by the ONE canonical sanitizer
 * (S2), and each block then framed as a small Code Block. The chat stream
 * carries the result, so the browser ships no Markdown renderer, no sanitizer
 * and no highlighter.
 *
 * ## Why it is an Effect
 *
 * Shiki loads its engine and grammars lazily, so highlighting is asynchronous.
 * The stream renders the answer so far at most every 150 ms and once more on
 * `done`; the highlighter memoises each fence by language and source, so a
 * snapshot tokenises only the fence still being written. A highlighter that
 * fails is logged and the blocks stay plain — framed all the same: a reader
 * loses the colours, never the answer.
 */

import { Data, Effect } from 'effect'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { logError } from '@/infrastructure/logging/logger'
import { highlightOrdinalFences } from '@/infrastructure/markdown/chat-fence-highlighter'
import { renderChatMarkdown } from '@/infrastructure/markdown/chat-markdown-renderer'
import { spliceChatCodeFrames } from '@/presentation/render/markdown/markdown-code-frames'

/** The highlighter rejected: its engine or a grammar failed to load. */
class ChatHighlightError extends Data.TaggedError('ChatHighlightError')<{
  readonly cause: unknown
}> {}

/** Render, highlight, sanitize and frame an answer's Markdown; `''` for an empty answer. */
export const renderChatAnswerHtml = (markdown: string): Effect.Effect<string> => {
  if (markdown.length === 0) return Effect.succeed('')
  const { html, codeBlocks } = renderChatMarkdown(markdown)
  if (codeBlocks.length === 0) return Effect.succeed(sanitizeRichTextHTML(html))
  return Effect.tryPromise({
    try: () => highlightOrdinalFences(html, codeBlocks),
    catch: (cause) => new ChatHighlightError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[ai] highlighting the code of a chat answer failed', cause))
    ),
    // effect-swallow: the answer outranks its colours. The cause is logged above,
    // and the blocks keep their ordinal placeholders, so they are framed plain.
    Effect.orElseSucceed(() => html),
    Effect.map((highlighted) => spliceChatCodeFrames(sanitizeRichTextHTML(highlighted), codeBlocks))
  )
}
