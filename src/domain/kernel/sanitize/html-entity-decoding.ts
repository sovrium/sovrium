/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one HTML entity DECODER: the twin of `html-escaping.ts`'s encoders, for
 * the places that read rendered HTML back into plain text — a page's text for
 * the search index, an imported form label written in HTML.
 *
 * It reads the named entities the engine's encoders and the common HTML
 * sources write (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&#39;`), and
 * `&nbsp;` as an ordinary space. It decodes in ONE pass, so `&amp;lt;` reads as
 * the text `&lt;`, never as `<`. Any other entity is left as written.
 *
 * Its output is TEXT. It is never markup and must never be placed as HTML: a
 * decoded `&lt;script&gt;` is the string `<script>`.
 */

const ENTITY_TEXT: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
}

const ENTITY = /&(?:amp|lt|gt|quot|apos|nbsp|#39);/gu

/** `text` with the entities above read back into the characters they stand for. */
export const decodeHtmlEntities = (text: string): string =>
  text.replace(ENTITY, (entity) => ENTITY_TEXT[entity] ?? entity)
