/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  LIST_TEXT_COLUMN_CLASSES,
  computeListDividerClasses,
  computeListItemClasses,
  computeListMetaClasses,
  computeListShellClasses,
  computeListSubtitleClasses,
  computeListTitleClasses,
} from '@/presentation/design/list-default-classes'
import type { ListItemLayout, ListRowClasses } from '@/presentation/design/list-row-classes'

/**
 * `stacked` — the narrow-panel shape. The row wraps, the text column takes the
 * whole first line so the title can wrap uncut, and whatever follows (badge,
 * metadata) starts on the line below.
 */
const STACKED = {
  item: 'flex-wrap',
  textColumn: 'basis-full',
  title: 'overflow-visible text-clip whitespace-normal',
  subtitle: 'overflow-visible text-clip whitespace-normal',
} as const

/** The list's own `<ul>` merged with the `list` part, only when the author declared one. */
const listPart = (
  parts: Readonly<Record<string, string>> | undefined
): { readonly list?: string } =>
  parts?.['list'] === undefined ? {} : { list: cn(computeListShellClasses(), parts['list']) }

/**
 * The classes of a row's parts: the recipe, then the stacked layout when
 * declared, then the author's per-part classes (`design.components.list` under
 * the instance's own `classes`) — later wins. Resolved on the server, where the
 * class merger already is, and sent to the list island ready to use.
 *
 * @param input.itemLayout - `listDisplay.itemLayout`; `inline` when absent.
 * @param input.parts - The author's classes keyed by part (`item`, `title`, `subtitle`, `meta`).
 */
export const listRowClasses = ({
  itemLayout,
  parts,
}: {
  readonly itemLayout?: ListItemLayout
  readonly parts?: Readonly<Record<string, string>>
} = {}): ListRowClasses => {
  const stacked = itemLayout === 'stacked'
  return {
    item: cn(
      computeListItemClasses(),
      computeListDividerClasses(),
      stacked && STACKED.item,
      parts?.['item']
    ),
    textColumn: cn(LIST_TEXT_COLUMN_CLASSES, stacked && STACKED.textColumn),
    title: cn(computeListTitleClasses(), stacked && STACKED.title, parts?.['title']),
    subtitle: cn(computeListSubtitleClasses(), stacked && STACKED.subtitle, parts?.['subtitle']),
    meta: cn(computeListMetaClasses(), parts?.['meta']),
    ...listPart(parts),
  }
}

/**
 * The `rowClasses` island prop: present only when the list declares a stacked
 * layout or part classes, so an undeclared list serialises what it always did.
 *
 * @param itemLayout - `listDisplay.itemLayout`, as written.
 * @param parts - The resolved part classes, if any.
 */
export const declaredListRowClasses = (
  itemLayout: string | undefined,
  parts: Readonly<Record<string, string>> | undefined
): { readonly rowClasses?: ListRowClasses } => {
  const stacked = itemLayout === 'stacked'
  const hasParts = parts !== undefined && Object.keys(parts).length > 0
  if (!stacked && !hasParts) return {}
  return {
    rowClasses: listRowClasses({
      ...(stacked ? { itemLayout: 'stacked' as const } : {}),
      ...(hasParts ? { parts } : {}),
    }),
  }
}
