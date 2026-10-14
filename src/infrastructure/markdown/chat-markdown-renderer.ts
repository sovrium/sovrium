/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import MarkdownIt from 'markdown-it'
import { pinLinkifyBehaviour } from '@/infrastructure/markdown/pin-linkify-behaviour'

/**
 * The Markdown renderer behind an assistant's chat reply — a SEPARATE frozen
 * instance, because a model's words are not an author's and get a narrower
 * policy than a page:
 *
 *  - `html: false`: raw HTML in a reply is escaped to visible text, never parsed.
 *  - `image` disabled: `![alt](url)` renders as `!` plus a link, never an image.
 *    An image a model writes is fetched the moment it is drawn, which is how a
 *    prompt-injected reply would carry data out to a third party in its URL.
 *  - `breaks: true`: a model's single newline is a line break, as it meant it.
 *  - every link opens in a new tab with `rel="noopener noreferrer"`, so
 *    following one does not leave the conversation.
 *
 * The output still passes the ONE canonical sanitizer before it reaches the
 * page (S2); this renderer is the narrowing, not the boundary.
 */
const createChatRenderer = () => {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).disable(['image'])
  pinLinkifyBehaviour(md)
  // eslint-disable-next-line max-params -- renderer.rules IS markdown-it's plugin contract; signature is library-imposed
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx]
    if (!token) return ''
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
    return self.renderToken(tokens, idx, options)
  }
  return md
}

const CHAT_RENDERER = createChatRenderer()

Object.freeze(CHAT_RENDERER.renderer.rules)

/** Render an assistant reply's Markdown into HTML, for the canonical sanitizer to clean. */
export const renderChatMarkdownToHtml = (source: string): string => CHAT_RENDERER.render(source)
