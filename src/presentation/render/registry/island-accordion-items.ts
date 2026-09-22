/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { localizeChildLabel } from './island-child-label'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Map an accordion component's `children` array to the `items` shape consumed
 * by AccordionIsland. Each child is expected to be a `container` with `props.id`
 * and `content.{title, body}`. Children with missing or empty `id` are skipped.
 *
 * `title` is localized here for the same reason tab labels are — see
 * {@link localizeChildLabel}. The accordion header is a caption read by a human,
 * so an unresolved `$t:` reference is visible misinformation, not a silent no-op.
 */
export function buildAccordionItems(
  rawChildren: unknown,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReadonlyArray<{
  readonly id: string
  readonly title: string
  readonly content: string
}> {
  const children = (Array.isArray(rawChildren) ? rawChildren : []) as ReadonlyArray<{
    readonly type?: string
    readonly props?: { readonly id?: string }
    readonly content?: { readonly title?: string; readonly body?: string } | string
  }>
  return children
    .map((child) => {
      const itemContent = typeof child.content === 'object' ? child.content : undefined
      return {
        id: child.props?.id ?? '',
        title: localizeChildLabel(itemContent?.title ?? '', currentLang, languages),
        content: itemContent?.body ?? '',
      }
    })
    .filter((item) => item.id !== '')
}
