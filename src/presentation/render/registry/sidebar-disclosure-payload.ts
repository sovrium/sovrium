/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import { CURRENT_ENTRY_KEY } from '@/presentation/render/resolve/sidebar-current-resolver'
import { resolveChildTranslation } from '../i18n/translation-handler'
import type { SidebarI18n } from './sidebar-entry'
import type {
  SidebarLeafItem,
  SidebarSubItem,
} from '@/domain/models/app/pages/components/component-types/layout/sidebar'

/** A leaf or sub-entry as the island will re-render it: labels resolved, icon as geometry. */
export function toIslandChild(
  child: SidebarSubItem | SidebarLeafItem,
  i18n: SidebarI18n
): Record<string, unknown> {
  const nested = (child as SidebarSubItem).children
  return {
    label: resolveChildTranslation(child.label, i18n.currentLang, i18n.languages),
    href: child.href,
    activeMatch: child.activeMatch ?? 'exact',
    // Resolved HERE, where the icon set is already in the binary. Handing the
    // island a NAME instead would make it reach `lucide-resolver`, whose
    // namespace import is unshakeable and costs the browser 668 KB.
    ...(child.icon === undefined ? {} : { iconNode: resolveLucideIconNode(child.icon) }),
    ...(child.props === undefined ? {} : { props: child.props }),
    // The row's marker, carried through hydration for the same reason
    // `subItems` below is. `badge` is on the entry bag every level spreads, so a
    // row at ANY depth may declare one — and every one of those rows is redrawn
    // by the island. Both branches travel: the literal because the island writes
    // it, and the endpoint because the island mounts the count itself. Kept in
    // the schema's own shape rather than normalised, so the island's two
    // branches read as the server's two do.
    ...(child.badge === undefined ? {} : { badge: child.badge }),
    // The third level, carried through hydration. The level-2 disclosure IS an
    // island wherever a sidebar has one, so the island re-renders this list —
    // omit it here and the nested rows the server drew vanish the moment the
    // chunk lands, which is the worst of the three possible bugs: correct
    // without JavaScript and broken with it.
    //
    // Named `subItems` and never `children`, for the reason the disclosure's own
    // payload gives: island props are spread onto the component, and React
    // would read a `children` key as the element's own children.
    ...(nested === undefined ? {} : { subItems: nested.map((leaf) => toIslandChild(leaf, i18n)) }),
    ...((child as SidebarSubItem).childrenProps === undefined
      ? {}
      : { childrenProps: (child as SidebarSubItem).childrenProps }),
    current: (child as Record<string, unknown>)[CURRENT_ENTRY_KEY] === true,
  }
}
