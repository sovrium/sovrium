/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { ComponentRenderer } from '@/presentation/render/elements/component-renderer'
import { getComponentInfo } from '@/presentation/render/i18n/component-utils'
import { renderSectionWithSpacing } from '@/presentation/render/page/section-spacing'
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
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Props for the SectionRenderer component
 */
export interface SectionRendererProps {
  readonly sections: ReadonlyArray<Component | SimpleComponentReference | ComponentReference>
  readonly pageVars?: Record<string, string | number | boolean>
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
}

/**
 * Render sections with design spacing
 * Handles section wrapping, container spacing, and component resolution
 *
 * @param props - Component props
 * @returns React element with sections
 */
export function SectionRenderer({
  sections,
  pageVars,
  design,
  components,
  languages,
  currentLang,
  tables,
  buckets,
  landingPath,
  routeParams,
  session,
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
        design={design}
        languages={languages}
        currentLang={currentLang}
        tables={tables}
        buckets={buckets}
        landingPath={landingPath}
        routeParams={routeParams}
        session={session}
      />
    )
  })

  return renderSectionWithSpacing(design, sections, renderedSections)
}
