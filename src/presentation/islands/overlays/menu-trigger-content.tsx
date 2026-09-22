/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a menu's TRIGGER draws, and how it learns who is signed in.
 *
 * Split out of `menu-island.tsx` so that island file stays under the per-island
 * `max-lines` cap — and because the trigger
 * grew a second job when `dropdown-menu` became a container type: it now holds
 * composed children, and either they or a bound `triggerLabel` may name the
 * caller.
 */

import { MENU_TRIGGER_CONTENT_CLASSES, NavChevronDown } from '@/presentation/design/nav-menu-parts'
import type { ReactNode } from 'react'

/**
 * The trigger button content: composed node, raw HTML, or plain label.
 *
 * The label path adds a down-chevron affordance,
 * scoped to `triggerLabel !== undefined` — a `dropdown-menu` always carries a
 * `triggerLabel`, while the shared `context-menu` / rich-trigger
 * (`triggerContent` / `triggerHtml`) paths do NOT, so they keep no chevron.
 */
export function TriggerContent({
  triggerContent,
  triggerHtml,
  triggerChildrenHtml,
  triggerLabel,
  triggerLabelTemplate,
}: {
  readonly triggerContent?: ReactNode
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  /**
   * The trigger's COMPOSED content, serialized from the author's `children`.
   *
   * Distinct from {@link MenuIslandProps.triggerHtml}, which the shared
   * `context-menu` / rich-trigger paths use and which deliberately carries no
   * chevron: a composed `dropdown-menu` trigger is still a dropdown, so it
   * keeps the affordance that says so.
   */
  readonly triggerChildrenHtml?: string
  /**
   * The `$session.<field>` template a bound `triggerLabel` carries.
   *
   * The label itself ships EMPTY. Resolution is CLIENT-side, from the caller's
   * own session, so the served bytes name nobody and a cached page cannot leak
   * one caller to the next.
   */
  readonly triggerLabelTemplate?: string
}): ReactNode {
  if (triggerContent !== undefined) return triggerContent
  if (triggerChildrenHtml !== undefined) {
    return (
      <>
        <span
          className={MENU_TRIGGER_CONTENT_CLASSES}
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves the composed SSR trigger on initial paint
          dangerouslySetInnerHTML={{ __html: triggerChildrenHtml }}
        />
        <NavChevronDown />
      </>
    )
  }
  if (triggerHtml) {
    // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- preserves SSR trigger HTML on initial paint
    return <span dangerouslySetInnerHTML={{ __html: triggerHtml }} />
  }
  return (
    <>
      <span data-session-template={triggerLabelTemplate}>{triggerLabel ?? 'Menu'}</span>
      {triggerLabel !== undefined && <NavChevronDown />}
    </>
  )
}
