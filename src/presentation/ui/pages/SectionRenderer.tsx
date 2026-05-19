/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getComponentInfo } from '@/presentation/translations/component-utils'
import { renderSectionWithSpacing } from '@/presentation/ui/pages/SectionSpacing'
import { ComponentRenderer } from '@/presentation/ui/sections/component-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { RouteParams } from '@/domain/utils/route-matcher'

export interface SectionRendererProps {
  readonly sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  readonly pageVars?: Record<string, string | number | boolean>
  readonly theme?: Theme
  readonly components?: Components
  readonly languages?: Languages
  readonly currentLang: string
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly routeParams?: RouteParams
}

export function SectionRenderer({
  sections,
  pageVars,
  theme,
  components,
  languages,
  currentLang,
  tables,
  buckets,
  routeParams,
}: SectionRendererProps): Readonly<ReactElement> {
  const renderedSections = sections.map((section, index) => {
    const componentInfo = getComponentInfo(section, index, sections)

    return (
      <ComponentRenderer
        key={index}
        component={section}
        pageVars={pageVars}
        componentName={componentInfo?.name}
        componentInstanceIndex={componentInfo?.instanceIndex}
        components={components}
        theme={theme}
        languages={languages}
        currentLang={currentLang}
        tables={tables}
        buckets={buckets}
        routeParams={routeParams}
      />
    )
  })

  return renderSectionWithSpacing(theme, sections, renderedSections)
}
