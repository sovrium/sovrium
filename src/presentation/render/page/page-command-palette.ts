/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The command palette the component-filter pipeline appends to every page, or
 * completes when the author placed one: its page list is filtered for the
 * caller, and the tables and fields it may not read are never named.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import { findDeclaredPage } from '@/domain/models/app/pages/page-path-resolvability'
import {
  unreadableTableFields,
  unreadableTables,
} from '@/presentation/render/props/resolve-record-drawer-access'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The one "may this caller open that page?" question every palette page list
 * asks — the same `checkPageAccess` the page route applies. A misconfigured
 * `access` (an unknown role or group) is not `allowed`, so it drops the page.
 */
const mayOpenPage = (page: Page, app: App, session: SessionInfo | undefined): boolean =>
  checkPageAccess(page.access, app, session).allowed

/**
 * Filter an AUTHORED palette's `props.pages` list for this caller.
 *
 * An author's list is the candidate set, never an allow-list: an entry that
 * resolves to a declared page (by `path`, else by `name`) the caller may not
 * open is dropped, so a gated page's title never reaches the markup of a page
 * an anonymous visitor renders. An entry naming no declared page is kept — it
 * points at nothing the engine gates.
 */
const filterAuthoredPages = (
  pages: unknown,
  app: App,
  session: SessionInfo | undefined
): unknown => {
  if (!Array.isArray(pages)) return pages
  return pages.filter((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return true
    const { path, name } = entry as { readonly path?: unknown; readonly name?: unknown }
    const declared =
      typeof path === 'string'
        ? findDeclaredPage(app, path)?.page
        : (app.pages ?? []).find((page) => typeof name === 'string' && page.name === name)
    return declared === undefined || mayOpenPage(declared, app, session)
  })
}

/**
 * Applies all component filters to a page: auth stripping, OAuth filtering,
 * visibility rules, CRUD create/update permission checks, and `formRef`
 * expansion (turning page-form components into pre-rendered embedded forms
 * via `expandFormRefs` from `forms/form-ref-resolver.ts`).
 *
 * `parentRecord` (Y-5) is forwarded to `expandFormRefs` so embedded forms
 * can resolve `inlinePrefill` tokens like `$parent.id` against the host
 * page's `dataSource: { mode: 'single' }` record.
 *
 * A render-time-only `command-palette` component is appended to every page so
 * the global `Cmd+K` palette is available app-wide without schema authoring.
 *
 * The synthesized component carries the app's navigable pages (static pages
 * only — record-detail templates with a `:param` segment are excluded) in its
 * `props.pages` so the palette runtime can offer "Go to <page>" quick actions
 * without an extra API call. Tables reach the renderer separately via the
 * component-dispatch `tables` config.
 *
 * Only the pages THIS caller may open are listed, decided by the same
 * `checkPageAccess` the page route applies (roles, the admin tier, groups,
 * `authenticated`, `all`). The palette is rendered per request, so unlike the
 * sitemap or the feed it can follow the session — and a page the caller
 * cannot open must not be named in the markup that carries the palette.
 */
export const buildCommandPaletteComponent = (
  app: App,
  session: SessionInfo | undefined
): Component => {
  // Resolve `$t:` tokens in page titles, in the app's default language.
  const navigablePages = (app.pages ?? [])
    .filter((page) => typeof page.path === 'string' && !page.path.includes(':'))
    .filter((page) => mayOpenPage(page, app, session))
    .map((page) => ({
      name: page.name,
      path: page.path,
      title: resolveTranslationPattern(
        page.meta?.title && page.meta.title.length > 0 ? page.meta.title : page.name,
        app.languages?.default ?? 'en',
        app.languages
      ),
    }))
  // The create dialogs name each table's text fields: never one this caller may not read.
  const unreadableFields = unreadableTableFields(app, session)
  // A table this caller may not read is not named at all, nor its fields.
  const hiddenTables = unreadableTables(app, session)
  return {
    type: 'command-palette',
    props: {
      pages: navigablePages,
      ...(Object.keys(unreadableFields).length === 0
        ? {}
        : { _unreadableFields: unreadableFields }),
      ...(hiddenTables.length === 0 ? {} : { _unreadableTables: hiddenTables }),
    },
  } as Component
}

/**
 * True when the page already carries a `command-palette` of its own, at any
 * depth.
 *
 * Authoring one is the third palette state — after "appended by the engine" and
 * "switched off app-wide" — and it SUPPRESSES the append. Two palettes bound to
 * one ⌘K open two overlays on one keystroke, so this is a defect the append
 * must not create rather than a composition.
 */
export const hasAuthoredPalette = (
  items: ReadonlyArray<Component | string> | undefined
): boolean => {
  if (items === undefined) return false
  return items.some((item) => {
    if (typeof item === 'string') return false
    if ('component' in item || '$ref' in item) return false
    if ((item as { readonly type?: string }).type === 'command-palette') return true
    const { children } = item as { readonly children?: ReadonlyArray<Component | string> }
    return hasAuthoredPalette(children)
  })
}

/**
 * Give an authored built-in palette the app's navigable pages.
 *
 * The built-in mode's "Go to <page>" quick actions come from `props.pages`,
 * which only the app knows — so an authored palette declaring no `search` would
 * otherwise offer an empty list purely for having been placed by hand. A
 * search-mode palette is left alone: it has no page list, by design.
 *
 * An author-written `props.pages` wins over the injected list but is filtered
 * for this caller first — see `filterAuthoredPages`.
 */
export const withNavigablePages = (
  items: ReadonlyArray<Component | string>,
  synthesized: Component,
  app: App,
  session: SessionInfo | undefined
): ReadonlyArray<Component | string> =>
  items.map((item) => {
    if (typeof item === 'string') return item
    if ('component' in item || '$ref' in item) return item
    const node = item as Component & {
      readonly search?: unknown
      readonly props?: Record<string, unknown>
      readonly children?: ReadonlyArray<Component | string>
    }
    if (node.type === 'command-palette') {
      if (node.search !== undefined) return item
      const injected = (synthesized as { readonly props?: Record<string, unknown> }).props ?? {}
      const authored = node.props ?? {}
      const props =
        'pages' in authored
          ? {
              ...injected,
              ...authored,
              pages: filterAuthoredPages(authored['pages'], app, session),
            }
          : { ...injected, ...authored }
      return { ...node, props } as Component
    }
    if (node.children === undefined) return item
    return {
      ...node,
      children: withNavigablePages(node.children, synthesized, app, session),
    } as Component
  })
