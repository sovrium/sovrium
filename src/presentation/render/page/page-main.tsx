/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { toSlug } from '@/presentation/design/string-utils'
import { MAIN_REGION_ID } from '@/presentation/render/page/main-region'
import { MarkdownArticle } from '@/presentation/render/page/markdown-article'
import { SectionRenderer } from '@/presentation/render/page/section-renderer'
import { componentField, keyOf } from '@/presentation/render/resolve/component-rewrite'
import { someComponentInTree } from '@/presentation/render/resolve/component-template-walker'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { ResolvedMarkdownPage } from '@/presentation/render/markdown/markdown-page-resolver'

/** Stable identity for `<main>` minimum height to satisfy react-perf. */
const MAIN_STYLE = { minHeight: '1px' } as const

/** The banner wrapper draws no box of its own. */
const BANNER_STYLE = { display: 'contents' } as const

type PageComponent = Component | SimpleComponentReference | ComponentReference

/** Whether a page component renders as a `header` container, directly or through its template. */
function isBannerComponent(component: PageComponent, components: Components | undefined): boolean {
  const node = component as { readonly type?: unknown; readonly element?: unknown }
  if (typeof node.type === 'string') return node.type === 'container' && node.element === 'header'
  const name = (component as { readonly component?: unknown }).component
  const template = components?.find((candidate) => candidate.name === name) as
    { readonly type?: unknown; readonly element?: unknown } | undefined
  return template?.type === 'container' && template.element === 'header'
}

/** How many of the page's first components form its banner. */
function leadingBannerCount(
  pageComponents: ReadonlyArray<PageComponent>,
  components: Components | undefined
): number {
  const firstBody = pageComponents.findIndex((c) => !isBannerComponent(c, components))
  return firstBody === -1 ? pageComponents.length : firstBody
}

/**
 * Whether the page names its OWN main region: a `container` drawn as `main`
 * whose `id` is the skip target, anywhere in its tree (templates included). An
 * app shell does this when its sidebar and header share one layout with the
 * content, so only the content column can be the landmark.
 */
function declaresMainRegion(
  pageComponents: ReadonlyArray<PageComponent>,
  components: Components | undefined
): boolean {
  return someComponentInTree(
    pageComponents,
    components,
    (item) =>
      item.type === 'container' &&
      item.element === 'main' &&
      keyOf(componentField(item, 'props'), 'id') === MAIN_REGION_ID
  )
}

/**
 * The page's main landmark. `id="main-content"` + `tabIndex={-1}` make it the
 * skip-link target — activating the chrome skip link
 * moves focus here. Shared by both the component-only and markdown branches.
 *
 * When the page declares its own main region (`declaresMainRegion`), the
 * wrapper keeps its page markers but is drawn as a plain `div`: the page's
 * region is then the one landmark and the one skip target.
 */
function MainShell({
  page,
  ownRegion,
  children,
}: {
  readonly page: Page
  readonly ownRegion: boolean
  readonly children: React.ReactNode
}): Readonly<ReactElement> {
  const markers = {
    'data-testid': `page-${toSlug(page.name ?? page.path)}`,
    'data-page-name': page.name,
    'data-page-id': page.id,
    'data-sovrium-search-body': true,
    style: MAIN_STYLE,
  }
  if (ownRegion) return <div {...markers}>{children}</div>
  return (
    <main
      id={MAIN_REGION_ID}
      tabIndex={-1}
      {...markers}
    >
      {children}
    </main>
  )
}

/**
 * The page's leading header components, drawn before its main landmark.
 * `display: contents` keeps the header's own layout (a sticky header sticks to
 * the page) while the marker tells a content swap that the page holds chrome
 * outside its main region.
 */
function PageBanner({ children }: { readonly children: React.ReactNode }): Readonly<ReactElement> {
  return (
    <div
      data-page-banner=""
      style={BANNER_STYLE}
    >
      {children}
    </div>
  )
}

type PageMainProps = {
  readonly page: Page
  readonly pageComponents: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  /**
   * App-level `design` key, threaded on the same
   * channel as `design` so `design.components` reaches every rendered component.
   */
  readonly design?: Design
  readonly components?: Components
  readonly languages?: Languages
  readonly currentLang: string
  readonly tables?: Tables
  readonly buckets?: Buckets
  /** App-level `auth.landingPath`. */
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  readonly session?: SessionInfo
  /**
   * Resolved markdown payload for pages declaring `page.markdown`. When set, the article is rendered alongside
   * the regular component tree so the page composes both sources.
   */
  readonly markdownPayload?: ResolvedMarkdownPage
}

/**
 * Renders the main content area with page components.
 *
 * Composition: when a page declares both
 * `markdown` AND a `components:` array (the docs-site pattern), the markdown
 * article must sit BETWEEN the header chrome and the footer chrome — otherwise
 * a sticky navbar declared first in `components` would render after the
 * article (lands at the page bottom). To achieve `header → article → footer`
 * generically without per-app heuristics, we render the FIRST page component
 * (the header/navbar by convention) first, then the markdown article in the
 * main content slot, then the remaining components (overlays + footer). Pages
 * with no `components` array fall back to article-then-(empty) and
 * component-only pages (no markdown) render every component in order, so the
 * landing page and all non-markdown pages are unaffected.
 */
export function PageMain({
  page,
  pageComponents,
  design,
  components,
  languages,
  currentLang,
  tables,
  buckets,
  landingPath,
  routeParams,
  session,
  markdownPayload,
}: PageMainProps): Readonly<ReactElement> {
  const renderSections = (
    sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  ): Readonly<ReactElement> => (
    <SectionRenderer
      sections={sections}
      pageVars={page.vars}
      design={design}
      components={components}
      languages={languages}
      currentLang={currentLang}
      tables={tables}
      buckets={buckets}
      landingPath={landingPath}
      routeParams={routeParams}
      session={session}
    />
  )

  // A leading run of `header` components is the page's banner: it is drawn
  // BEFORE the main landmark, so the skip link lands past it and its navigation.
  const bannerCount = leadingBannerCount(pageComponents, components)
  const banner = pageComponents.slice(0, bannerCount)
  const body = pageComponents.slice(bannerCount)
  const bannerSlot =
    banner.length > 0 ? <PageBanner>{renderSections(banner)}</PageBanner> : undefined
  const shell = { page, ownRegion: declaresMainRegion(pageComponents, components) }

  // No markdown: render every component in declared order (landing + all
  // component-only pages).
  if (!markdownPayload) {
    return (
      <>
        {bannerSlot}
        <MainShell {...shell}>{renderSections(body)}</MainShell>
      </>
    )
  }

  // Markdown page: the header chrome (the banner, or else the first component,
  // by convention the navbar), then the article, then the trailing components
  // (overlays/footer).
  const headerSections = banner.length > 0 ? [] : body.slice(0, 1)
  const trailingSections = banner.length > 0 ? body : body.slice(1)
  return (
    <>
      {bannerSlot}
      <MainShell {...shell}>
        {headerSections.length > 0 && renderSections(headerSections)}
        <MarkdownArticle markdown={markdownPayload} />
        {trailingSections.length > 0 && renderSections(trailingSections)}
      </MainShell>
    </>
  )
}
