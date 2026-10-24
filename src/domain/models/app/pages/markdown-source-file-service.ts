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

/** A page that reads its body from the file its `markdown.file` names. */
export interface MarkdownFileDeclaration {
  readonly page: string
  readonly file: string
}

/** The slice of a page {@link markdownFileDeclarations} reads. */
interface MarkdownFilePage {
  readonly name: string
  readonly markdown?: { readonly content?: string; readonly file?: string }
}

/**
 * Every page whose body is read from its `markdown.file`. A page that also
 * sets `markdown.content` is left out: inline content wins, so its file is
 * never read and its absence changes nothing.
 */
export const markdownFileDeclarations = (
  pages: ReadonlyArray<MarkdownFilePage> | undefined
): readonly MarkdownFileDeclaration[] =>
  (pages ?? []).flatMap((page) =>
    typeof page.markdown?.file === 'string' && typeof page.markdown.content !== 'string'
      ? [{ page: page.name, file: page.markdown.file }]
      : []
  )

/**
 * The warning for a `markdown.file` that names no file: one line naming the
 * page and the path, said the same way by `sovrium validate` and `sovrium bundle`.
 */
export const missingMarkdownFileWarning = (declaration: MarkdownFileDeclaration): string =>
  `The page "${declaration.page}" reads its markdown from ${declaration.file}, which does not exist — the page is served without its body.`
