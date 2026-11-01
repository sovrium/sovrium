/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtmlDoubleQuotedAttribute } from '@/domain/kernel/sanitize/html-escaping'

/**
 * The wrapper every markdown table is drawn in.
 *
 * `typeset-scroll` is Typeset's own scroll wrapper: it takes the flow space
 * above the block and `overflow-x: auto`, and widens the table inside it to its
 * content, so a table wider than the column scrolls instead of squeezing its
 * cells, and the page itself never grows wider than the screen. The rest is
 * read once the body-end table scroll runtime has decided the table overflows
 * (`data-scrollable`): a focus ring drawn inside the edge, since the wrapper is
 * then a tab stop, and a fade over the trailing edge that says the table goes
 * on, lifted once the reader has scrolled to the end.
 */
export const MARKDOWN_TABLE_SCROLL_CLASSES =
  'typeset-scroll focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[scrollable=true]:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] rtl:data-[scrollable=true]:[mask-image:linear-gradient(to_left,#000_calc(100%-2.5rem),transparent)]'

/** A whole `<table>` element of the engine's markdown output (tables never nest there). */
const TABLE_ELEMENT = /<table(?=[\s>])[^>]*>[\s\S]*?<\/table>/g

/**
 * Rendered markdown with every `<table>` inside its scroll wrapper.
 *
 * The wrapper carries `data-table-scroll`, whose value opens the name the
 * runtime gives the region when the table overflows: `"Table: Variable,
 * Default, Purpose"`, the word in the page's language and the column headers
 * read off the table itself. A table that fits is left with no role, name or
 * tab stop. The table keeps its own classes, so a `table` part class still
 * lands on the `<table>`.
 *
 * @param html - Sanitised HTML the engine rendered from markdown.
 * @param label - The localised word that opens a table region's name.
 */
export const wrapMarkdownTables = (html: string, label: string): string =>
  html.replace(
    TABLE_ELEMENT,
    (table) =>
      `<div class="${MARKDOWN_TABLE_SCROLL_CLASSES}" data-table-scroll="${escapeHtmlDoubleQuotedAttribute(label)}">${table}</div>`
  )
