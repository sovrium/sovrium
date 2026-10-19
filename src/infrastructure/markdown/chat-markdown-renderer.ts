/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import MarkdownIt from 'markdown-it'
import { pinLinkifyBehaviour } from '@/infrastructure/markdown/pin-linkify-behaviour'

/**
 * One block of code in a reply, out of band of its HTML: what the highlighter
 * colours, and what the frame around it is titled by.
 */
export interface ChatCodeBlock {
  /** The language the fence names, verbatim (`sql`); `''` for a block naming none. */
  readonly lang: string
  /** The source as the model wrote it, without the newline before the closing marker. */
  readonly code: string
  /**
   * Whether the fence has its closing marker. A reply rendered mid-stream ends
   * inside an open fence, which markdown-it closes at the end of the input as
   * if it were complete; this is what tells the two apart.
   */
  readonly closed: boolean
}

/** A rendered reply: its HTML, and its blocks of code in the order their ordinals name them. */
export interface RenderedChatMarkdown {
  readonly html: string
  readonly codeBlocks: readonly ChatCodeBlock[]
}

/** What a render threads through markdown-it's `env`: the source lines, and the blocks met. */
type ChatRenderEnv = {
  readonly lines: readonly string[]
  /** Grown by each code rule as the render meets a block: `env` is markdown-it's accumulator. */
  codeBlocks: readonly ChatCodeBlock[]
}

/** The env a rule is handed, when it is the chat's own (it always is: only `renderChatMarkdown` renders). */
const chatEnvOf = (env: unknown): ChatRenderEnv | undefined =>
  typeof env === 'object' &&
  env !== null &&
  Array.isArray((env as Partial<ChatRenderEnv>).codeBlocks) &&
  Array.isArray((env as Partial<ChatRenderEnv>).lines)
    ? (env as ChatRenderEnv)
    : undefined

/** The part of a markdown-it block token the code rules read. */
interface CodeToken {
  readonly map: readonly [number, number] | null
  readonly markup: string
  readonly info: string
  readonly content: string
}

/** A fence's closing marker, behind any container prefix (a blockquote's `>`, a list's indent). */
const CLOSING_MARKER_RE = /^[\s>]*(`{3,}|~{3,})[ \t]*$/

/**
 * Whether a fence has its closing marker. markdown-it maps a closed fence onto
 * its lines INCLUDING the closer, and an open one onto the lines up to the end
 * of the input — so the last mapped line is a closer of the opener's character,
 * at least as long, only when the model wrote one.
 */
const isClosedFence = (token: CodeToken, lines: readonly string[]): boolean => {
  if (token.map === null) return true
  const [start, end] = token.map
  if (end - 1 <= start) return false
  const marker = CLOSING_MARKER_RE.exec(lines[end - 1] ?? '')?.[1]
  return (
    marker !== undefined &&
    marker.charAt(0) === token.markup.charAt(0) &&
    marker.length >= token.markup.length
  )
}

/** Escape text for the placeholder; the same four characters markdown-it escapes. */
const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A block's source, without the one newline markdown-it keeps before its closer. */
const blockCode = (content: string): string =>
  content.endsWith('\n') ? content.slice(0, -1) : content

/**
 * A block of code as the chat draws it before the highlighter and the frame: a
 * plain `<pre class="shiki">` carrying its ORDINAL as a class (`sv-md-code-N`, the carrier the
 * docs pipeline uses, because the canonical sanitizer keeps `class` and drops
 * every `data-*`), around the escaped source. The highlighter replaces it by its
 * ordinal, and the frame is spliced around it after the sanitizer.
 */
const codePlaceholder = (env: ChatRenderEnv, block: ChatCodeBlock): string => {
  const index = env.codeBlocks.length
  env.codeBlocks = [...env.codeBlocks, block]
  const language = block.lang.length === 0 ? '' : ` class="language-${escapeHtml(block.lang)}"`
  return `<pre class="sv-md-code-${String(index)} shiki"><code${language}>${escapeHtml(block.code)}</code></pre>\n`
}

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
 *  - every block of code, fenced or indented, becomes an ordinal placeholder
 *    (above), so no `<pre>` reaches the reader outside its frame.
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
  md.renderer.rules.fence = (tokens, idx, _options, env) => {
    const token: CodeToken | undefined = tokens[idx]
    const chatEnv = chatEnvOf(env)
    if (token === undefined || chatEnv === undefined) return ''
    const lang = token.info.trim().split(/\s+/)[0] ?? ''
    const closed = isClosedFence(token, chatEnv.lines)
    return codePlaceholder(chatEnv, { lang, code: blockCode(token.content), closed })
  }
  md.renderer.rules.code_block = (tokens, idx, _options, env) => {
    const token = tokens[idx]
    const chatEnv = chatEnvOf(env)
    if (token === undefined || chatEnv === undefined) return ''
    return codePlaceholder(chatEnv, { lang: '', code: blockCode(token.content), closed: true })
  }
  return md
}

const CHAT_RENDERER = createChatRenderer()

Object.freeze(CHAT_RENDERER.renderer.rules)

/**
 * Render an assistant reply's Markdown into HTML, for the canonical sanitizer to
 * clean, with its blocks of code out of band: `codeBlocks[N]` is the block whose
 * placeholder `<pre>` carries the class `sv-md-code-N`.
 */
export const renderChatMarkdown = (source: string): RenderedChatMarkdown => {
  const env: ChatRenderEnv = { lines: source.split('\n'), codeBlocks: [] }
  const html = CHAT_RENDERER.render(source, env)
  return { html, codeBlocks: env.codeBlocks }
}
