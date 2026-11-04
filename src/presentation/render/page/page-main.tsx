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
import { resolveFrontmatterInComponents } from '@/presentation/render/resolve/frontmatter-components-resolver'
import { withSigningPage } from '@/presentation/render/resolve/signing-page-stamp'
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

/** The banner and footer wrappers draw no box of their own. */
const CHROME_STYLE = { display: 'contents' } as const

type PageComponent = Component | SimpleComponentReference | ComponentReference

type PageSections = ReadonlyArray<PageComponent>

/** The fields of a component, or of the template a reference places, that say what it draws. */
function drawnNode(
  component: PageComponent,
  components: Components | undefined
): { readonly type?: unknown; readonly element?: unknown } | undefined {
  const node = component as { readonly type?: unknown; readonly element?: unknown }
  if (typeof node.type === 'string') return node
  const name = (component as { readonly component?: unknown }).component
  return components?.find((candidate) => candidate.name === name) as
    { readonly type?: unknown; readonly element?: unknown } | undefined
}

/** Whether a page component renders as a container drawn as `element`, directly or through its template. */
function isContainerDrawnAs(
  component: PageComponent,
  components: Components | undefined,
  element: 'header' | 'footer'
): boolean {
  const node = drawnNode(component, components)
  return node?.type === 'container' && node.element === element
}

/** Component types drawn above the page wherever they are declared: they never hold a footer in place. */
const OVERLAY_TYPES: ReadonlySet<unknown> = new Set([
  'dialog',
  'alert-dialog',
  'sheet',
  'drawer',
  'bottom-drawer',
  'record-drawer',
  'toast',
  // The ⌘K palette the engine places on every page, a dialog until it opens.
  'command',
])

/** How many of the page's first components form its banner. */
function leadingBannerCount(
  pageComponents: ReadonlyArray<PageComponent>,
  components: Components | undefined
): number {
  const firstBody = pageComponents.findIndex((c) => !isContainerDrawnAs(c, components, 'header'))
  return firstBody === -1 ? pageComponents.length : firstBody
}

/**
 * Split off the page's closing footer: the trailing run of `footer`
 * containers, ignoring the overlays declared after it, which stay where they
 * are. A footer followed by any other component is part of the content and
 * stays in place.
 */
function splitTrailingFooter(
  body: PageSections,
  components: Components | undefined
): { readonly content: PageSections; readonly footer: PageSections } {
  const overlaysFrom =
    body.findLastIndex((c) => !OVERLAY_TYPES.has(drawnNode(c, components)?.type)) + 1
  const footerFrom =
    body.slice(0, overlaysFrom).findLastIndex((c) => !isContainerDrawnAs(c, components, 'footer')) +
    1
  return {
    content: [...body.slice(0, footerFrom), ...body.slice(overlaysFrom)],
    footer: body.slice(footerFrom, overlaysFrom),
  }
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
 * The page's chrome drawn outside its main landmark: the leading header
 * components before it (`banner`), the closing footer after it (`footer`).
 * `display: contents` keeps their own layout (a sticky header sticks to the
 * page) while the marker tells a content swap that the page holds chrome
 * outside its main region.
 */
function PageChrome({
  edge,
  children,
}: {
  readonly edge: 'banner' | 'footer'
  readonly children: React.ReactNode
}): Readonly<ReactElement> {
  const marker = edge === 'banner' ? { 'data-page-banner': '' } : { 'data-page-footer': '' }
  return (
    <div
      {...marker}
      style={CHROME_STYLE}
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
/** The renderer of a run of the page's components, with everything the page threads to them. */
function sectionsRenderer(
  props: PageMainProps
): (sections: PageSections) => Readonly<ReactElement> {
  const { page, components } = props
  // A pad inside a component template is stamped too: it is drawn on this page once placed.
  const templates = components === undefined ? undefined : withSigningPage(components, page.name)
  const renderSections = (sections: PageSections): Readonly<ReactElement> => (
    <SectionRenderer
      sections={withSigningPage(sections, page.name)}
      pageVars={page.vars}
      design={props.design}
      components={templates}
      languages={props.languages}
      currentLang={props.currentLang}
      tables={props.tables}
      buckets={props.buckets}
      landingPath={props.landingPath}
      routeParams={props.routeParams}
      session={props.session}
    />
  )
  return renderSections
}

export function PageMain(props: PageMainProps): Readonly<ReactElement> {
  const { page, components, languages, markdownPayload } = props
  const renderSections = sectionsRenderer(props)
  // An article's page shows its front matter: `$frontmatter.<key>` in its components.
  const pageComponents =
    markdownPayload === undefined
      ? props.pageComponents
      : resolveFrontmatterInComponents(props.pageComponents, markdownPayload.frontmatter)

  // A leading run of `header` components is the page's banner: it is drawn
  // BEFORE the main landmark, so the skip link lands past it and its navigation.
  // A closing run of `footer` components is drawn AFTER it, as the page's
  // contentinfo — unless the page names its own main region and keeps its order.
  const bannerCount = leadingBannerCount(pageComponents, components)
  const banner = pageComponents.slice(0, bannerCount)
  const ownRegion = declaresMainRegion(pageComponents, components)
  const shell = { page, ownRegion }
  const chrome = (edge: 'banner' | 'footer', sections: PageSections) =>
    sections.length > 0 ? (
      <PageChrome edge={edge}>{renderSections(sections)}</PageChrome>
    ) : undefined
  const split = ownRegion
    ? { content: pageComponents.slice(bannerCount), footer: [] }
    : splitTrailingFooter(pageComponents.slice(bannerCount), components)
  const body = split.content

  // No markdown: render every component in declared order (landing + all
  // component-only pages).
  if (!markdownPayload) {
    return (
      <>
        {chrome('banner', banner)}
        <MainShell {...shell}>{renderSections(body)}</MainShell>
        {chrome('footer', split.footer)}
      </>
    )
  }

  // Markdown page: the header chrome (the banner, or else the first component,
  // by convention the navbar), then the article, then the trailing components
  // (overlays, and a footer followed by content).
  const headerSections = banner.length > 0 ? [] : body.slice(0, 1)
  const trailingSections = banner.length > 0 ? body : body.slice(1)
  return (
    <>
      {chrome('banner', banner)}
      <MainShell {...shell}>
        {headerSections.length > 0 && renderSections(headerSections)}
        <MarkdownArticle
          markdown={markdownPayload}
          languages={languages}
        />
        {trailingSections.length > 0 && renderSections(trailingSections)}
      </MainShell>
      {chrome('footer', split.footer)}
    </>
  )
}
