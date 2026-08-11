/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-level single-record `$record.*` distribution (CAP-2).
 *
 * A page-level `dataSource` binds the host PAGE itself to a single record, then
 * exposes it as `$record.*` to the page's descendant components. CAP-2 widens that
 * binding to a discriminated union:
 *  - `{ table, mode: 'single', param }` — the DB record is resolved SERVER-side
 *    (`resolvePageParentRecord` → `db.fetchSingleRecord`); this module substitutes
 *    its `$record.*` tokens into the page components server-side, so the page ships
 *    with the values already in the SSR HTML.
 *  - `{ system }` — the record lives behind an admin-guarded detail endpoint and
 *    cannot be resolved server-side; this module appends a `page-record-system`
 *    enhancer marker that fetches the detail CLIENT-side and distributes `$record.*`
 *    into the SSR page text nodes in place.
 *
 * Lives in its own module so `render-page.tsx` stays under the line cap and the
 * two-path contract is isolated.
 */

import { substituteRecordInComponent } from '@/presentation/rendering/data-source-resolver'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/** The loose shape of a page-level dataSource after the CAP-2 union widening. */
interface PageLevelDataSource {
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  readonly system?: SystemDetailSource
}

/**
 * The empty `page-record-system` enhancer marker appended to a system-bound page.
 * Carries the detail-endpoint binding plus the route param value injected into the
 * `:param` slot; the island fetches the record and distributes `$record.*` into the
 * page's SSR text nodes. Mirrors the admin run-detail pane's `data-island` container.
 */
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

/** Substitute `$record.*` into every top-level page component using the record. */
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

/**
 * Apply a page-level single-record binding to a page before component filters run.
 *
 * - `{ system }` → append the client-side `page-record-system` enhancer marker.
 * - `{ table, mode: 'single', param }` (with `hostRecord` already resolved) →
 *   substitute `$record.*` into the page components server-side.
 *
 * Any other page (no page-level dataSource, list/search mode, or a collection page
 * whose record was substituted by `resolveCollectionPage`) passes through unchanged.
 */
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
