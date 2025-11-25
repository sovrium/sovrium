/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { SectionRenderer } from '@/presentation/components/pages/SectionRenderer'
import { toSlug } from '@/presentation/utilities/string-utils'
import type {
  BlockReference,
  SimpleBlockReference,
} from '@/domain/models/app/block/common/block-reference'
import type { Blocks } from '@/domain/models/app/blocks'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/page/sections'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

type PageMainProps = {
  readonly page: Page
  readonly sections: ReadonlyArray<Component | SimpleBlockReference | BlockReference>
  readonly theme?: Theme
  readonly blocks?: Blocks
  readonly languages?: Languages
  readonly currentLang: string
}

/**
 * Renders the main content area with page sections
 */
export function PageMain({
  page,
  sections,
  theme,
  blocks,
  languages,
  currentLang,
}: PageMainProps): Readonly<ReactElement> {
  return (
    <main
      data-testid={`page-${toSlug(page.name ?? page.path)}`}
      data-page-name={page.name}
      data-page-id={page.id}
      style={{ minHeight: '1px' }}
    >
      <SectionRenderer
        sections={sections}
        pageVars={page.vars}
        theme={theme}
        blocks={blocks}
        languages={languages}
        currentLang={currentLang}
      />
    </main>
  )
}
