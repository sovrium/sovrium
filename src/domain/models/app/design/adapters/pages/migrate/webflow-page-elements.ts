/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HtmlElementNode, HtmlNode } from '@/domain/kernel/sanitize/html-element-tree'

/**
 * Which Webflow element an exported HTML element is, named the way Webflow's
 * Designer typings name it (`Section`, `Block`, `HFlex`, `DropdownWrapper`
 * …). This module only recognises; `webflow-page-mappings.ts` decides what
 * each name becomes.
 *
 * An export marks an element by its tag and its `w-` classes (fact c6): the
 * pinned export shows `w-layout-hflex`, `w-layout-vflex`,
 * `w-layout-blockcontainer`, `w-container`, `w-inline-block` and the
 * `w-dropdown` family; the others below are the classes Webflow's own
 * `webflow.css` declares for its elements. A class is checked before a tag:
 * `div.w-layout-grid` is a `Grid`, not a `Block`. A tag no Webflow element
 * writes is `DOM`, the typings' name for a custom element.
 *
 * A script is never read. Webflow's runtime (`js/webflow.js`, and the jQuery
 * it loads from its CDN) is the export's machinery and is skipped; any other
 * script in the body is custom code, reported as `CustomCode`.
 */

/** What an element is: a Webflow element, or nothing the page shows. */
export type WebflowElementKind =
  { readonly kind: 'element'; readonly name: string } | { readonly kind: 'skip' }

/** The classes Webflow writes for its elements, in the order they are checked. */
const BY_CLASS: readonly (readonly [string, string])[] = [
  ['w-video', 'Video'],
  ['w-embed', 'HtmlEmbed'],
  ['w-dropdown', 'DropdownWrapper'],
  ['w-nav', 'NavbarWrapper'],
  ['w-slider', 'SliderWrapper'],
  ['w-lightbox', 'LightboxWrapper'],
  ['w-background-video', 'BackgroundVideoWrapper'],
  ['w-widget-map', 'MapWidget'],
  ['w-pagination-wrapper', 'Pagination'],
  ['w-locales-list', 'LocalesWrapper'],
  ['w-form', 'FormWrapper'],
  ['w-tabs', 'TabsWrapper'],
  ['w-dyn-list', 'DynamoWrapper'],
  ['w-richtext', 'RichText'],
  ['w-layout-grid', 'Grid'],
  ['w-layout-hflex', 'HFlex'],
  ['w-layout-vflex', 'VFlex'],
  ['w-layout-blockcontainer', 'Container'],
  ['w-container', 'Container'],
  ['w-row', 'Row'],
  ['w-col', 'Column'],
]

/** The tags Webflow writes for its elements. */
const BY_TAG: Readonly<Record<string, string>> = {
  section: 'Section',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  p: 'Paragraph',
  blockquote: 'Blockquote',
  a: 'Link',
  img: 'Image',
  pre: 'CodeBlock',
  ul: 'List',
  ol: 'List',
  li: 'ListItem',
  figure: 'Figure',
  figcaption: 'Figcaption',
  iframe: 'Iframe',
  video: 'Video',
  form: 'FormForm',
  label: 'FormBlockLabel',
  input: 'FormTextInput',
  textarea: 'FormTextarea',
  select: 'FormSelect',
  button: 'FormButton',
  span: 'Span',
  strong: 'Strong',
  em: 'Emphasized',
  code: 'InlineCode',
  sup: 'Superscript',
  sub: 'Subscript',
  div: 'Block',
  nav: 'Block',
  header: 'Block',
  footer: 'Block',
  main: 'Block',
  article: 'Block',
  aside: 'Block',
  address: 'Block',
}

/** Tags that are the document's machinery, never a page element. */
const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'style',
  'noscript',
  'template',
  'link',
  'meta',
  'title',
  'head',
  'br',
  'wbr',
])

/** Webflow's own runtime: `js/webflow.js`, and jQuery from Webflow's CDN (fact c2). */
const isWebflowRuntime = (src: string | undefined): boolean =>
  src !== undefined &&
  (/(?:^|\/)js\/webflow\.js(?:\?|$)/.test(src) ||
    /^https:\/\/d3e54v103j8qbb\.cloudfront\.net\/js\/jquery/.test(src))

/** An element's classes, in the order the attribute lists them. */
export const classesOf = (element: HtmlElementNode): readonly string[] =>
  (element.attributes['class'] ?? '').split(/\s+/).filter((name) => name !== '')

/** The Webflow element an exported element is. */
export const webflowElementOf = (element: HtmlElementNode): WebflowElementKind => {
  if (element.tag === 'script') {
    return isWebflowRuntime(element.attributes['src'])
      ? { kind: 'skip' }
      : { kind: 'element', name: 'CustomCode' }
  }
  if (SKIPPED_TAGS.has(element.tag)) return { kind: 'skip' }
  const classes = new Set(classesOf(element))
  const byClass = BY_CLASS.find(([name]) => classes.has(name))?.[1]
  if (byClass !== undefined) return { kind: 'element', name: byClass }
  const byTag = Object.hasOwn(BY_TAG, element.tag) ? BY_TAG[element.tag] : undefined
  return { kind: 'element', name: byTag ?? 'DOM' }
}

/** The tags that only format a run of text. */
const INLINE_TEXT_TAGS: ReadonlySet<string> = new Set([
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'mark',
  'sup',
  'sub',
  'code',
  'br',
  'wbr',
])

/**
 * Whether some nodes are a run of text only: text and the tags that format
 * it, and no element of their own. A Div Block holding that is a Text Block.
 */
export const isTextOnly = (nodes: readonly HtmlNode[]): boolean =>
  nodes.every(
    (node) =>
      node.kind === 'text' ||
      (INLINE_TEXT_TAGS.has(node.tag) &&
        !classesOf(node).some((name) => name.startsWith('w-')) &&
        isTextOnly(node.children))
  )
