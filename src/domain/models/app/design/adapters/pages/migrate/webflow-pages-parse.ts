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
import { migratedLiteral } from './migrated-literal-tokens-service'
import { foldedText } from './webflow-site-forms'
import { readSiteStylesheet, type ClassRule } from './webflow-site-stylesheet'

/**
 * The read half of the Webflow page migration: the files of a Webflow code
 * export ZIP, already inflated within the import's limits, read into pages of
 * inert HTML and the class rules of the site stylesheet. Which kit node an
 * element becomes is `webflow-page-mappings.ts`'s alone.
 *
 * ─── READ AGAINST A REAL EXPORT ────────────────────────────────────────────
 *
 * The shape is the one the pinned export shows (`webflow/2.2.2`,
 * `export-sample/site-export/`, fact c2): one `.html` file a page beside a
 * `css/` folder holding `normalize.css`, `webflow.css` and the site's own
 * `<site>.webflow.css`, a `js/` folder, and `images/` and `fonts/` folders.
 * Only the site stylesheet is read (`webflow-site-stylesheet.ts`).
 *
 * ─── INERT ─────────────────────────────────────────────────────────────────
 *
 * HTML is read through the kernel's inert tree: a `<script>` or `<style>` is
 * kept empty and never read, nothing runs, and nothing is fetched — the
 * jQuery an export loads from Webflow's CDN is a URL in a tag this reader
 * skips. A page past the kernel's length or depth bound refuses the export
 * rather than arriving with a hole in it.
 */

/** One file of the export, inflated, by its path inside the ZIP. */
export interface WebflowExportEntry {
  readonly path: string
  readonly bytes: Uint8Array
}

/** One page of the export. */
export interface WebflowExportPage {
  /** The export entry the page was read from. */
  readonly file: string
  /** The page's `<title>`, else its file name. */
  readonly title: string
  /** The page's `<body>` content, in order. */
  readonly body: readonly HtmlNode[]
}

/** The export read, or why it cannot be. */
export type WebflowExportRead =
  | {
      readonly ok: true
      readonly pages: readonly WebflowExportPage[]
      /** The site stylesheet's export path, when the export holds one. */
      readonly stylesheet: string | undefined
      readonly rules: readonly ClassRule[]
      /** Whether the site stylesheet's `:root` declares Variables (fact c5). */
      readonly declaresVariables: boolean
    }
  | { readonly ok: false; readonly reason: string }

/** Most pages one export may turn into. */
export const WEBFLOW_MAX_PAGES = 2000

/** The export's asset folders: no page sits in them (fact c2). */
const ASSET_FOLDERS: ReadonlySet<string> = new Set([
  'css',
  'js',
  'images',
  'fonts',
  'documents',
  'videos',
])

const decoder = new TextDecoder('utf-8', { fatal: false })

const isPageFile = (path: string): boolean =>
  /\.html?$/i.test(path) && !ASSET_FOLDERS.has(path.split('/')[0]?.toLowerCase() ?? '')

/** The site's own stylesheet: a `css/<site>.webflow.css` that is not Webflow's `webflow.css`. */
const isSiteStylesheet = (path: string): boolean =>
  /^css\/[^/]+\.webflow\.css$/i.test(path) && path.toLowerCase() !== 'css/webflow.css'

const isElement = (node: HtmlNode): node is HtmlElementNode => node.kind === 'element'

/** The first element of `tag`, depth first. */
const findTag = (nodes: readonly HtmlNode[], tag: string): HtmlElementNode | undefined =>
  nodes
    .filter(isElement)
    .reduce<HtmlElementNode | undefined>(
      (found, element) => found ?? (element.tag === tag ? element : findTag(element.children, tag)),
      undefined
    )

const fileNameOf = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.html?$/i, '')

const readPage = (entry: WebflowExportEntry): WebflowExportPage | string => {
  const tree = parseHtmlElementTree(decoder.decode(entry.bytes))
  if (!tree.ok) {
    return `holds the page ${JSON.stringify(entry.path)}, ${tree.reason === 'too-large' ? 'larger' : 'nested deeper'} than the import reads`
  }
  const body = findTag(tree.nodes, 'body')
  const title = foldedText(findTag(tree.nodes, 'title')?.children ?? [])
  return {
    file: entry.path,
    title: migratedLiteral(title === '' ? fileNameOf(entry.path) : title),
    body:
      body?.children ??
      tree.nodes.filter(
        (node) => !(isElement(node) && (node.tag === 'head' || node.tag === 'html'))
      ),
  }
}

/** The site stylesheet's rules, none when the export holds no site stylesheet, or why it is refused. */
const stylesheetOf = (
  entries: readonly WebflowExportEntry[]
):
  | {
      readonly ok: true
      readonly path: string | undefined
      readonly rules: readonly ClassRule[]
      readonly declaresVariables: boolean
    }
  | { readonly ok: false; readonly reason: string } => {
  const [sheet] = entries
    .filter((entry) => isSiteStylesheet(entry.path))
    .toSorted((a, b) => a.path.localeCompare(b.path))
  if (sheet === undefined) return { ok: true, path: undefined, rules: [], declaresVariables: false }
  const read = readSiteStylesheet(decoder.decode(sheet.bytes))
  return read.ok
    ? { ok: true, path: sheet.path, rules: read.rules, declaresVariables: read.declaresVariables }
    : { ok: false, reason: `holds ${JSON.stringify(sheet.path)}, which ${read.reason}` }
}

/** Read the files of a Webflow code export into pages and the site's class rules. */
export const readWebflowExport = (entries: readonly WebflowExportEntry[]): WebflowExportRead => {
  const pageEntries = entries.filter((entry) => isPageFile(entry.path))
  if (pageEntries.length === 0) {
    return { ok: false, reason: 'holds no Webflow page (no `.html` file)' }
  }
  if (pageEntries.length > WEBFLOW_MAX_PAGES) {
    return { ok: false, reason: `holds more than ${WEBFLOW_MAX_PAGES} pages` }
  }
  const stylesheet = stylesheetOf(entries)
  if (!stylesheet.ok) return stylesheet
  const pages = pageEntries.map(readPage)
  const refused = pages.find((page): page is string => typeof page === 'string')
  if (refused !== undefined) return { ok: false, reason: refused }
  return {
    ok: true,
    pages: pages.filter((page): page is WebflowExportPage => typeof page !== 'string'),
    stylesheet: stylesheet.path,
    rules: stylesheet.rules,
    declaresVariables: stylesheet.declaresVariables,
  }
}
