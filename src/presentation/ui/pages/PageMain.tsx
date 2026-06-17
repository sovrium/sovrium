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

const MAIN_STYLE = { minHeight: '1px' } as const

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
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  readonly session?: SessionInfo
  readonly markdownPayload?: ResolvedMarkdownPage
}

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

  if (!markdownPayload) {
    return <MainShell page={page}>{renderSections(pageComponents)}</MainShell>
  }

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
