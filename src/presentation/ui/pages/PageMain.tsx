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
import type { RouteParams } from '@/domain/utils/route-matcher'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'

/** Stable identity for `<main>` minimum height to satisfy react-perf. */
const MAIN_STYLE = { minHeight: '1px' } as const

type PageMainProps = {
  readonly page: Page
  readonly pageComponents: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  readonly theme?: Theme
  readonly components?: Components
  readonly languages?: Languages
  readonly currentLang: string
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly routeParams?: RouteParams
  /**
   * Resolved markdown payload for pages declaring `page.markdown` (US-PAGES-
   * LAYOUT-MARKDOWN-PAGES-002). When set, the article is rendered alongside
   * the regular component tree so the page composes both sources.
   */
  readonly markdownPayload?: ResolvedMarkdownPage
}

/**
 * Renders the main content area with page components
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
  routeParams,
  markdownPayload,
}: PageMainProps): Readonly<ReactElement> {
  return (
    <main
      data-testid={`page-${toSlug(page.name ?? page.path)}`}
      data-page-name={page.name}
      data-page-id={page.id}
      style={MAIN_STYLE}
    >
      {markdownPayload && <MarkdownArticle markdown={markdownPayload} />}
      <SectionRenderer
        sections={pageComponents}
        pageVars={page.vars}
        theme={theme}
        components={components}
        languages={languages}
        currentLang={currentLang}
        tables={tables}
        buckets={buckets}
        routeParams={routeParams}
      />
    </main>
  )
}
