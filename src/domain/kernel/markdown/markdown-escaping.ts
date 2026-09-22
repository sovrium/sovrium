/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Escaping for values interpolated into GENERATED markdown.
 *
 * The single canonical markdown escaper — never re-inline a `.replace(/\|/g,
 * '\\|')` at a call site. A partial escaper here is not a style problem: the
 * value being escaped is app-config authored (token descriptions, voice rules,
 * component guidance), and a table row that splits at the wrong column is served
 * to a model as if it were the design system's own statement.
 */

/**
 * `value`, safe to place inside a single cell of a markdown table.
 *
 * Two hazards, both of which break the row rather than merely look wrong:
 *
 *   `|`   the column separator. An authored pipe adds a column.
 *   `\`   the escape character itself. Escaping ONLY the pipe is worse than
 *         escaping nothing: `a\|b` becomes `a\\|b`, which GFM reads as an
 *         escaped BACKSLASH followed by a live separator — so the very input
 *         that looks already-escaped is the one that splits the row.
 *   `\n`  ends the row outright, silently truncating the table.
 *
 * The two escapes therefore happen in ONE pass over a character class
 * containing both. A two-step chain (`\` first, then `|`) is also correct, but
 * it leaves a second `.replace` for the next reader to reorder.
 *
 * Deliberately NOT idempotent: escaping twice yields `\\\\` for one backslash,
 * because that is what "escape this text" means. Escape once, at the boundary.
 */
export const escapeMarkdownTableCell = (value: string): string =>
  value.replace(/\r?\n/g, ' ').replace(/[\\|]/g, (character) => `\\${character}`)
