/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getComponentInfo } from '@/presentation/translations/component-utils'
import { renderSectionWithSpacing } from '@/presentation/ui/pages/SectionSpacing'
import { ComponentRenderer } from '@/presentation/ui/sections/component-renderer'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Props for the SectionRenderer component
 */
export interface SectionRendererProps {
  readonly sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  readonly pageVars?: Record<string, string | number | boolean>
  readonly theme?: Theme
  readonly components?: Components
  readonly languages?: Languages
  readonly currentLang: string
}

/**
 * Render sections with theme spacing
 * Handles section wrapping, container spacing, and component resolution
 *
 * @param props - Component props
 * @returns React element with sections
 */
export function SectionRenderer({
  sections,
  pageVars,
  theme,
  components,
  languages,
  currentLang,
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
      />
    )
  })

  return renderSectionWithSpacing(theme, sections, renderedSections)
}
