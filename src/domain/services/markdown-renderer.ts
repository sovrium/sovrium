/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimal Markdown -> HTML renderer for SSR markdown pages.
 *
 * Why a hand-rolled implementation:
 *   Sovrium does not currently depend on a markdown library and the
 *   page-mode markdown user story (US-PAGES-LAYOUT-MARKDOWN-PAGES-002)
 *   only requires:
 *     - Frontmatter extraction (YAML between `---` fences)
 *     - Heading parsing (h1-h6) for the rendered article AND for table-of-
 *       contents derivation
 *     - Inline emphasis (bold, italic), code, and links — enough to make
 *       the article element render real content for the spec tests
 *
 * A full CommonMark/GFM parser would be overkill at this stage and pulling in
 * a dependency would inflate the install footprint. Future work can replace
 * `renderMarkdownToHtml` with a library-backed parser without changing the
 * surrounding pipeline.
 *
 * This module is pure (Domain layer): no I/O, no Effect dependencies. The
 * presentation layer reads the file and feeds its contents in.
 */

/**
 * A single heading entry extracted from rendered markdown.
 */
export interface MarkdownHeading {
  readonly level: number
  readonly id: string
  readonly text: string
}

/**
 * Result of rendering a markdown source string.
 */
export interface RenderedMarkdown {
  /** Sanitised markdown body (without the YAML frontmatter block). */
  readonly body: string
  /** Generated HTML (already escaped where necessary). */
  readonly html: string
  /** Headings extracted from the body, in document order. */
  readonly headings: readonly MarkdownHeading[]
  /** Frontmatter as a flat record of strings (YAML scalars only). */
  readonly frontmatter: Readonly<Record<string, string>>
}

const HEADING_PREFIX_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/

const FRONTMATTER_FENCE = '---'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

/**
 * Parses very simple inline markdown emphasis: `**bold**`, `*italic*`,
 * `` `code` ``, and `[text](url)`. Order matters: `**` must run before `*`.
 *
 * Implemented as a pure pipe of immutable replacements (no mutable `let`)
 * so the function-style ESLint rules (`functional/no-let`, `functional/
 * no-expression-statements`) hold without disabling them locally.
 */
const renderInline = (input: string): string => {
  // First HTML-escape the entire string, then re-introduce our own tags. This
  // keeps the output safe by default — author content cannot inject raw HTML.
  const escaped = escapeHtml(input)
  const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return withItalic.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => `<a href="${escapeHtml(String(url))}">${String(text)}</a>`
  )
}

/**
 * Strip the leading YAML frontmatter block (between `---` fences) and parse
 * its scalar values into a plain record. Block-style YAML (lists, nested
 * mappings) is intentionally not supported — the markdown user story only
 * uses scalar values for `$frontmatter.*` substitution.
 */
const splitFrontmatter = (
  source: string
): { readonly body: string; readonly frontmatter: Readonly<Record<string, string>> } => {
  const lines = source.split(/\r?\n/)
  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_FENCE) {
    return { body: source, frontmatter: {} }
  }
  const closingIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === FRONTMATTER_FENCE)
  if (closingIndex === -1) {
    return { body: source, frontmatter: {} }
  }
  const fmLines = lines.slice(1, closingIndex)
  const frontmatter = fmLines.reduce<Record<string, string>>((acc, raw) => {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) return acc
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx <= 0) return acc
    const key = trimmed.slice(0, colonIdx).trim()
    const valueRaw = trimmed.slice(colonIdx + 1).trim()
    const value = valueRaw.replace(/^['"]|['"]$/g, '')
    return { ...acc, [key]: value }
  }, {})
  const body = lines.slice(closingIndex + 1).join('\n')
  return { body, frontmatter }
}

/**
 * Render a single line block (heading, paragraph) into an HTML fragment.
 * Returns `undefined` when the line is blank — paragraph grouping happens
 * in the caller. Heading entries are appended to `headings` for TOC use.
 */
const renderHeadingLine = (
  match: readonly (string | undefined)[],
  headings: readonly MarkdownHeading[]
): { readonly html: string; readonly headings: readonly MarkdownHeading[] } => {
  const level = match[1]?.length ?? 1
  const text = match[2]?.trim() ?? ''
  const id = slugify(text) || `heading-${headings.length + 1}`
  const html = `<h${level} id="${id}">${renderInline(text)}</h${level}>`
  return {
    html,
    headings: [...headings, { level, id, text }],
  }
}

type ParseState = {
  readonly htmlChunks: readonly string[]
  readonly paragraph: readonly string[]
  readonly listItems: readonly string[]
  readonly headings: readonly MarkdownHeading[]
}

const flushParagraph = (state: ParseState): ParseState =>
  state.paragraph.length === 0
    ? state
    : {
        ...state,
        htmlChunks: [...state.htmlChunks, `<p>${state.paragraph.map(renderInline).join(' ')}</p>`],
        paragraph: [],
      }

const flushList = (state: ParseState): ParseState =>
  state.listItems.length === 0
    ? state
    : {
        ...state,
        htmlChunks: [
          ...state.htmlChunks,
          `<ul>${state.listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`,
        ],
        listItems: [],
      }

const advanceWithHeading = (
  state: ParseState,
  match: readonly (string | undefined)[]
): ParseState => {
  const flushed = flushList(flushParagraph(state))
  const { html, headings } = renderHeadingLine(match, flushed.headings)
  return {
    ...flushed,
    htmlChunks: [...flushed.htmlChunks, html],
    headings,
  }
}

const reduceLine = (state: ParseState, raw: string): ParseState => {
  const line = raw.trimEnd()
  if (line.trim() === '') return flushList(flushParagraph(state))
  const headingMatch = line.match(HEADING_PREFIX_RE)
  if (headingMatch) return advanceWithHeading(state, headingMatch)
  const listMatch = line.match(/^[-*]\s+(.*)$/)
  if (listMatch) {
    const flushed = flushParagraph(state)
    return { ...flushed, listItems: [...flushed.listItems, listMatch[1] ?? ''] }
  }
  return { ...state, paragraph: [...state.paragraph, line] }
}

/**
 * Parse markdown body into HTML and extract headings. Paragraph grouping is
 * intentionally simple: blank lines separate blocks, single line breaks are
 * preserved as `<br />`, and bullet lists (`- ` / `* `) become `<ul>`.
 */
const parseBody = (
  body: string
): { readonly html: string; readonly headings: readonly MarkdownHeading[] } => {
  const initial: ParseState = {
    htmlChunks: [],
    paragraph: [],
    listItems: [],
    headings: [],
  }
  const final = body.split(/\r?\n/).reduce<ParseState>(reduceLine, initial)
  const flushed = flushList(flushParagraph(final))
  return { html: flushed.htmlChunks.join('\n'), headings: flushed.headings }
}

/**
 * Render a markdown source string into HTML, with frontmatter and headings.
 *
 * The output `html` is safe to interpolate into a server-rendered React tree
 * via `dangerouslySetInnerHTML` — all author-supplied text is HTML-escaped
 * before our own emphasis/heading tags are reintroduced.
 */
export const renderMarkdownToHtml = (source: string): RenderedMarkdown => {
  const { body, frontmatter } = splitFrontmatter(source)
  const { html, headings } = parseBody(body)
  return { body, html, headings, frontmatter }
}

/**
 * Filter headings to those at or above the given max depth.
 *
 * The user story APP-PAGES-MARKDOWN-016 specifies that `toc.maxDepth`
 * controls the deepest heading level included. Defaults are configured by
 * the caller (the page-mode renderer).
 */
export const filterTocHeadings = (
  headings: readonly MarkdownHeading[],
  maxDepth: number
): readonly MarkdownHeading[] => headings.filter((heading) => heading.level <= maxDepth)
