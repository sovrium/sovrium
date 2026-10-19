/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { railFlag, sourcePayload, type SidebarI18n } from './sidebar-entry'
import { copy, DEFAULT_COLLAPSE_LABEL, DEFAULT_EXPAND_LABEL } from './sidebar-entry-copy'
import type { SidebarGroup } from '@/domain/models/app/pages/components/component-types/layout/sidebar'
import type { SidebarRailBreakpoint } from '@/presentation/design/sidebar-default-classes'

/** What the fetched half of a group needs from the sidebar around it. */
interface SourcedEntriesContext {
  readonly rail: SidebarRailBreakpoint | undefined
  readonly i18n: SidebarI18n
  readonly trackNavigation: boolean
}

/**
 * The second fetched level, as the island reads it: the children source with
 * its three lines and its two toggle names in the sidebar's language. Its
 * `query` keeps its `{field}` placeholders — they are filled in the browser,
 * from each parent row.
 */
const childrenSourcePayload = (
  childrenSource: NonNullable<NonNullable<SidebarGroup['source']>['childrenSource']>,
  i18n: SidebarI18n
): Record<string, unknown> => ({
  ...sourcePayload(childrenSource, i18n),
  expandLabel: copy(undefined, DEFAULT_EXPAND_LABEL, i18n),
  collapseLabel: copy(undefined, DEFAULT_COLLAPSE_LABEL, i18n),
})

/**
 * The island host for a group's FETCHED entries.
 *
 * Only the fetched half is islanded, and that is the whole design. The authored
 * entries above stay server-rendered, so they work without JavaScript, keep
 * their icons out of the client bundle, and — because an island REPLACES the
 * SSR children it mounts over — cannot be duplicated or dropped by the mount.
 * Document order then gives the spec's guarantee for free: authored first,
 * fetched after.
 *
 * The props carry only what the fetch needs. The endpoint has already had any
 * `:param` substituted server-side (`bindRouteParams`), so the island never
 * sees a route placeholder it could not resolve.
 *
 * `query` travels as its OWN prop rather than pre-appended to the endpoint here,
 * because that is the encoding every other system-source consumer already uses:
 * the KPI and chart reads hand `{ endpoint, query }` to `buildSystemQueryUrl`
 * and let one helper own the merge.
 *
 * `activeMatch` travels because the island marks its own rows: a fetched row is
 * matched against the address exactly like an authored entry, and the longest
 * matching href is the current one. `childrenSource` makes each row a
 * disclosure whose list the island fetches on first expand.
 */
export function renderSourcedEntries(
  source: NonNullable<SidebarGroup['source']>,
  label: string | undefined,
  { rail, i18n, trackNavigation }: SourcedEntriesContext
): ReactElement {
  return (
    <div
      data-island="sidebar-groups"
      data-island-props={JSON.stringify({
        endpoint: source.endpoint,
        // The row rules reach these rows from the navigation root; the TOOLTIP
        // cannot, because it is an attribute rather than a paint.
        ...railFlag(rail),
        rowsKey: source.rowsKey ?? 'items',
        labelKey: source.labelKey,
        hrefTemplate: source.hrefTemplate,
        ...(source.itemProps === undefined ? {} : { itemProps: source.itemProps }),
        ...(source.query === undefined ? {} : { query: source.query }),
        ...(source.activeMatch === undefined ? {} : { activeMatch: source.activeMatch }),
        ...(source.childrenSource === undefined
          ? {}
          : { childrenSource: childrenSourcePayload(source.childrenSource, i18n) }),
        ...(trackNavigation ? { track: true } : {}),
      })}
      // A label-less group names nothing, so this is the empty string rather
      // than `undefined`: React omits an undefined attribute entirely, which
      // would leave a FETCHED label-less group's island host with no addressing
      // hook at all.
      data-sidebar-source={label ?? ''}
    />
  )
}
