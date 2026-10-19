/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui code-block (https://ui.shadcn.com), registry commit 4233ed1caded8c38f4bc14b14afe1f93ebcaf966.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The inner parts of shadcn/ui's Code Block, as class recipes: the title, the
 * actions group, the code grid, one line per source line, and the footer. The
 * frame, its header bar and the copy button keep their recipes in
 * `code-block-default-classes.ts`.
 *
 * Only the anatomy is adopted. shadcn's component highlights in the browser and
 * numbers its lines with a CSS counter reset through an inline `style`; here the
 * highlighting is done on the server and the gutter numbers are real elements,
 * so nothing in a block ever carries a `style` attribute (the canonical
 * sanitizer would strip it, and the specs hold the block to none).
 *
 * The size and variant are read from the frame through the `code-block` group
 * (`group/code-block` on the `<figure>`), so a markdown fence and a `code`
 * component share every recipe below without either passing them in.
 *
 * Two values differ from shadcn's, for the same reason: shadcn draws its block
 * on the page background, while ours is drawn on the highlighter's chrome,
 * which in the light scheme IS `muted`. A highlighted or added line on
 * `bg-muted` would therefore be invisible; both take a tint of the chrome's own
 * ink instead (`bg-current/10`), which reads on a light and a dark theme alike.
 */

/** Which line variant a source line is drawn in. Mirrors shadcn's `CodeBlockLine`. */
export type CodeBlockLineVariant = 'default' | 'added' | 'removed' | 'highlighted'

/**
 * The title: the filename or terminal marker. It inherits the header's muted
 * ink by default and takes the theme's `--destructive` under the destructive
 * variant, a token and never a fixed colour.
 */
export const computeCodeBlockTitleClasses = (): string =>
  'flex min-w-0 flex-1 items-center gap-2 group-data-[variant=destructive]/code-block:text-destructive'

/** The actions group holding the copy button, at the header's trailing edge. */
export const computeCodeBlockActionsClasses = (): string =>
  'ms-auto -me-1.5 flex shrink-0 items-center gap-1'

/**
 * The `<code>` element: a one-column grid of lines, so the newline text nodes
 * kept between the lines (they are what the clipboard reads) draw nothing.
 * A wrapped block's column may shrink to the surface; an unwrapped one is as
 * wide as its longest line and scrolls.
 */
export const computeCodeBlockCodeClasses = (wrap: boolean): string =>
  wrap
    ? 'grid min-w-0 grid-cols-1 content-start group-data-[size=sm]/code-block:text-xs'
    : 'grid min-w-max content-start group-data-[size=sm]/code-block:text-xs'

/** What a wrapping block adds to its scrolling `<pre>`. */
export const CODE_BLOCK_WRAP_CLASSES = 'whitespace-pre-wrap wrap-anywhere'

const LINE_VARIANT_CLASSES: Readonly<Record<CodeBlockLineVariant, string>> = {
  default: '',
  added: "bg-current/10 after:content-['+']",
  removed: "bg-destructive/10 after:text-destructive after:content-['−']",
  highlighted: 'bg-current/10',
}

/**
 * One source line. The line bleeds into the surface's padding so a highlight
 * spans the block edge to edge, and the diff sign is drawn in that padding by
 * `::after`, never left in the text.
 *
 * A NUMBERED block keeps its lines inside a scroller of their own beside the
 * gutter, which has no padding to bleed into: the bleed there would only add a
 * sideways scroll, so it is left out.
 */
export const computeCodeBlockLineClasses = (
  variant: CodeBlockLineVariant,
  numbered: boolean
): string => {
  const bleed = numbered
    ? 'ps-3'
    : '-mx-4 px-4 group-data-[size=sm]/code-block:-mx-2.5 group-data-[size=sm]/code-block:px-2.5'
  const marker =
    'after:absolute after:start-1 after:top-0 after:select-none after:text-muted-foreground'
  return `relative block min-h-lh ${bleed} ${marker} ${LINE_VARIANT_CLASSES[variant]}`.trim()
}

/** The text of one line, holding its highlighted tokens. */
export const CODE_BLOCK_LINE_CONTENT_CLASSES = 'min-w-0'

/**
 * The footer: a command's printed `output`, quieter than the command above it
 * and outside the scrolling content, so it never reads as part of the command.
 */
export const computeCodeBlockFooterClasses = (): string =>
  'overflow-x-auto border-t bg-muted/50 px-4 py-3 font-mono text-sm whitespace-pre-wrap text-muted-foreground group-data-[size=sm]/code-block:text-xs group-data-[variant=destructive]/code-block:text-destructive'
