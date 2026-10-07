/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'

/**
 * The prose parts of rendered markdown, each as the opening tags it names.
 *
 * The HTML is the engine's own output (markdown-it, the code frames, the
 * callouts), already sanitised, so its tag shapes are known: these patterns
 * read that output, never author HTML.
 */
const PART_TAGS: Readonly<Record<string, RegExp>> = {
  heading1: /<h1(?=[\s>])[^>]*>/g,
  heading2: /<h2(?=[\s>])[^>]*>/g,
  heading3: /<h3(?=[\s>])[^>]*>/g,
  paragraph: /<p(?=[\s>])[^>]*>/g,
  listItem: /<li(?=[\s>])[^>]*>/g,
  list: /<[uo]l(?=[\s>])[^>]*>/g,
  table: /<table(?=[\s>])[^>]*>/g,
  link: /<a(?=[\s>])[^>]*>/g,
  quote: /<blockquote(?=[\s>])[^>]*>/g,
  image: /<img(?=[\s>/])[^>]*>/g,
  codeBlock: /<pre(?=[\s>])[^>]*>/g,
  // A `code` that does not open right after its `<pre>`: the inline spans only.
  inlineCode: /(?<!<pre[^>]*>)<code(?=[\s>])[^>]*>/g,
  codeFrame: /<figure(?=[\s>])[^>]*data-code-frame[^>]*>/g,
  codeCaption: /<figcaption(?=[\s>])[^>]*>/g,
  // The paragraph right under the page title.
  lead: /(?<=<\/h1>\s*)<p(?=[\s>])[^>]*>/g,
  callout: /<div(?=[\s>])[^>]*data-component="alert"[^>]*>/g,
  calloutInfo: /<div(?=[\s>])[^>]*data-component="alert" data-type="info"[^>]*>/g,
  calloutNote: /<div(?=[\s>])[^>]*data-component="alert" data-type="note"[^>]*>/g,
  calloutTip: /<div(?=[\s>])[^>]*data-component="alert" data-type="tip"[^>]*>/g,
  calloutWarning: /<div(?=[\s>])[^>]*data-component="alert" data-type="warning"[^>]*>/g,
  calloutDanger: /<div(?=[\s>])[^>]*data-component="alert" data-type="danger"[^>]*>/g,
}

const CLASS_ATTRIBUTE = /\sclass="([^"]*)"/

/**
 * One opening tag, with `classes` merged over its own class list (later wins)
 * and a `data-part` marker: the docs layout's own prose sheet steps aside for
 * an element the author styled by part.
 */
const withClasses = (tag: string, classes: string): string => {
  const marked = tag.includes(' data-part') ? tag : tag.replace(/^<[a-z0-9]+/, '$& data-part')
  const existing = CLASS_ATTRIBUTE.exec(marked)
  if (existing) return marked.replace(CLASS_ATTRIBUTE, ` class="${cn(existing[1], classes)}"`)
  const end = marked.endsWith('/>') ? marked.length - 2 : marked.length - 1
  return `${marked.slice(0, end)} class="${classes}"${marked.slice(end)}`
}

/** Escape the characters an HTML attribute value cannot hold. */
const escapeAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

/**
 * Rendered markdown with the author's prose part classes on the elements they
 * name — `paragraph` on every `<p>`, `inlineCode` on inline `<code>`, a
 * callout part on its alert, and so on. Parts the map does not name, and
 * names that are not prose parts, change nothing.
 *
 * @param html - Sanitised HTML the engine rendered from markdown.
 * @param parts - Classes by part name (`design.components` / `classes`, states folded in).
 */
export const applyProsePartClasses = (
  html: string,
  parts: Readonly<Record<string, string>> | undefined
): string => {
  if (parts === undefined) return html
  return Object.entries(PART_TAGS).reduce((current, [part, pattern]) => {
    const classes = parts[part]
    if (classes === undefined || classes.trim() === '') return current
    return current.replace(pattern, (tag) => withClasses(tag, escapeAttribute(classes)))
  }, html)
}
