/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentClassesSchema } from '../component-style'
import { CssLengthSchema } from '../css-length'

// ─── Table of Contents ───────────────────────────────────────────────────────

/**
 * Table of contents configuration for markdown pages.
 */
const MarkdownTocSchema = Schema.Struct({
  /**
   * Shallowest heading depth to include. A docs page whose `h1` is its title
   * starts its outline at `2`, so the outline does not repeat the title as its
   * first entry.
   */
  minDepth: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Shallowest heading depth to include (1-6, default 1). Set 2 when the page title is its only h1.',
      }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 6 }))
    )
  ),

  /** Maximum heading depth to include in the TOC */
  maxDepth: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum heading depth to include (1-6)' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 6 }))
    )
  ),

  /** Position of the TOC relative to the content */
  position: Schema.optional(
    Schema.Literals(['top', 'sidebar']).pipe(
      Schema.annotate({ description: 'TOC placement: inline at top or in a sidebar' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'MarkdownToc',
    title: 'Table of Contents',
    description: 'Configuration for automatic table of contents generation',
  })
)

// ─── Reading frame ───────────────────────────────────────────────────────────

/**
 * The measurements of the frame a `docs` layout draws around the article: the
 * section sidebar on the left, the outline on the right, the article between.
 *
 * Until this key a template could only tune them from OUTSIDE — a header
 * component reaching the regions rendered after it with sibling selectors
 * (`lg:[&~div_nav[data-component=docs-sidebar-nav]]:w-[248px]`), which broke
 * the day the frame's markup moved. Each one is a named measurement here
 * instead. Every key is optional, and an omitted key keeps the built-in value.
 */
const MarkdownFrameSchema = Schema.Struct({
  sidebarWidth: Schema.optional(
    CssLengthSchema.annotate({
      description: 'Width of the section sidebar from the lg breakpoint up, in px or rem',
      examples: ['248px', '16rem'],
    })
  ),
  tocWidth: Schema.optional(
    CssLengthSchema.annotate({
      description: 'Width of the outline column from the lg breakpoint up, in px or rem',
      examples: ['220px'],
    })
  ),
  contentMaxWidth: Schema.optional(
    CssLengthSchema.annotate({
      description:
        "The article column's reading measure, in px or rem — the widest its header (breadcrumb, title, page actions), its text and its closing lines run, so the title never overhangs the paragraph under it",
      examples: ['653px', '42rem'],
    })
  ),
  stickyOffset: Schema.optional(
    CssLengthSchema.annotate({
      description:
        "Height of a sticky header above the frame, in px or rem: the sidebar and the outline stick below it and fill the viewport's remaining height",
      examples: ['3.5rem', '56px'],
    })
  ),
  menuButton: Schema.optional(
    Schema.Literals(['frame', 'header']).annotate({
      description:
        "Where the button that opens the sections on a phone sits: 'frame' (default) above the article, or 'header' — lifted into the page's first component, left of its content, so a sticky header carries it",
    })
  ),
  articleActions: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Whether the article header carries its page actions (copy as markdown, view as markdown) beside the title (default: true)',
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'MarkdownFrame',
    title: 'Docs Frame',
    description:
      'Measurements of the frame a docs layout draws around the article: sidebar and outline widths, reading measure, sticky offset, and where the phone menu button and the page actions sit',
  })
)

// ─── Markdown Page Mode ──────────────────────────────────────────────────────

/**
 * Markdown page mode configuration.
 *
 * Enables markdown-driven content for a page, either inline or from a file.
 * Supports layout modes, frontmatter variables, and table of contents.
 *
 * @example
 * ```typescript
 * // Inline content
 * markdown: { content: '# Hello\n\nWelcome to the page.', layout: 'prose' }
 *
 * // File-based content
 * markdown: { file: 'content/docs.md', layout: 'prose' }
 *
 * // With table of contents
 * markdown: { file: 'content/docs.md', layout: 'docs', toc: { maxDepth: 3 } }
 *
 * // Layout only (used with contentDir)
 * markdown: { layout: 'prose' }
 * ```
 */
export const MarkdownSchema = Schema.Struct({
  /** Inline markdown content string */
  content: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Inline markdown content' }))
  ),

  /** Path to a markdown file relative to the project root */
  file: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'Path to a markdown file (e.g., content/docs.md)' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Layout mode for rendering the markdown content */
  layout: Schema.optional(
    Schema.Literals(['prose', 'docs', 'full', 'none']).pipe(
      Schema.annotate({
        description:
          'Layout mode: prose (article-width), docs (with sidebar), full (full-width), none (no wrapper)',
      })
    )
  ),

  /** Table of contents configuration */
  toc: Schema.optional(MarkdownTocSchema),

  /** The docs layout's measurements — see {@link MarkdownFrameSchema}. */
  frame: Schema.optional(MarkdownFrameSchema),

  /**
   * Classes for the parts the markdown layout draws: the frame's regions
   * (`frame`, the row holding the three columns; `sidebar`, `navGroup`,
   * `navGroupLabel`, `navLink`, `menuButton`, `toc`, `article`,
   * `articleHeader`, `articleActions`, `articleLinks`, `lastUpdated`, `callout`
   * and its per-kind parts) and the article's prose (`heading1`, `paragraph`,
   * `list`, `table`, `link`, `codeBlock`, …), with `states.current` for the
   * current sidebar link. The
   * same vocabulary a component's `classes` takes, so the reading frame is
   * restyled by part name rather than by selectors from a neighbouring
   * component.
   */
  classes: Schema.optional(ComponentClassesSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Markdown',
    title: 'Markdown Page Mode',
    description: 'Markdown-driven content configuration for a page',
  })
)

/** @public */
export type Markdown = Schema.Schema.Type<typeof MarkdownSchema>
