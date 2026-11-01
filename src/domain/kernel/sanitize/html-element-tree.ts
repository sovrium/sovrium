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
import { escapeHtmlDoubleQuotedAttribute, escapeHtmlText } from './html-escaping'

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

/** The elements whose content is raw text the tree never reads. */
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(['script', 'style'])

/** `sanitize-html` hands text over escaped (`&`, `<`, `>`); undo exactly that. */
const unescapeText = (text: string): string =>
  text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')

/** An open element while the tree is built: its children are appended in place. */
interface OpenFrame {
  readonly tag: string
  readonly attributes: HtmlElementNode['attributes']
  readonly children: readonly HtmlNode[]
}

/*
 * `sanitize-html` reports a parse ONLY through side-effecting callbacks, so the
 * tree is built inside them: one stack of open frames, each frame's child list
 * appended in place while its element is open (copying a sibling list per child
 * made a wide document quadratic). All of it is local to one parse and never
 * shared; the finished tree is handed out read-only.
 */
/* eslint-disable functional/immutable-data, functional/no-expression-statements, functional/prefer-immutable-types, no-restricted-syntax -- the parser's callback contract: the tree is built by mutating one parse's local stack, as described above */

/** A child appended to a frame, adjacent text runs merged. */
const appendChild = (frame: OpenFrame, child: HtmlNode): void => {
  const children = frame.children as HtmlNode[]
  const last = children.at(-1)
  if (child.kind === 'text' && last?.kind === 'text') {
    children[children.length - 1] = { kind: 'text', text: last.text + child.text }
  } else {
    children.push(child)
  }
}

/** The innermost open frame closed into its parent; the root is never closed. */
const closeTop = (stack: OpenFrame[]): void => {
  if (stack.length <= 1) return
  const top = stack.pop() as OpenFrame
  appendChild(stack.at(-1) as OpenFrame, {
    kind: 'element',
    tag: top.tag,
    attributes: top.attributes,
    children: RAW_TEXT_TAGS.has(top.tag) ? [] : top.children,
  })
}

/** Every frame the input left open closed, innermost first, as a browser does. */
const closeAll = (stack: OpenFrame[]): void => {
  if (stack.length <= 1) return
  closeTop(stack)
  closeAll(stack)
}

/**
 * Read some HTML into its inert tree, in time linear in the input: every
 * event touches only the innermost open element.
 *
 * @param html - a document or a fragment.
 */
export const parseHtmlElementTree = (html: string): HtmlTreeResult => {
  if (html.length > MAX_HTML_LENGTH) return { ok: false, reason: 'too-large' }
  const root: OpenFrame = { tag: '', attributes: {}, children: [] }
  const stack: OpenFrame[] = [root]
  // Past the depth bound the rest of the parse is ignored: the answer is a refusal.
  const state = { tooDeep: false }
  sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    // Nothing is emitted, so no tag is "allowed" into any output.
    allowVulnerableTags: true,
    // Every element's text but a raw-text element's reaches `textFilter`.
    nonTextTags: [...RAW_TEXT_TAGS],
    onOpenTag: (tag, attributes) => {
      if (state.tooDeep) return
      if (stack.length > MAX_HTML_DEPTH) {
        state.tooDeep = true
        return
      }
      stack.push({ tag: tag.toLowerCase(), attributes: { ...attributes }, children: [] })
    },
    onCloseTag: () => {
      if (!state.tooDeep) closeTop(stack)
    },
    textFilter: (text) => {
      if (!state.tooDeep)
        appendChild(stack.at(-1) as OpenFrame, { kind: 'text', text: unescapeText(text) })
      return ''
    },
  })
  if (state.tooDeep) return { ok: false, reason: 'too-deep' }
  closeAll(stack)
  return { ok: true, nodes: root.children }
}

/* eslint-enable functional/immutable-data, functional/no-expression-statements, functional/prefer-immutable-types, no-restricted-syntax -- end of the parse */

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

/** An attribute name HTML can carry: no space, quote, `=`, `<`, `>` or `/`. */
const isAttributeName = (name: string): boolean => /^[^\s"'<>/=]+$/.test(name)

const attributesText = (attributes: Readonly<Record<string, string>>): string =>
  Object.entries(attributes)
    .filter(([name]) => isAttributeName(name))
    .map(([name, value]) =>
      value === '' ? ` ${name}` : ` ${name}="${escapeHtmlDoubleQuotedAttribute(value)}"`
    )
    .join('')

/**
 * Write a tree back out as HTML: every text escaped, every attribute quoted,
 * and a raw-text element written empty.
 *
 * @param nodes - the tree.
 * @param writeText - how each escaped text run is written; as it is by default.
 */
export const serializeHtmlNodes = (
  nodes: readonly HtmlNode[],
  writeText: (escaped: string) => string = (escaped) => escaped
): string =>
  nodes
    .map((node) => {
      if (node.kind === 'text') return writeText(escapeHtmlText(node.text))
      const open = `<${node.tag}${attributesText(node.attributes)}>`
      if (VOID_TAGS.has(node.tag)) return open
      const inner = RAW_TEXT_TAGS.has(node.tag) ? '' : serializeHtmlNodes(node.children, writeText)
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
