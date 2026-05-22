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

export interface MarkdownDirective {
  readonly name: string
  readonly attrs: Readonly<Record<string, string>>
  readonly innerMarkdown: string
}

export interface MarkdownCodeBlock {
  readonly lang: string
  readonly code: string
}

export interface RenderedMarkdown {
  readonly body: string
  readonly html: string
  readonly headings: readonly MarkdownHeading[]
  readonly frontmatter: Readonly<Record<string, string>>
  readonly codeBlocks: readonly MarkdownCodeBlock[]
  readonly directives: readonly MarkdownDirective[]
}

const FRONTMATTER_FENCE = '---'

export const splitFrontmatter = (
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

const DIRECTIVE_HEADER_NAME_RE = /^([a-zA-Z][a-zA-Z0-9-]*)/
const DIRECTIVE_ATTR_RE = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g

export const parseDirectiveHeader = (
  raw: string
): { readonly name: string; readonly attrs: Readonly<Record<string, string>> } | undefined => {
  const trimmed = raw.trim()
  const nameMatch = DIRECTIVE_HEADER_NAME_RE.exec(trimmed)
  if (nameMatch === null) return undefined
  const name = nameMatch[1]
  if (name === undefined) return undefined
  const rest = trimmed.slice(name.length)
  const attrs: Record<string, string> = {}
  for (const match of rest.matchAll(DIRECTIVE_ATTR_RE)) {
    const key = match[1]
    const value = match[2]
    if (key !== undefined && value !== undefined) {
      attrs[key] = value
    }
  }
  return { name, attrs }
}

type CollectedDirective = {
  readonly name: string
  readonly attrs: Readonly<Record<string, string>>
  readonly innerMarkdown: string
}
type ScanCurrent = {
  readonly name: string
  readonly attrs: Readonly<Record<string, string>>
  readonly lines: readonly string[]
}
type ScanState = {
  readonly collected: readonly CollectedDirective[]
  readonly current: ScanCurrent | undefined
}

const handleOpeningLine = (state: ScanState, trimmed: string): ScanState => {
  const openMatch = /^:::\s*(.+?)\s*$/.exec(trimmed)
  if (openMatch === null) return state
  const header = openMatch[1]
  if (header === undefined) return state
  const parsed = parseDirectiveHeader(header)
  if (parsed === undefined) return state
  return {
    collected: state.collected,
    current: { name: parsed.name, attrs: parsed.attrs, lines: [] },
  }
}

const handleInnerLine = (
  state: ScanState,
  trimmed: string,
  line: string,
  current: ScanCurrent
): ScanState => {
  if (trimmed === ':::') {
    return {
      collected: [
        ...state.collected,
        { name: current.name, attrs: current.attrs, innerMarkdown: current.lines.join('\n') },
      ],
      current: undefined,
    }
  }
  return {
    collected: state.collected,
    current: { name: current.name, attrs: current.attrs, lines: [...current.lines, line] },
  }
}

export const scanDirectives = (source: string): readonly CollectedDirective[] => {
  const lines = source.split(/\r?\n/)
  const finalState = lines.reduce<ScanState>(
    (state, line) => {
      const trimmed = line.trim()
      return state.current === undefined
        ? handleOpeningLine(state, trimmed)
        : handleInnerLine(state, trimmed, line, state.current)
    },
    { collected: [], current: undefined }
  )
  return finalState.collected
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const filterTocHeadings = (
  headings: readonly MarkdownHeading[],
  maxDepth: number
): readonly MarkdownHeading[] => headings.filter((heading) => heading.level <= maxDepth)
