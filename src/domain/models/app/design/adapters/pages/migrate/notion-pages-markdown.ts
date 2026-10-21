/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Chunk } from 'effect'
import {
  cleanText,
  linkedPageOf,
  resolveExportPath,
  type NotionBlock,
  type NotionReadContext,
  type NotionTextBlock,
} from './notion-export-blocks'

/**
 * The Markdown reader of the Notion page migration: one `.md` page of a
 * "Markdown & CSV" export, read into the same Notion blocks the HTML reader
 * produces. Markdown is the SECONDARY format (facts c1, c2): it is read only
 * when the export holds no HTML page.
 *
 * Markdown cannot carry every block. A callout is written as an `<aside>`
 * element because Markdown has none (fact b1), and is read as one; a toggle
 * is written as a bulleted list item, so it cannot be told from one and is
 * reported as the list it reads as — never guessed back into a toggle. A line
 * that is a link and nothing else, to another page of the export, is the
 * sub-page that sat there; a link to a `.csv` file is an inline database.
 *
 * Read line by line, line breaks normalised; nothing is rendered, and no HTML
 * inside the Markdown is interpreted beyond recognising the `<aside>` lines.
 */

/**
 * A run of lines still being read: a fenced code block, an `<aside>`, a
 * paragraph or a list. Its lines, like the blocks read so far, are a chunk,
 * which appends in logarithmic time: copying an array per line made a long
 * page quadratic.
 */
type OpenRun =
  | { readonly kind: 'code'; readonly lines: Chunk.Chunk<string> }
  | { readonly kind: 'aside'; readonly lines: Chunk.Chunk<string> }
  | { readonly kind: 'paragraph'; readonly lines: Chunk.Chunk<string> }
  | { readonly kind: 'list'; readonly block: string }
  | { readonly kind: 'table' }
  | { readonly kind: 'equation' }

interface ReadState {
  readonly blocks: Chunk.Chunk<NotionBlock>
  readonly open: OpenRun | undefined
  readonly title: string | undefined
}

const LINK = /\[([^[\]]*)\]\(([^)\s]+)\)/g
const LONE_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/
const LONE_IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/

const extensionIs = (path: string, extension: string): boolean =>
  path.toLowerCase().endsWith(`.${extension}`)

/** Every link of a text run that names another page of the export: a page mention. */
const mentionsOf = (text: string, context: NotionReadContext): readonly string[] =>
  [...text.matchAll(LINK)].flatMap((match) =>
    linkedPageOf(match[2] ?? '', context) === undefined ? [] : [match[0]]
  )

/** The visible text of a Markdown run: a link reads as its label, emphasis marks are dropped. */
const visibleText = (text: string): string =>
  cleanText(
    text
      .replaceAll(LINK, '$1')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
  )

const textRun = (
  block: 'callout' | 'paragraph',
  lines: readonly string[],
  context: NotionReadContext
): readonly NotionBlock[] => {
  const raw = lines.join('\n')
  const text = visibleText(raw)
  return text === '' ? [] : [{ kind: 'text', block, text, mentions: mentionsOf(raw, context) }]
}

/** The blocks a finished run becomes. */
const close = (open: OpenRun | undefined, context: NotionReadContext): readonly NotionBlock[] => {
  if (open === undefined) return []
  switch (open.kind) {
    case 'code':
      return [{ kind: 'text', block: 'code', text: Chunk.join(open.lines, '\n'), mentions: [] }]
    case 'aside':
      return textRun('callout', Chunk.toReadonlyArray(open.lines), context)
    case 'paragraph':
      return textRun('paragraph', Chunk.toReadonlyArray(open.lines), context)
    case 'list':
      return [{ kind: 'other', block: open.block }]
    case 'table':
    case 'equation':
      return [{ kind: 'other', block: open.kind }]
  }
}

const listBlockOf = (line: string): string | undefined => {
  if (/^[-*+] \[[ xX]\] /.test(line)) return 'to_do'
  if (/^[-*+] /.test(line)) return 'bulleted_list_item'
  return /^\d+[.)] /.test(line) ? 'numbered_list_item' : undefined
}

const HEADING_BLOCKS = ['heading_1', 'heading_2', 'heading_3'] as const

const textLine = (
  block: NotionTextBlock,
  raw: string,
  context: NotionReadContext
): NotionBlock => ({
  kind: 'text',
  block,
  text: visibleText(raw),
  mentions: mentionsOf(raw, context),
})

/** A heading, a quote or a divider line. */
const textLineOf = (line: string, context: NotionReadContext): NotionBlock | undefined => {
  const heading = /^(#{1,3}) (.+)$/.exec(line)
  if (heading !== null) {
    const block = HEADING_BLOCKS[(heading[1]?.length ?? 1) - 1] ?? 'heading_3'
    return textLine(block, heading[2] ?? '', context)
  }
  if (/^#{4,6} /.test(line)) return { kind: 'other', block: `<h${line.indexOf(' ')}>` }
  if (line.startsWith('> ') || line === '>') return textLine('quote', line.slice(1), context)
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line) ? { kind: 'leaf', block: 'divider' } : undefined
}

/** A line that is an image and nothing else. */
const imageLineOf = (line: string, context: NotionReadContext): NotionBlock | undefined => {
  const image = LONE_IMAGE.exec(line)
  if (image === null) return undefined
  const src = image[2] ?? ''
  const alt = image[1] === '' ? undefined : image[1]
  if (/^https:\/\//i.test(src)) return { kind: 'image', src, alt, file: undefined }
  const file = resolveExportPath(context.folder, src)
  return { kind: 'image', src: file, alt, file }
}

/** A line that is a link and nothing else: a sub-page, or an inline database's CSV. */
const linkLineOf = (line: string, context: NotionReadContext): NotionBlock | undefined => {
  const link = LONE_LINK.exec(line)
  if (link === null) return undefined
  const href = link[2] ?? ''
  const label = visibleText(link[1] ?? '')
  const target = linkedPageOf(href, context)
  if (target !== undefined) return { kind: 'child_page', label, target }
  return extensionIs(href, 'csv')
    ? {
        kind: 'child_database',
        title: label || 'Untitled database',
        file: resolveExportPath(context.folder, href),
      }
    : undefined
}

/** A line that stands alone as a block: a heading, a quote, a divider, an image or a sub-page. */
const loneBlockOf = (line: string, context: NotionReadContext): NotionBlock | undefined =>
  textLineOf(line, context) ?? imageLineOf(line, context) ?? linkLineOf(line, context)

const pushBlocks = (
  state: ReadState,
  context: NotionReadContext,
  added: readonly NotionBlock[],
  open: OpenRun | undefined
): ReadState => ({
  ...state,
  blocks: Chunk.appendAll(
    state.blocks,
    Chunk.fromIterable([...close(state.open, context), ...added])
  ),
  open,
})

/** A line read inside a fenced code block, an `<aside>` or a `$$` equation: those runs swallow lines. */
const continueRaw = (
  state: ReadState,
  raw: string,
  context: NotionReadContext
): ReadState | undefined => {
  const { open } = state
  const line = raw.trimEnd()
  if (open?.kind === 'code') {
    return line.trim().startsWith('```')
      ? pushBlocks(state, context, [], undefined)
      : { ...state, open: { kind: 'code', lines: Chunk.append(open.lines, raw) } }
  }
  if (open?.kind === 'aside') {
    const aside: OpenRun = {
      kind: 'aside',
      lines: Chunk.append(open.lines, line.replace('</aside>', '')),
    }
    return line.includes('</aside>')
      ? pushBlocks({ ...state, open: aside }, context, [], undefined)
      : { ...state, open: aside }
  }
  if (open?.kind === 'equation') {
    return line.trim() === '$$' ? pushBlocks(state, context, [], undefined) : state
  }
  return undefined
}

/** A line that opens a run swallowing the lines after it, or `undefined`. */
const openRaw = (
  state: ReadState,
  trimmed: string,
  context: NotionReadContext
): ReadState | undefined => {
  if (trimmed.startsWith('```')) {
    return pushBlocks(state, context, [], { kind: 'code', lines: Chunk.empty() })
  }
  if (trimmed === '$$') return pushBlocks(state, context, [], { kind: 'equation' })
  if (!trimmed.startsWith('<aside>')) return undefined
  const rest = trimmed.slice('<aside>'.length)
  const aside: OpenRun = { kind: 'aside', lines: Chunk.of(rest.replace('</aside>', '')) }
  const opened = pushBlocks(state, context, [], aside)
  return rest.includes('</aside>') ? pushBlocks(opened, context, [], undefined) : opened
}

/** A list item: the list it continues, or a new one. */
const continueList = (state: ReadState, list: string, context: NotionReadContext): ReadState =>
  state.open?.kind === 'list' && state.open.block === list
    ? state
    : pushBlocks(state, context, [], { kind: 'list', block: list })

/** A list item or a table row: a run that only names the block it is. */
const continueNamed = (
  state: ReadState,
  line: string,
  trimmed: string,
  context: NotionReadContext
): ReadState | undefined => {
  const { open } = state
  if (open?.kind === 'list' && /^\s/.test(line)) return state
  const list = listBlockOf(trimmed)
  if (list !== undefined) return continueList(state, list, context)
  if (!trimmed.startsWith('|')) return undefined
  return open?.kind === 'table' ? state : pushBlocks(state, context, [], { kind: 'table' })
}

const isPageTitle = (state: ReadState, block: NotionBlock): boolean =>
  state.title === undefined &&
  Chunk.isEmpty(state.blocks) &&
  block.kind === 'text' &&
  block.block === 'heading_1'

/** Read one line, given the run it may continue. */
const readLine = (state: ReadState, raw: string, context: NotionReadContext): ReadState => {
  const swallowed = continueRaw(state, raw, context)
  if (swallowed !== undefined) return swallowed
  const line = raw.trimEnd()
  const trimmed = line.trim()
  if (trimmed === '') return pushBlocks(state, context, [], undefined)
  const named = openRaw(state, trimmed, context) ?? continueNamed(state, line, trimmed, context)
  if (named !== undefined) return named
  const lone = loneBlockOf(trimmed, context)
  if (lone !== undefined) {
    const title = isPageTitle(state, lone) && lone.kind === 'text' ? lone.text : state.title
    return pushBlocks({ ...state, title }, context, [lone], undefined)
  }
  const { open } = state
  return open?.kind === 'paragraph'
    ? { ...state, open: { kind: 'paragraph', lines: Chunk.append(open.lines, trimmed) } }
    : pushBlocks(state, context, [], { kind: 'paragraph', lines: Chunk.of(trimmed) })
}

/**
 * Read one Markdown page into blocks, and the title its first `# ` heading
 * gives it.
 */
export const readNotionMarkdownBlocks = (
  markdown: string,
  context: NotionReadContext
): { readonly blocks: readonly NotionBlock[]; readonly title?: string } => {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/)
  const read = lines.reduce<ReadState>((state, line) => readLine(state, line, context), {
    blocks: Chunk.empty(),
    open: undefined,
    title: undefined,
  })
  const blocks = [...Chunk.toReadonlyArray(read.blocks), ...close(read.open, context)]
  return read.title === undefined ? { blocks } : { blocks, title: read.title }
}
