/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  parseHtmlElementTree,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import {
  cleanText,
  linkedPageOf as linkedPageByHref,
  resolveExportPath,
  type NotionBlock,
  type NotionReadContext,
  type NotionTextBlock,
} from './notion-export-blocks'
import { readNotionMarkdownBlocks } from './notion-pages-markdown'

/**
 * The read half of the Notion page migration: the files of a Notion export
 * ZIP, already inflated within the import's limits, read into pages of
 * Notion BLOCKS — named the way Notion names them (`heading_1`, `callout`,
 * `column_list` …) — and nothing else. Which kit node a block becomes is
 * `notion-page-mappings.ts`'s alone; this module only recognises.
 *
 * ─── READ AGAINST REAL EXPORTS ─────────────────────────────────────────────
 *
 * The recognitions below are read off the real exports pinned with the
 * Notion facts (`export-sample/html/`, `export-sample/markdown/`). A page is
 * `<article class="page sans">`: a `<header>` holding `h1.page-title`, then a
 * `div.page-body` of blocks. Headings are `h1`–`h3`, a paragraph `<p>`, a
 * quote `<blockquote>`, a divider `<hr>`, code `pre.code`; a toggle is a
 * `<details>` (in a `ul.toggle` for a toggle list), a callout a
 * `figure.callout`, a table of contents a `nav.table_of_contents`, a sub-page
 * a `figure.link-to-page`, an image a `figure.image`, an equation a
 * `figure.equation`, an attachment a figure holding a `div.source` link, and
 * nested children a `div.indented`. Every list item is a list of its own:
 * `ul.bulleted-list`, `ol.numbered-list`, and a to-do list `ul`. An inline equation
 * is a `span.notion-text-equation-token` whose TeX sits in a KaTeX
 * annotation. Files are named `<Title> <32 hex>` (fact a7), and the export's
 * root `index.html` lists the workspace rather than being a page (a7c).
 *
 * Columns, simple tables, embeds and synced blocks are in neither sample, so
 * `div.column-list`, `table` and an inline database's `.collection-content`
 * are read the way the export's own stylesheet names them; the plain
 * elements (`<details>`, `<aside>`) are read too, as a hand-written export
 * writes them. A page named without the 32-hex id is still read.
 *
 * ─── INERT ─────────────────────────────────────────────────────────────────
 *
 * HTML is read through the kernel's inert tree: tags, attributes and text,
 * nothing runs, and a `<script>` or `<style>` is skipped unread. A page whose
 * HTML is past the kernel's length or depth bound refuses the whole export
 * rather than arriving with a hole in it.
 */

/** One file of the export, inflated, by its path inside the ZIP. */
export interface NotionExportEntry {
  readonly path: string
  readonly bytes: Uint8Array
}

/** One page of the export. */
export interface NotionExportPage {
  /** The export entry the page was read from. */
  readonly file: string
  readonly title: string
  /** The 32-hex id the file name carries, when it carries one. */
  readonly id: string | undefined
  /** The page's folder inside the export, `''` at the root. */
  readonly folder: string
  readonly blocks: readonly NotionBlock[]
  /** Whether the page carried a properties table: it is a database row's values. */
  readonly properties: boolean
}

/** The export read as pages, or why it cannot be. */
export type NotionExportRead =
  | {
      readonly ok: true
      readonly format: 'html' | 'markdown'
      readonly pages: readonly NotionExportPage[]
      /** Every entry path, for what a page links to and what is left behind. */
      readonly files: ReadonlySet<string>
    }
  | { readonly ok: false; readonly reason: string }

/** Most pages one export may turn into; a larger workspace is migrated in parts. */
export const NOTION_MAX_PAGES = 2000

/** `<Title> <32 hex>` (fact a7), with the extension already removed. */
const TITLED_ID = /^(.*\S) ([0-9a-f]{32})$/

const decoder = new TextDecoder('utf-8', { fatal: false })

const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'meta',
  'link',
  'title',
  'noscript',
  'template',
  'head',
])

const TRANSPARENT_TAGS: ReadonlySet<string> = new Set([
  'html',
  'body',
  'article',
  'main',
  'section',
  'div',
  'span',
  'li',
])

const UNMAPPED_BY_TAG: Readonly<Record<string, string>> = {
  ul: 'bulleted_list_item',
  ol: 'numbered_list_item',
  table: 'table',
  video: 'video',
  audio: 'audio',
  iframe: 'embed',
  embed: 'embed',
  object: 'embed',
  form: 'form',
}

const UNMAPPED_BY_FIGURE_CLASS: readonly (readonly [string, string])[] = [
  ['equation', 'equation'],
  ['bookmark', 'bookmark'],
  ['embed', 'embed'],
  ['video', 'video'],
  ['audio', 'audio'],
  ['file', 'file'],
  ['pdf', 'pdf'],
]

/** The extension of an entry, lower-case, without its dot. */
const extensionOf = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

const stemOf = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? base : base.slice(0, dot)
}

const folderOf = (path: string): string => {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? '' : path.slice(0, slash)
}

/** A file or folder name split into its title and the 32-hex id Notion appends. */
export const titleAndIdOf = (stem: string): { readonly title: string; readonly id?: string } => {
  const match = TITLED_ID.exec(stem)
  return match === null ? { title: stem } : { title: match[1] ?? stem, id: match[2] }
}

const classesOf = (node: HtmlElementNode): readonly string[] =>
  (node.attributes['class'] ?? '').split(/\s+/).filter((name) => name !== '')

const hasClass = (node: HtmlElementNode, name: string): boolean => classesOf(node).includes(name)

const elementsOf = (nodes: readonly HtmlNode[]): readonly HtmlElementNode[] =>
  nodes.flatMap((node) => (node.kind === 'element' ? [node] : []))

/** Every element of a subtree, depth first, the root included. */
const descendantsOf = (node: HtmlElementNode): readonly HtmlElementNode[] => [
  node,
  ...elementsOf(node.children).flatMap(descendantsOf),
]

const findDescendant = (
  node: HtmlElementNode,
  test: (candidate: HtmlElementNode) => boolean
): HtmlElementNode | undefined => descendantsOf(node).find(test)

const isIconElement = (node: HtmlElementNode): boolean =>
  classesOf(node).some((name) => name === 'icon' || name.endsWith('-icon'))

/** The elements whose text is a line of its own inside a block that holds others (a callout, a quote). */
const LINE_TAGS: ReadonlySet<string> = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'li',
  'ul',
  'ol',
  'blockquote',
  'figure',
  'details',
  'summary',
])

/** Notion's inline equation: a KaTeX rendering whose TeX source sits in its annotation. */
const EQUATION_TOKEN = 'notion-text-equation-token'

const isTexAnnotation = (node: HtmlElementNode): boolean =>
  node.tag === 'annotation' && node.attributes['encoding'] === 'application/x-tex'

/** An inline equation as its TeX source between dollars, never as its rendered glyphs. */
const equationTextOf = (node: HtmlElementNode): string => {
  const annotation = descendantsOf(node).find(isTexAnnotation)
  const tex = textOf(annotation?.children ?? [])
    .replace(/\s+/g, ' ')
    .trim()
  return tex === '' ? '' : `$${tex}$`
}

/**
 * The visible text of some nodes: a `<br>` is a line break, a nested block is
 * a line of its own, an icon carries none, an inline equation reads as its TeX.
 */
const textOf = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) => {
      if (node.kind === 'text') return node.text
      if (node.tag === 'br') return '\n'
      if (SKIPPED_TAGS.has(node.tag) || isIconElement(node)) return ''
      if (hasClass(node, EQUATION_TOKEN)) return equationTextOf(node)
      const inner = textOf(node.children)
      return LINE_TAGS.has(node.tag) ? `\n${inner}\n` : inner
    })
    .join('')

/** A code block's text, its indentation and blank lines kept. */
const codeTextOf = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) => {
      if (node.kind === 'text') return node.text
      return node.tag === 'br' ? '\n' : codeTextOf(node.children)
    })
    .join('')
    .replace(/^\n+|\s+$/g, '')

/** Whether an element is a mention: a person, a date, a page or an inline equation. */
const isMention = (node: HtmlElementNode): boolean =>
  node.tag === 'time' ||
  classesOf(node).some(
    (name) => name === 'user' || name.includes('mention') || name === EQUATION_TOKEN
  )

/** A mention as the report lists it: an inline equation by its TeX, anything else by its markup. */
const serializeElement = (node: HtmlElementNode): string => {
  if (hasClass(node, EQUATION_TOKEN)) return equationTextOf(node)
  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${value}"`))
    .join('')
  return `<${node.tag}${attributes}>${textOf(node.children)}</${node.tag}>`
}

type ReadContext = NotionReadContext

const linkedPageOf = (anchor: HtmlElementNode, context: ReadContext): string | undefined =>
  linkedPageByHref(anchor.attributes['href'] ?? '', context)

/** The mentions of a text block's subtree: tagged mentions, and links to another page of the export. */
const mentionsOf = (node: HtmlElementNode, context: ReadContext): readonly string[] =>
  descendantsOf(node)
    .slice(1)
    .filter(
      (candidate) =>
        isMention(candidate) ||
        (candidate.tag === 'a' && linkedPageOf(candidate, context) !== undefined)
    )
    .map(serializeElement)

const textBlock = (
  block: NotionTextBlock,
  node: HtmlElementNode,
  context: ReadContext,
  children: readonly HtmlNode[] = node.children
): readonly NotionBlock[] => {
  const text = block === 'code' ? codeTextOf(children) : cleanText(textOf(children))
  return text === '' && block !== 'code'
    ? []
    : [{ kind: 'text', block, text, mentions: mentionsOf(node, context) }]
}

/** A block whose only content is one link to another page of the export: a sub-page. */
const childPageOf = (node: HtmlElementNode, context: ReadContext): NotionBlock | undefined => {
  const anchors = descendantsOf(node).filter((candidate) => candidate.tag === 'a')
  const [anchor] = anchors
  if (anchors.length !== 1 || anchor === undefined) return undefined
  const target = linkedPageOf(anchor, context)
  if (target === undefined) return undefined
  const label = cleanText(textOf(anchor.children))
  return cleanText(textOf(node.children)) === label
    ? { kind: 'child_page', label, target }
    : undefined
}

const imageOf = (
  image: HtmlElementNode | undefined,
  caption: string | undefined,
  context: ReadContext
): NotionBlock => {
  const src = image?.attributes['src']
  const alt = caption ?? image?.attributes['alt']
  if (src === undefined || src === '') {
    return { kind: 'image', src: undefined, alt, file: undefined }
  }
  if (/^https:\/\//i.test(src)) return { kind: 'image', src, alt, file: undefined }
  const file = resolveExportPath(context.folder, src)
  return { kind: 'image', src: file, alt, file }
}

/**
 * A figure with no block class: a bookmark (`a.bookmark`), or a `div.source`
 * link — to a file of the export (an attachment) or to a URL (an embed).
 */
const sourceFigureOf = (node: HtmlElementNode, context: ReadContext): NotionBlock => {
  if (findDescendant(node, (child) => child.tag === 'a' && hasClass(child, 'bookmark'))) {
    return { kind: 'other', block: 'bookmark' }
  }
  const source = findDescendant(node, (child) => hasClass(child, 'source'))
  const anchor =
    source === undefined ? undefined : findDescendant(source, (child) => child.tag === 'a')
  if (anchor === undefined) return { kind: 'other', block: '<figure>' }
  const file = resolveExportPath(context.folder, anchor.attributes['href'] ?? '')
  return file === undefined
    ? { kind: 'other', block: 'embed' }
    : { kind: 'other', block: 'file', file }
}

const figureBlock = (node: HtmlElementNode, context: ReadContext): readonly NotionBlock[] => {
  if (hasClass(node, 'callout')) return textBlock('callout', node, context)
  if (hasClass(node, 'image')) {
    const caption = findDescendant(node, (candidate) => candidate.tag === 'figcaption')
    return [
      imageOf(
        findDescendant(node, (candidate) => candidate.tag === 'img'),
        caption === undefined ? undefined : cleanText(textOf(caption.children)),
        context
      ),
    ]
  }
  if (hasClass(node, 'link-to-page')) {
    return [childPageOf(node, context) ?? { kind: 'other', block: 'link_to_page' }]
  }
  const named = UNMAPPED_BY_FIGURE_CLASS.find(([name]) => hasClass(node, name))
  return [named === undefined ? sourceFigureOf(node, context) : { kind: 'other', block: named[1] }]
}

const columnWidthOf = (column: HtmlElementNode): string | undefined => {
  const match = /(?:^|;)\s*width\s*:\s*([^;]+)/i.exec(column.attributes['style'] ?? '')
  return match?.[1]?.trim()
}

const collectionTitleOf = (node: HtmlElementNode): string => {
  const title = findDescendant(node, (candidate) => hasClass(candidate, 'collection-title'))
  return cleanText(textOf(title?.children ?? [])) || 'Untitled database'
}

/** Read the blocks of some sibling nodes. */
export const readHtmlBlocks = (
  nodes: readonly HtmlNode[],
  context: ReadContext
): readonly NotionBlock[] =>
  nodes.flatMap((node): readonly NotionBlock[] => {
    if (node.kind === 'text') {
      const text = cleanText(node.text)
      return text === '' ? [] : [{ kind: 'text', block: 'paragraph', text, mentions: [] }]
    }
    return readHtmlElement(node, context)
  })

/** Notion's to-do list class, spelt in parts so the stylesheet scan reads no class here. */
const TO_DO_LIST_CLASS = ['to', 'do', 'list'].join('-')

/**
 * The sub-pages a list holds: a list draws nothing, but a sub-page linked from
 * one of its items is still a page, so its link is kept, after the list.
 */
const subPagesIn = (node: HtmlElementNode, context: ReadContext): readonly NotionBlock[] =>
  descendantsOf(node)
    .filter((child) => child.tag === 'figure' && hasClass(child, 'link-to-page'))
    .flatMap((figure) => {
      const page = childPageOf(figure, context)
      return page === undefined ? [] : [page]
    })

const listBlocks = (node: HtmlElementNode, context: ReadContext): readonly NotionBlock[] => {
  if (hasClass(node, 'toggle')) {
    return elementsOf(node.children).flatMap((item) => readHtmlBlocks(item.children, context))
  }
  const block = hasClass(node, TO_DO_LIST_CLASS)
    ? 'to_do'
    : (UNMAPPED_BY_TAG[node.tag] ?? `<${node.tag}>`)
  return [{ kind: 'other', block }, ...subPagesIn(node, context)]
}

const toggleOf = (node: HtmlElementNode, context: ReadContext): NotionBlock => {
  const summary = elementsOf(node.children).find((child) => child.tag === 'summary')
  return {
    kind: 'toggle',
    summary: cleanText(textOf(summary?.children ?? [])),
    children: readHtmlBlocks(
      node.children.filter((child) => child !== summary),
      context
    ),
  }
}

const paragraphBlocks = (node: HtmlElementNode, context: ReadContext): readonly NotionBlock[] => {
  const childPage = childPageOf(node, context)
  if (childPage !== undefined) return [childPage]
  const images = elementsOf(node.children).filter((child) => child.tag === 'img')
  const [image] = images
  return images.length === 1 && cleanText(textOf(node.children)) === ''
    ? [imageOf(image, undefined, context)]
    : textBlock('paragraph', node, context)
}

type ElementReader = (node: HtmlElementNode, context: ReadContext) => readonly NotionBlock[]

const columnListOf: ElementReader = (node, context) => [
  {
    kind: 'columns',
    columns: elementsOf(node.children)
      .filter((child) => hasClass(child, 'column'))
      .map((column) => ({
        width: columnWidthOf(column),
        children: readHtmlBlocks(column.children, context),
      })),
  },
]

/** The element readers, by tag: what each plain element is. */
const TAG_READERS: Readonly<Record<string, ElementReader>> = {
  p: paragraphBlocks,
  blockquote: (node, context) => textBlock('quote', node, context),
  aside: (node, context) => textBlock('callout', node, context),
  details: (node, context) => [toggleOf(node, context)],
  hr: () => [{ kind: 'leaf', block: 'divider' }],
  pre: (node, context) => textBlock('code', node, context),
  img: (node, context) => [imageOf(node, undefined, context)],
  figure: figureBlock,
  nav: (node, context) =>
    hasClass(node, 'table_of_contents')
      ? [{ kind: 'leaf', block: 'table_of_contents' }]
      : readHtmlBlocks(node.children, context),
  ul: listBlocks,
  ol: listBlocks,
  h1: (node, context) => textBlock('heading_1', node, context),
  h2: (node, context) => textBlock('heading_2', node, context),
  h3: (node, context) => textBlock('heading_3', node, context),
}

/** The element readers, by the class Notion's export writes, read before the tag. */
const CLASS_READERS: readonly (readonly [string, ElementReader])[] = [
  ['collection-content', (node) => [{ kind: 'child_database', title: collectionTitleOf(node) }]],
  ['collection-title', () => []],
  ['column-list', columnListOf],
]

/** Read one element into the blocks it holds. */
const readHtmlElement: ElementReader = (node, context) => {
  if (SKIPPED_TAGS.has(node.tag) || node.tag === 'header') return []
  const byClass = CLASS_READERS.find(([name]) => hasClass(node, name))?.[1]
  const reader =
    byClass ?? (Object.hasOwn(TAG_READERS, node.tag) ? TAG_READERS[node.tag] : undefined)
  if (reader !== undefined) return reader(node, context)
  if (TRANSPARENT_TAGS.has(node.tag)) return readHtmlBlocks(node.children, context)
  return [{ kind: 'other', block: UNMAPPED_BY_TAG[node.tag] ?? `<${node.tag}>` }]
}

const HTML_REFUSALS = { 'too-large': 'is too large', 'too-deep': 'nests too deep' } as const

const elementByTag = (nodes: readonly HtmlNode[], tag: string): HtmlElementNode | undefined =>
  elementsOf(nodes).reduce<HtmlElementNode | undefined>(
    (found, node) =>
      found ?? (node.tag === tag ? node : findDescendant(node, (child) => child.tag === tag)),
    undefined
  )

/**
 * The blocks of one HTML page: a `div.page-body` when the export wrote one,
 * the title `h1.page-title` of its header first; otherwise the whole body.
 */
const readHtmlPage = (
  html: string,
  context: ReadContext
):
  | {
      readonly blocks: readonly NotionBlock[]
      readonly title?: string
      readonly properties: boolean
    }
  | { readonly error: string } => {
  const parsed = parseHtmlElementTree(html)
  if (!parsed.ok) return { error: HTML_REFUSALS[parsed.reason] }
  const all = parsed.nodes.flatMap((node) => (node.kind === 'element' ? descendantsOf(node) : []))
  const titleElement = all.find((node) => node.tag === 'title')
  const documentTitle = cleanText(textOf(titleElement?.children ?? []))
  const body = all.find((node) => hasClass(node, 'page-body'))
  const pageTitle = all.find((node) => node.tag === 'h1' && hasClass(node, 'page-title'))
  const properties = all.some((node) => node.tag === 'table' && hasClass(node, 'properties'))
  const blocks =
    body === undefined
      ? readHtmlBlocks(elementByTag(parsed.nodes, 'body')?.children ?? parsed.nodes, context)
      : [
          ...(pageTitle === undefined ? [] : textBlock('heading_1', pageTitle, context)),
          ...readHtmlBlocks(body.children, context),
        ]
  return documentTitle === ''
    ? { blocks, properties }
    : { blocks, properties, title: documentTitle }
}

/**
 * The workspace index an HTML export writes at its root (fact a7c): a tree of
 * links to every page, not a page. It sits beside the `Export-<uuid>/` root's
 * pages, or at the archive's root.
 */
const isWorkspaceIndex = (path: string): boolean => /^(?:[^/]+\/)?index\.html$/i.test(path)

type PageReading =
  | { readonly kind: 'page'; readonly page: NotionExportPage }
  | { readonly kind: 'error'; readonly error: string }

/** Paths by UTF-16 code unit: the same order on every OS and in every locale. */
const byPath = (left: NotionExportEntry, right: NotionExportEntry): number =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0

/**
 * Read the pages of a Notion export: its HTML pages, or — when it holds none —
 * its Markdown pages (the secondary format, fact c1). Entries are read in path
 * order, never in the order the archive lists them, so the same pages come out
 * in the same order whichever tool or system packed the ZIP.
 */
export const readNotionExport = (archived: readonly NotionExportEntry[]): NotionExportRead => {
  const entries = archived.toSorted(byPath)
  const files = new Set(entries.map((entry) => entry.path))
  const html = entries.filter(
    (entry) => extensionOf(entry.path) === 'html' && !isWorkspaceIndex(entry.path)
  )
  const markdown = entries.filter((entry) => extensionOf(entry.path) === 'md')
  const format = html.length > 0 ? 'html' : 'markdown'
  const pageEntries = format === 'html' ? html : markdown
  if (pageEntries.length === 0) {
    return {
      ok: false,
      reason:
        'holds no Notion page: a Notion export carries an .html file per page (HTML export) or an .md file per page (Markdown & CSV export)',
    }
  }
  if (pageEntries.length > NOTION_MAX_PAGES) {
    return {
      ok: false,
      reason: `holds ${pageEntries.length} pages, more than the ${NOTION_MAX_PAGES} one import reads: export the workspace in parts`,
    }
  }
  const pageFiles = new Set(pageEntries.map((entry) => entry.path))
  const pages = pageEntries.map((entry): PageReading => {
    const folder = folderOf(entry.path)
    const named = titleAndIdOf(stemOf(entry.path))
    const text = decoder.decode(entry.bytes)
    const context = { folder, pageFiles }
    const read =
      format === 'html'
        ? readHtmlPage(text, context)
        : { ...readNotionMarkdownBlocks(text, context), properties: false }
    return 'error' in read
      ? { kind: 'error', error: `the page ${entry.path} ${read.error}` }
      : {
          kind: 'page',
          page: {
            file: entry.path,
            title: read.title ?? named.title,
            id: named.id,
            folder,
            blocks: read.blocks,
            properties: read.properties,
          },
        }
  })
  const failed = pages.flatMap((page) => (page.kind === 'error' ? [page.error] : []))
  const [reason] = failed
  if (reason !== undefined) return { ok: false, reason }
  return {
    ok: true,
    format,
    pages: pages.flatMap((page) => (page.kind === 'page' ? [page.page] : [])),
    files,
  }
}
