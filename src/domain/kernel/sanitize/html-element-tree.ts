/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * HTML read into an INERT element tree, and written back out.
 *
 * A design drawing (a Claude Design board, for one) is HTML a person may have
 * edited by hand, so it is read with a real parser and never with a regular
 * expression: `htmlparser2`, through `sanitize-html`, the one HTML library the
 * domain may import (security rule S2). Only its tokeniser is used here; its
 * sanitising output is discarded. The tree holds tags, attributes and text,
 * nothing runs, and the text of a `<script>` or `<style>` element is never
 * read: such an element is kept as an empty node, so a reader can see it is
 * there and ignore it.
 *
 * ─── BOUNDS ────────────────────────────────────────────────────────────────
 *
 * An input past `MAX_HTML_LENGTH` characters, or nesting past `MAX_HTML_DEPTH`
 * elements, is refused rather than truncated: a drawing with a hole in it would
 * be read as a designer's deletion.
 */

import sanitizeHtml from 'sanitize-html'

/** An element: its lower-case tag, its attributes (decoded), and its children in order. */
export interface HtmlElementNode {
  readonly kind: 'element'
  readonly tag: string
  readonly attributes: Readonly<Record<string, string>>
  readonly children: readonly HtmlNode[]
}

/** A run of text, entities decoded. */
export interface HtmlTextNode {
  readonly kind: 'text'
  readonly text: string
}

/** One node of an inert HTML tree. */
export type HtmlNode = HtmlElementNode | HtmlTextNode

/** The longest input read: 16 MB, the most one design-tool call carries. */
export const MAX_HTML_LENGTH = 16 * 1024 * 1024

/** The deepest nesting read; a drawn page is never near it. */
export const MAX_HTML_DEPTH = 256

/** What reading some HTML gives: its top-level nodes, or why it was refused. */
export type HtmlTreeResult =
  | { readonly ok: true; readonly nodes: readonly HtmlNode[] }
  | { readonly ok: false; readonly reason: 'too-large' | 'too-deep' }

type HtmlEvent =
  | { readonly event: 'open'; readonly tag: string; readonly attributes: Record<string, string> }
  | { readonly event: 'close' }
  | { readonly event: 'text'; readonly text: string }

/** The elements whose content is raw text the tree never reads. */
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(['script', 'style'])

/** `sanitize-html` hands text over escaped (`&`, `<`, `>`); undo exactly that. */
const unescapeText = (text: string): string =>
  text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')

/** The parser's events, in document order. */
const eventsOf = (html: string): readonly HtmlEvent[] => {
  // eslint-disable-next-line functional/prefer-immutable-types -- the local accumulator of a streaming parser's callbacks, never shared
  const events: HtmlEvent[] = []
  const record = (event: HtmlEvent): string => {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- the one append the accumulator above exists for
    events.push(event)
    return ''
  }
  // eslint-disable-next-line functional/no-expression-statements -- the parse IS the call; its sanitised output is not used
  sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    // Nothing is emitted, so no tag is "allowed" into any output.
    allowVulnerableTags: true,
    // Every element's text but a raw-text element's reaches `textFilter`.
    nonTextTags: [...RAW_TEXT_TAGS],
    onOpenTag: (tag, attributes) => record({ event: 'open', tag, attributes: { ...attributes } }),
    onCloseTag: () => record({ event: 'close' }),
    textFilter: (text) => record({ event: 'text', text: unescapeText(text) }),
  })
  return events
}

/** An open element while the tree is built: its children are appended in place. */
interface OpenFrame {
  readonly tag: string
  readonly attributes: HtmlElementNode['attributes']
  readonly children: readonly HtmlNode[]
}

/** A child appended to a frame, adjacent text runs merged. */
const appendChild = (frame: OpenFrame, child: HtmlNode): undefined => {
  // The frame's own list, appended to in place while its element is open:
  // copying the sibling list per child made a wide document quadratic.
  const children = frame.children as HtmlNode[]
  const last = children.at(-1)
  const merged: HtmlNode =
    child.kind === 'text' && last?.kind === 'text'
      ? { kind: 'text', text: last.text + child.text }
      : child
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the in-place append described above
  children[merged === child ? children.length : children.length - 1] = merged
  return undefined
}

/** The innermost open frame closed into its parent; the root is never closed. */
// eslint-disable-next-line functional/prefer-immutable-types -- the parse's own stack, popped in place
const closeTop = (stack: OpenFrame[]): undefined => {
  if (stack.length <= 1) return undefined
  // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- the parse's own stack
  const top = stack.pop() as OpenFrame
  const node: HtmlElementNode = {
    kind: 'element',
    tag: top.tag,
    attributes: top.attributes,
    children: RAW_TEXT_TAGS.has(top.tag) ? [] : top.children,
  }
  return appendChild(stack.at(-1) as OpenFrame, node)
}

/** Every frame the input left open closed, innermost first, as a browser does. */
// eslint-disable-next-line functional/prefer-immutable-types -- the parse's own stack
const closeAll = (stack: OpenFrame[]): undefined =>
  stack.length <= 1 ? undefined : (closeTop(stack) ?? closeAll(stack))

/**
 * Read some HTML into its inert tree, in time linear in the input: every
 * event touches only the innermost open element.
 *
 * @param html - a document or a fragment.
 */
export const parseHtmlElementTree = (html: string): HtmlTreeResult => {
  if (html.length > MAX_HTML_LENGTH) return { ok: false, reason: 'too-large' }
  const root: OpenFrame = { tag: '', attributes: {}, children: [] }
  // eslint-disable-next-line functional/prefer-immutable-types -- the open elements of one parse, local and never shared
  const stack: OpenFrame[] = [root]
  const tooDeep = eventsOf(html).some((event) => {
    if (event.event === 'open') {
      if (stack.length > MAX_HTML_DEPTH) return true
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, no-restricted-syntax -- the parse's own stack
      stack.push({ tag: event.tag.toLowerCase(), attributes: event.attributes, children: [] })
      return false
    }
    if (event.event === 'close') return closeTop(stack) !== undefined
    return appendChild(stack.at(-1) as OpenFrame, { kind: 'text', text: event.text }) !== undefined
  })
  if (tooDeep) return { ok: false, reason: 'too-deep' }
  return closeAll(stack) ?? { ok: true, nodes: root.children }
}

/** The elements HTML writes with no end tag. */
const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const escapeAttribute = (value: string): string => escapeText(value).replaceAll('"', '&quot;')

/** An attribute name HTML can carry: no space, quote, `=`, `<`, `>` or `/`. */
const isAttributeName = (name: string): boolean => /^[^\s"'<>/=]+$/.test(name)

const attributesText = (attributes: Readonly<Record<string, string>>): string =>
  Object.entries(attributes)
    .filter(([name]) => isAttributeName(name))
    .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join('')

/**
 * Write a tree back out as HTML: every text escaped, every attribute quoted,
 * and a raw-text element written empty.
 */
export const serializeHtmlNodes = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) => {
      if (node.kind === 'text') return escapeText(node.text)
      const open = `<${node.tag}${attributesText(node.attributes)}>`
      if (VOID_TAGS.has(node.tag)) return open
      const inner = RAW_TEXT_TAGS.has(node.tag) ? '' : serializeHtmlNodes(node.children)
      return `${open}${inner}</${node.tag}>`
    })
    .join('')

/** The text of some nodes, depth first, raw-text elements contributing none. */
export const textOfHtmlNodes = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text'
        ? node.text
        : RAW_TEXT_TAGS.has(node.tag)
          ? ''
          : textOfHtmlNodes(node.children)
    )
    .join('')
