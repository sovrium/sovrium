/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { MarkdownArticle } from '@/presentation/ui/pages/MarkdownArticle'
import { SectionRenderer } from '@/presentation/ui/pages/SectionRenderer'
import { toSlug } from '@/presentation/utils/string-utils'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { SessionInfo } from '@/domain/types/session-info'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

/** Stable identity for `<main>` minimum height to satisfy react-perf. */
const MAIN_STYLE = { minHeight: '1px' } as const

/**
 * The page's main landmark. `id="main-content"` + `tabIndex={-1}` make it the
 * skip-link target — activating the chrome skip link
 * moves focus here. Shared by both the component-only and markdown branches.
 */
function MainShell({
  page,
  children,
}: {
  readonly page: Page
  readonly children: React.ReactNode
}): Readonly<ReactElement> {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-testid={`page-${toSlug(page.name ?? page.path)}`}
      data-page-name={page.name}
      data-page-id={page.id}
      data-sovrium-search-body
      style={MAIN_STYLE}
    >
      {children}
    </main>
  )
}

type PageMainProps = {
  readonly page: Page
  readonly pageComponents: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  readonly theme?: Theme
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
  theme,
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
      theme={theme}
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

  // No markdown: render every component in declared order (landing + all
  // component-only pages — unchanged behaviour).
  if (!markdownPayload) {
    return <MainShell page={page}>{renderSections(pageComponents)}</MainShell>
  }

  // Markdown page: render header chrome (the first component, by convention the
  // navbar), then the article, then the trailing components (overlays/footer).
  const headerSections = pageComponents.slice(0, 1)
  const trailingSections = pageComponents.slice(1)
  return (
    <MainShell page={page}>
      {headerSections.length > 0 && renderSections(headerSections)}
      <MarkdownArticle markdown={markdownPayload} />
      {trailingSections.length > 0 && renderSections(trailingSections)}
    </MainShell>
  )
}
