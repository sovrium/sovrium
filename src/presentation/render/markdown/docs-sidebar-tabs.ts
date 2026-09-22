/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Docs navigation tabs (zones) — resolution helpers over the tabs an APP
 * declares in `contentDir.nav.tabs`.
 *
 * The engine ships NO information architecture of its own. This module used to
 * hardcode one app's IA (a closed `TabId` union plus `TAB_ORDER` /
 * `TAB_FOR_SECTION` / `TAB_LABELS` keyed by Sovrium-website section slugs), which
 * every docs-layout app inherited with no way to override. All of that now comes
 * from config; what remains here is the pure resolution logic:
 *
 *   - which tab owns a given `groupBy` section slug (unclaimed → the FIRST tab,
 *     so an IA gap never makes an article unreachable), and
 *   - a tab's display label (`label`, else the id humanized to Title Case —
 *     the same fallback `groupLabels` / `groupIcons` use).
 *
 * A tab's `id` is announced verbatim on the docs sidebar wrapper
 * (`data-docs-active-zone`); the app owns its own tab-strip markup and matches on
 * that value. The platform renders no tab strip itself.
 */
import { humanizeFieldName } from '@/presentation/design/string-utils'
import type { CollectionNavTabs } from '@/presentation/render/resolve/content-dir-lister'

/** A single declared docs tab (one element of `contentDir.nav.tabs`). */
export type DocsNavTab = CollectionNavTabs[number]

/**
 * Whether a collection declares a docs tab IA at all. Drives the zoned/untabbed
 * split: no tabs ⇒ the historical flat expanded sidebar, no zone announcement,
 * and the "Home" breadcrumb root.
 */
export const hasDocsTabs = (tabs: CollectionNavTabs | undefined): tabs is CollectionNavTabs =>
  tabs !== undefined && tabs.length > 0

/** Whether a section slug is claimed by ANY declared tab. */
export const sectionIsClaimed = (name: string | undefined, tabs: CollectionNavTabs): boolean =>
  name !== undefined && tabs.some((tab) => tab.sections.includes(name))

/**
 * Resolve the tab owning a section slug. An unclaimed (or absent) section falls
 * back to the FIRST declared tab — the schema's "never dropped" guarantee.
 * Returns `undefined` only for an empty tab list.
 */
export const tabOfSection = (
  name: string | undefined,
  tabs: CollectionNavTabs
): DocsNavTab | undefined => {
  const owner = name === undefined ? undefined : tabs.find((tab) => tab.sections.includes(name))
  return owner ?? tabs[0]
}

/**
 * A tab's display label: the configured `label` (supplied ALREADY LOCALISED per
 * locale, the `groupLabels` convention), else the id humanized to Title Case
 * ("api-reference" → "Api Reference").
 */
export const getTabLabel = (tab: DocsNavTab): string => tab.label ?? humanizeFieldName(tab.id)
