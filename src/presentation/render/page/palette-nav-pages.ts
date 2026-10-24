/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import { mountHref } from '@/domain/models/app/admin/mount-hrefs'
import { findDeclaredLanguageCode } from '@/domain/models/app/languages/language-detection'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * The pages a SEARCH palette matches beside its results: the app's pages its
 * navigation names, each under the words the navigation gives it.
 *
 * ─── NAMED AS THE NAVIGATION NAMES THEM ────────────────────────────────────
 *
 * A page's `meta.title` is written for a browser tab — « Sovrium — Connections »
 * — and reads wrong as a row of a list. The sidebar already names every page an
 * operator goes to, so a page is offered under its sidebar label, and a page no
 * sidebar names (a sign-in page, a record template) is not offered at all: it
 * is not somewhere a reader navigates to by name.
 *
 * ─── ONLY PAGES THE APP SERVES, AND THE CALLER MAY OPEN ────────────────────
 *
 * The label is looked up per declared page, so an entry leading to a page the
 * app does not serve (one `requires` pruned) offers nothing — a match is never a
 * dead end — and a page whose `access` refuses the caller is left out, the
 * question the page route asks.
 */

/** One page the palette can go to: its address, as the browser reaches it. */
export interface PaletteNavPage {
  readonly name: string
  readonly path: string
  readonly title: string
}

type Rec = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every `{ href, label }` entry of a sidebar's groups, children included. */
const entryLabels = (entries: unknown): ReadonlyArray<readonly [string, string]> =>
  Array.isArray(entries)
    ? entries.flatMap((entry): ReadonlyArray<readonly [string, string]> => {
        if (!isRecord(entry)) return []
        const own =
          typeof entry['href'] === 'string' && typeof entry['label'] === 'string'
            ? [[entry['href'], entry['label']] as const]
            : []
        return [...own, ...entryLabels(entry['children'])]
      })
    : []

/** Every sidebar entry under `node`, at any depth, as `[href, label]`. */
const sidebarLabels = (node: unknown): ReadonlyArray<readonly [string, string]> => {
  if (Array.isArray(node)) return node.flatMap(sidebarLabels)
  if (!isRecord(node)) return []
  const own =
    node['type'] === 'sidebar' && Array.isArray(node['groups'])
      ? node['groups'].flatMap((group) => (isRecord(group) ? entryLabels(group['items']) : []))
      : []
  return [...own, ...Object.values(node).flatMap(sidebarLabels)]
}

/**
 * The base a mounted app's links point under (`data-admin-base-path`, which
 * the mount rewrites with every link), or `undefined` on an app's own pages.
 */
const mountBaseOf = (node: unknown): string | undefined => {
  if (Array.isArray(node)) {
    return node.reduce<string | undefined>((found, child) => found ?? mountBaseOf(child), undefined)
  }
  if (!isRecord(node)) return undefined
  const { props } = node
  const base = isRecord(props) ? props['data-admin-base-path'] : undefined
  if (typeof base === 'string') return base.replace(/\/+$/, '')
  return Object.values(node).reduce<string | undefined>(
    (found, child) => found ?? mountBaseOf(child),
    undefined
  )
}

interface NavLabels {
  /** The label each href is navigated to under, first sidebar entry first. */
  readonly labels: ReadonlyMap<string, string>
  /** The base the links carry (`/_admin` on the console), `''` on an app's own pages. */
  readonly base: string
}

/** Cached per app: a mounted console is built once and rendered per request. */
const navLabelCache = new WeakMap<App, NavLabels>()

const navLabelsOf = (app: App): NavLabels => {
  const cached = navLabelCache.get(app)
  if (cached !== undefined) return cached
  const tree = [app.pages, app.components]
  const found = { labels: new Map(sidebarLabels(tree).toReversed()), base: mountBaseOf(tree) ?? '' }
  navLabelCache.set(app, found)
  return found
}

/**
 * The pages of `app` its navigation names, which `session` may open, titled
 * in `lang`, each at the address its navigation links to — on a mounted
 * console, under the mount its links point under.
 */
export const paletteNavPages = (
  app: App,
  session: SessionInfo | undefined,
  options: { readonly lang: string }
): readonly PaletteNavPage[] => {
  const { labels, base } = navLabelsOf(app)
  const language = findDeclaredLanguageCode(app.languages, options.lang)
  return (app.pages ?? []).flatMap((page): readonly PaletteNavPage[] => {
    const own = primaryPagePath(page.path, language)
    const path = base === '' ? own : mountHref(base, own)
    const label = labels.get(path)
    if (label === undefined || !checkPageAccess(page.access, app, session).allowed) return []
    return [
      {
        name: page.name ?? own,
        path,
        title: resolveTranslationPattern(label, options.lang, app.languages),
      },
    ]
  })
}

/** A table the caller may read, under the words its records page is named with. */
export interface PaletteTable {
  readonly name: string
  readonly label: string
}

/** The trailing segment of a page drawn once per table: `/records/:table`. */
const TABLE_SEGMENT = '/:table'

/**
 * One entry per table in `tables` for each page of `app` drawn per table
 * (`<parent>/:table`) whose parent the navigation names — titled
 * `<parent's label> › <table label>` in `lang` (« Records › Quotes »), at that
 * table's address. `tables` is the caller's to decide: a table she may not
 * read is never passed in, so it is never named.
 */
export const paletteTablePages = (
  app: App,
  session: SessionInfo | undefined,
  tables: readonly PaletteTable[],
  options: { readonly lang: string }
): readonly PaletteNavPage[] => {
  const { labels, base } = navLabelsOf(app)
  const at = (path: string): string => (base === '' ? path : mountHref(base, path))
  const language = findDeclaredLanguageCode(app.languages, options.lang)
  return (app.pages ?? []).flatMap((page): readonly PaletteNavPage[] => {
    const own = primaryPagePath(page.path, language)
    if (!own.endsWith(TABLE_SEGMENT)) return []
    const parent = own.slice(0, -TABLE_SEGMENT.length)
    const label = labels.get(at(parent))
    if (label === undefined || !checkPageAccess(page.access, app, session).allowed) return []
    const heading = resolveTranslationPattern(label, options.lang, app.languages)
    return tables.map((table) => ({
      name: `${page.name ?? own}/${table.name}`,
      path: at(`${parent}/${table.name}`),
      title: `${heading} › ${table.label}`,
    }))
  })
}
