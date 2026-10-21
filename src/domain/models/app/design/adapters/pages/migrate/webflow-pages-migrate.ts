/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { pageNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { migratedPageLiteralTokens } from './migrated-literal-tokens-service'
import { MIGRATION_PAGE_FACTS } from './migrated-page-mapping'
import {
  allMigratedNodes,
  migratedPageStructure,
  withMigratedKeys,
} from './migrated-page-tree-service'
import { pageSlugOf } from './notion-pages-migrate'
import { convertNodes, type ConvertedNodes, type WebflowNode } from './webflow-page-nodes'
import {
  readWebflowExport,
  type WebflowExportEntry,
  type WebflowExportPage,
} from './webflow-pages-parse'
import type { MigratedPagesReport } from './migrated-pages-report'
import type { SpacingScale } from './webflow-page-layout'
import type { WebflowExtractedForm } from './webflow-site-forms'

/**
 * The Webflow page migration: a Webflow code export, already inflated, to
 * NEW Sovrium pages, the forms they hold, and the report's `pages` section
 * ([internal ref] A14, pages part).
 *
 * - Each exported `.html` file becomes a page, in export order: `index.html`
 *   is `home` at `/`, `about.html` is `about` at `/about`, `blog/index.html`
 *   is `blog` at `/blog`. A link to another page of the export points at that
 *   page's migrated path.
 * - Every node gets a fresh kebab-case `key`, `<type>-<n>` in page order:
 *   the same export always gives the same keys, pages and section.
 * - A layout value is written only on a step of the app's spacing scale;
 *   anything else is reported with the nearest step (`webflow-page-layout.ts`).
 * - Each form is returned in the shape of an `ExtractedForm`, and the page holds one
 *   `form` node whose `formRef` is that form's name; the import's forms
 *   mapper writes the form, and a page whose reference names no written form
 *   is refused there.
 * - The site's Variables are never written: when the site stylesheet's
 *   `:root` declares any (fact c5), the section names that stylesheet and the
 *   `sovrium design-system import` command that reads it.
 *
 * Pure: entries in, plan out. Nothing is fetched, nothing is run, no clock.
 */

/** What the config already holds that a Webflow migration reads. */
export interface WebflowMigrationTarget {
  /** `design.spacing`: the scale every gap and padding is written on. */
  readonly spacing?: SpacingScale | undefined
}

/** One page a Webflow migration writes. */
export interface WebflowPageEntry {
  readonly name: string
  readonly path: string
  readonly meta: { readonly title: string }
  readonly components: readonly WebflowNode[]
}

/** The converter's answer, or why the export is refused. */
export type WebflowPagesResult =
  | {
      readonly ok: true
      readonly pages: readonly WebflowPageEntry[]
      readonly report: MigratedPagesReport
      readonly forms: readonly WebflowExtractedForm[]
    }
  | { readonly ok: false; readonly reason: string }

interface Placed {
  readonly page: WebflowExportPage
  readonly name: string
  readonly path: string
}

/** A page file's folders and name, `index` standing for its folder. */
const segmentsOf = (file: string): readonly string[] => {
  const parts = file
    .replace(/\.html?$/i, '')
    .split('/')
    .filter((part) => part !== '')
  return parts.at(-1)?.toLowerCase() === 'index' ? parts.slice(0, -1) : parts
}

/** A page name: the slug of its segments, `home` for the root, a letter first. */
const nameOf = (segments: readonly string[]): string => {
  const slug = segments.map(pageSlugOf).join('-')
  if (slug === '') return 'home'
  return /^[a-z]/.test(slug) ? slug : `page-${slug}`
}

/** Name and place every page: unique names, the path its file names. */
const placePages = (pages: readonly WebflowExportPage[]): readonly Placed[] =>
  pages.reduce<readonly Placed[]>((placed, page) => {
    const segments = segmentsOf(page.file)
    const base = nameOf(segments)
    const names = new Set(placed.map((entry) => entry.name))
    const name =
      [base, ...placed.map((_, index) => `${base}-${index + 2}`)].find((c) => !names.has(c)) ??
      `${base}-${placed.length + 2}`
    const path = `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`
    return [...placed, { page, name, path }]
  }, [])

/** The folder of an export entry, `''` at the root. */
const folderOf = (file: string): string =>
  file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : ''

/** A path with its percent escapes decoded, or as written when an escape is malformed. */
const decodedPath = (path: string): string => {
  try {
    return decodeURIComponent(path)
  } catch {
    // A stray `%` names no escape: the path is compared as the page wrote it.
    return path
  }
}

/** An `href` resolved against the page's folder, to the export entry it names. */
const resolveHref = (href: string, from: string): string => {
  const bare = decodedPath(href.replace(/[?#].*$/, ''))
  const joined = bare.startsWith('/') ? bare.slice(1) : `${folderOf(from)}${bare}`
  return joined
    .split('/')
    .reduce<readonly string[]>(
      (parts, part) =>
        part === '..' ? parts.slice(0, -1) : part === '.' || part === '' ? parts : [...parts, part],
      []
    )
    .join('/')
}

const hrefFinder =
  (placed: readonly Placed[], from: string) =>
  (href: string): string | undefined => {
    const target = resolveHref(href, from)
    const hash = /#.*$/.exec(href)?.[0] ?? ''
    const page = placed.find(
      (entry) =>
        entry.page.file === target ||
        entry.page.file === `${target}.html` ||
        entry.page.file === `${target}/index.html`
    )
    return page === undefined ? undefined : `${page.path}${hash}`
  }

interface PageResult {
  readonly placed: Placed
  readonly converted: ConvertedNodes
  readonly components: readonly WebflowNode[]
}

const convertPages = (
  placed: readonly Placed[],
  spacing: SpacingScale,
  rules: Parameters<typeof convertNodes>[2]['rules']
): readonly PageResult[] =>
  placed.reduce<readonly PageResult[]>((done, entry) => {
    const formNames = new Set(
      done.flatMap((result) => result.converted.forms.map((found) => found.form.name))
    )
    const converted = convertNodes(entry.page.body, '/components', {
      page: entry.name,
      path: entry.path,
      file: entry.page.file,
      spacing,
      rules,
      hrefOf: hrefFinder(placed, entry.page.file),
      formNames,
      formsBefore: 0,
    })
    const components = withMigratedKeys(converted.nodes)
    return [...done, { placed: entry, converted, components }]
  }, [])

const reportOf = (
  results: readonly PageResult[],
  tokens: MigratedPagesReport['tokens']
): MigratedPagesReport => ({
  status: 'converted',
  source: 'webflow',
  facts: MIGRATION_PAGE_FACTS.webflow,
  created: results.map((result) => ({
    name: result.placed.name,
    path: result.placed.path,
    file: result.placed.page.file,
    nodes: allMigratedNodes(result.components).length,
  })),
  refused: [],
  unbound: results.flatMap((result) => result.converted.unbound),
  unmapped: results.flatMap((result) => result.converted.unmapped),
  offScale: results.flatMap((result) => result.converted.offScale),
  forms: results.flatMap((result) =>
    result.converted.forms.map(({ pointer, form }) => ({
      page: result.placed.name,
      node: pageNodeIdOf(result.placed.name, pointer),
      form: form.name,
      sourceId: form.sourceId,
    }))
  ),
  literalTokens: results.flatMap((result) =>
    migratedPageLiteralTokens(result.placed.name, result.components, [
      { pointer: '/meta', value: result.placed.page.title },
      ...result.converted.forms.map(({ pointer, form }) => ({ pointer, value: form })),
    ])
  ),
  leftBehind: results.flatMap((result) => result.converted.leftBehind),
  structure: results.map((result) => migratedPageStructure(result.placed.name, result.components)),
  templates: { created: false },
  ...(tokens === undefined ? {} : { tokens }),
})

/** Plan the migration of a Webflow code export's pages into an app whose config holds `target`. */
export const planWebflowPages = (
  entries: readonly WebflowExportEntry[],
  target: WebflowMigrationTarget = {}
): WebflowPagesResult => {
  const read = readWebflowExport(entries)
  if (!read.ok) return read
  const results = convertPages(placePages(read.pages), target.spacing ?? {}, read.rules)
  const tokens =
    read.declaresVariables && read.stylesheet !== undefined
      ? {
          stylesheet: read.stylesheet,
          command: `sovrium design-system import <folder>/${read.stylesheet} --from css`,
        }
      : undefined
  return {
    ok: true,
    pages: results.map((result) => ({
      name: result.placed.name,
      path: result.placed.path,
      meta: { title: result.placed.page.title },
      components: result.components,
    })),
    report: reportOf(results, tokens),
    forms: results.flatMap((result) => result.converted.forms.map(({ form }) => form)),
  }
}
