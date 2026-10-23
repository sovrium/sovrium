/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `true` when a page-level `source.file` is read as markdown: its path ends in
 * `.md`, compared case-insensitively (`about.md`, `Legal.MD`). Any other
 * extension (an `.html` for an `htmlSrc` integration, a `.json`) is read by no
 * renderer. One rule for its two readers: the page renderer, which wraps the
 * file in a markdown article, and `sovrium bundle`, which carries the file.
 */
export const isMarkdownSourceFile = (path: string): boolean => path.toLowerCase().endsWith('.md')
