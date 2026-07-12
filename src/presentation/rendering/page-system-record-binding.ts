/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { substituteRecordInComponent } from '@/presentation/rendering/data-source-resolver'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

interface PageLevelDataSource {
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  readonly system?: SystemDetailSource
}

function buildPageSystemMarker(
  system: SystemDetailSource,
  routeParams: Readonly<Record<string, string>>
): Component {
  const paramName = system.param ?? 'id'
  const recordId = routeParams[paramName] ?? ''
  return {
    type: 'container',
    element: 'div',
    props: {
      'data-island': 'page-record-system',
      'data-island-props': JSON.stringify({ system, recordId }),
    },
  } as unknown as Component
}

function substitutePageComponents(
  components: Page['components'],
  record: Readonly<Record<string, unknown>>,
  tableName: string | undefined
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return substituteRecordInComponent(
      item as Component,
      record as Record<string, unknown>,
      tableName
    )
  })
}

export function applyPageLevelRecordBinding(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  hostRecord: Readonly<Record<string, unknown>> | undefined
): Page {
  const ds = page.dataSource as PageLevelDataSource | undefined
  if (ds?.system !== undefined) {
    const marker = buildPageSystemMarker(ds.system, routeParams)
    return { ...page, components: [...(page.components ?? []), marker] }
  }
  if (ds?.mode === 'single' && hostRecord !== undefined) {
    return { ...page, components: substitutePageComponents(page.components, hostRecord, ds.table) }
  }
  return page
}
