/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turning a fully-resolved page into a document: which island bundle it needs,
 * which chunks to preload, and the `renderToString` call itself.
 *
 * The island half and the render half are one file because they are one
 * decision seen twice — `resolveIslandAssets` decides whether a bundle is
 * BUILT and `DynamicPage` decides whether the hydration script is INJECTED, and
 * the two must agree (a bundle with no script leaves a dead skeleton; a script
 * with no bundle 404s). Keeping the detection predicates beside the document
 * assembly that consumes them is what makes that agreement checkable in one
 * place.
 */

import { renderToString } from 'react-dom/server'
import { isOperatorConsoleApp } from '@/domain/models/app/admin/admin-data-nav'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { getVersionedCssPath } from '@/infrastructure/css/versioned-css-path'
import { logError } from '@/infrastructure/logging/logger'
import {
  extractSessionTimeout,
  shouldInjectAnalytics,
} from '@/presentation/render/page/analytics-helpers'
import { DynamicPage } from '@/presentation/render/page/dynamic-page'
import {
  ISLAND_COMPONENT_TYPES,
  zeroJsDialogNeedsNoRuntime,
} from '@/presentation/render/registry/island-component-types'
import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import { isSearchPalette } from '@/presentation/render/registry/search-palette-mode'
import { isSourcedSidebar } from '@/presentation/render/registry/sourced-sidebar-mode'
import { isRecordFieldSystemMode } from '@/presentation/render/registry/system-detail-mode'
import { someComponentInTree } from '@/presentation/render/resolve/component-template-walker'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { ResolvedMarkdownPage } from '@/presentation/render/markdown/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/render/resolve/sidebar-resolver'

/**
 * Island builder interface — injected by the infrastructure layer
 * to keep presentation free of infrastructure imports.
 */
export interface IslandBuilder {
  readonly buildIslands: () => Promise<{
    readonly entryFile: string
    readonly preloads: Readonly<Record<string, readonly string[]>>
  }>
}

/**
 * Checks whether a single component (or any of its descendants) needs the
 * island runtime. Matches explicit island component types (see
 * `ISLAND_COMPONENT_TYPES`), search-mode sections, and form sections with
 * auth/crud actions. Recursively descends into `children` so nested
 * data-tables (e.g. inside a container's children array) are detected.
 */
const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

/**
 * PG-04: a `form` bound to a single-record dataSource has a
 * synthesized CRUD update action injected by `renderForm` at render time
 * (see `maybeSynthesizeCrudUpdateAction`). The hydrated `crud-form` island
 * must still mount so the synthesized Save submission goes through the
 * Records API mutation pipeline instead of falling through as a static
 * SSR form post.
 */
function isSingleRecordBoundForm(s: Component): boolean {
  return (
    s.type === 'form' && s.dataSource?.mode === 'single' && typeof s.dataSource.table === 'string'
  )
}

/**
 * True when a component carries an explicit `data-island="<type>"` marker in its
 * `props` (the render-time island-injection pattern — e.g. the admin console's
 * `admin-spa-nav` mounted onto a generic `container`). The island bundle must be
 * BUILT when such a marker is present, or the injected hydration script 404s.
 * Mirrors `hasDataIslandProp` in `dynamic-page.tsx` (both sites must agree).
 */
function hasDataIslandProp(s: Component): boolean {
  const props = (s as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

/**
 * The shapes that mount an island through their BINDING rather than their type,
 * so none of them can be listed in `ISLAND_COMPONENT_TYPES`:
 *
 *  - CAP-1 a client-fetching data-bound list (`listDisplay.itemTemplate` + a
 *    table/system binding) → the `list` island;
 *  - CAP-2 a record-field self-bound to a system detail endpoint →
 *    `record-field-system`;
 *  - P2 a sidebar with a FETCHED group → `sidebar-groups`. An authored-only
 *    sidebar is fully SSR and needs no bundle.
 *  - W a `command-palette` in SEARCH mode → `command-palette`. The built-in
 *    quick-action mode builds its overlay from an inline script and mounts
 *    nothing, and it is appended to every page.
 *
 * Mirrors `bindsToIsland` in `page-island-detection.ts`, which decides whether to
 * INJECT the hydration script for the bundle this decides to BUILD. The two must
 * agree: a bundle with no script leaves a dead skeleton, a script with no bundle
 * 404s.
 */
function bindsToIsland(s: Component): boolean {
  return (
    isListIslandMode(s) || isRecordFieldSystemMode(s) || isSourcedSidebar(s) || isSearchPalette(s)
  )
}

function selfNeedsIslands(s: Component): boolean {
  // Checked BEFORE the type set: `dialog` is a member of it, but a
  // `hydrate: false` dialog renders enhancer-driven markup and mounts nothing.
  if (zeroJsDialogNeedsNoRuntime(s)) return false
  if (ISLAND_COMPONENT_TYPES.has(s.type)) return true
  if (hasDataIslandProp(s)) return true
  if (s.dataSource?.mode === 'search') return true
  if (bindsToIsland(s)) return true
  if (isSingleRecordBoundForm(s)) return true
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

/**
 * Checks whether a resolved page needs the island runtime by walking each
 * component (children AND referenced `app.components` templates, via
 * `someComponentInTree`) against `selfNeedsIslands`. A page with
 * `presence: true` (Wave-6) always needs the runtime so the page-level
 * `presence-indicator` island bundle is built.
 *
 * Mirrors `hasIslandComponents` in `dynamic-page.tsx` (both sites must agree:
 * bundle built but no script tag → gray skeleton; script tag but no bundle →
 * 404 on the script).
 */
function pageNeedsIslands(page: Page, components: App['components']): boolean {
  if (page.presence === true) return true
  return someComponentInTree(page.components, components, (s) => selfNeedsIslands(s as Component))
}

/**
 * True when this component mounts the `crud-form` island.
 *
 * Deliberately OVER-inclusive: a `button` with a `crud` delete action reaches
 * the same island as a `form` does, and the two are indistinguishable here
 * without duplicating the renderer's dispatch. The cost of a false positive is
 * one unused `modulepreload` hint; the cost of a false negative is the race in
 * `@/infrastructure/assets/island-preload-manifest` coming back — a form that
 * renders perfectly and silently drops an uploaded file.
 */
function selfMountsCrudForm(s: Component): boolean {
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  // `isSingleRecordBoundForm` covers PG-04's synthesized crud update, which
  // carries no authored `action` at all.
  return action?.type === 'crud' || isSingleRecordBoundForm(s)
}

/** True when this component mounts the `auth-form` island. */
function selfMountsAuthForm(s: Component): boolean {
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type === 'auth'
}

/**
 * Which preloadable island types this page declares.
 *
 * Two single-purpose walks rather than one collecting walk, because
 * `someComponentInTree` short-circuits on the first match — which is the right
 * behaviour for a yes/no question and the reason it is cheap. Both questions
 * asked separately stay cheap; a collecting variant would visit every node of
 * every page for the sake of two answers.
 */
function pagePreloadIslandTypes(page: Page, components: App['components']): readonly string[] {
  const crud = someComponentInTree(page.components, components, (s) =>
    selfMountsCrudForm(s as Component)
  )
  const auth = someComponentInTree(page.components, components, (s) =>
    selfMountsAuthForm(s as Component)
  )
  return [...(auth ? ['auth-form'] : []), ...(crud ? ['crud-form'] : [])]
}

/**
 * Island assets this page needs: the entry filename, plus the chunk URLs the
 * document should declare as `modulepreload`.
 *
 * The preload hrefs are scoped to the island types the page actually declares.
 * That scoping is the whole point — the unscoped shape would put every
 * preloadable island's sub-graph into the `<head>` of every island-bearing
 * page, which is the defect this whole line of work removed from the runtime
 * path. See `@/infrastructure/assets/island-preload-manifest` for why only
 * these two types are preloaded at all.
 */
export async function resolveIslandAssets(
  page: Page,
  components: App['components'],
  islandBuilder?: IslandBuilder
): Promise<{ readonly entryFile: string | undefined; readonly preloadHrefs: readonly string[] }> {
  const needs = pageNeedsIslands(page, components)
  if (!needs || !islandBuilder) return { entryFile: undefined, preloadHrefs: [] }

  try {
    const result = await islandBuilder.buildIslands()
    const types = pagePreloadIslandTypes(page, components)
    const chunks = types.flatMap((type) => result.preloads[type] ?? [])
    return {
      entryFile: result.entryFile,
      preloadHrefs: [...new Set(chunks)].map((chunk) => `/assets/islands/${chunk}`),
    }
  } catch (error) {
    logError('[RENDER] Failed to build island bundle', error)
    return { entryFile: undefined, preloadHrefs: [] }
  }
}

/**
 * Builds the React-rendered HTML output for a fully-resolved page.
 * Extracted so `renderPageByPath` stays under its statement/complexity
 * limits — the post-login landing resolver added enough state to push
 * it over otherwise.
 */
interface RenderPageHtmlInput {
  readonly app: App
  readonly page: Page
  readonly routeParams: Readonly<Record<string, string>>
  readonly detectedLanguage: string | undefined
  /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
  readonly urlLanguage: string | undefined
  readonly islandEntryFile: string | undefined
  /** `<link rel="modulepreload">` hrefs for the islands this page mounts. */
  readonly islandPreloadHrefs: readonly string[]
  readonly resolvedSidebar: readonly ResolvedSidebarSection[] | undefined
  readonly markdownPayload: ResolvedMarkdownPage | undefined
  readonly session: SessionInfo | undefined
  /**
   * `app.components` after the async code-highlight pre-pass. `app.components`
   * is passed to `DynamicPage` BY VALUE, so a resolver that only rewrote
   * `page.components` would leave every `code` block reached through a
   * `{ component: 'name' }` reference unhighlighted — hence the explicit
   * override.
   */
  readonly appComponents: App['components']
}

export function renderPageHtml(input: RenderPageHtmlInput): string {
  const {
    app,
    page,
    routeParams,
    detectedLanguage,
    urlLanguage,
    islandEntryFile,
    islandPreloadHrefs,
    resolvedSidebar,
    markdownPayload,
    session,
    appComponents,
  } = input
  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)
  const sessionTimeout = extractSessionTimeout(app.analytics)
  const html = renderToString(
    <DynamicPage
      page={page}
      badgeEnabled={isBadgeEnabled(app.badge)}
      demoNoticeEnabled={!isOperatorConsoleApp(app)}
      components={appComponents}
      // One position. This used to read `app.design?.theme ?? app.theme`, and
      // the fallback was load-bearing: reading only the alias left an app that
      // had moved its block with no tokens at all in its head, so the no-FOUC
      // colour-scheme bootstrap emitted nothing and the dark cascade — a class
      // on `<html>`, not a media query — stayed unreachable for an app written
      // the way the docs asked for. There is nothing left to fall back to.
      design={app.design}
      languages={app.languages}
      tables={app.tables}
      buckets={app.buckets}
      landingPath={app.auth?.landingPath}
      detectedLanguage={detectedLanguage}
      urlLanguage={urlLanguage}
      routeParams={routeParams}
      builtInAnalyticsEnabled={injectAnalytics}
      builtInAnalyticsSessionTimeout={sessionTimeout}
      islandEntryFile={islandEntryFile}
      islandPreloadHrefs={islandPreloadHrefs}
      resolvedSidebar={resolvedSidebar}
      markdownPayload={markdownPayload}
      session={session}
      cssHref={getVersionedCssPath(app)}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}
