/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface MarkdownHeading {
  readonly level: number
  readonly id: string
  readonly text: string
}

export interface RenderedMarkdown {
  readonly body: string
  readonly html: string
  readonly headings: readonly MarkdownHeading[]
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

const ALLOWED_LINK_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel'])

const safeHref = (raw: string): string => {
  const trimmed = raw.trim()
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (schemeMatch !== null) {
    const scheme = (schemeMatch[1] ?? '').toLowerCase()
    return ALLOWED_LINK_SCHEMES.has(scheme) ? trimmed : '#'
  }
  return trimmed
}

const renderInline = (input: string): string => {
  const escaped = escapeHtml(input)
  const withCode = escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
  const withBold = withCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return withItalic.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => `<a href="${escapeHtml(safeHref(String(url)))}">${String(text)}</a>`
  )
}

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

export const renderMarkdownToHtml = (source: string): RenderedMarkdown => {
  const { body, frontmatter } = splitFrontmatter(source)
  const { html, headings } = parseBody(body)
  return { body, html, headings, frontmatter }
}

export const filterTocHeadings = (
  headings: readonly MarkdownHeading[],
  maxDepth: number
): readonly MarkdownHeading[] => headings.filter((heading) => heading.level <= maxDepth)
