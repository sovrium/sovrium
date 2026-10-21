/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { exportNodeIdOf } from '@/domain/models/app/pages/node-identity'
import type { ReactElement } from 'react'

const PULSE_WIDE = 'bg-muted h-5 w-48 animate-pulse rounded'
const PULSE_NARROW = 'bg-muted h-5 w-40 animate-pulse rounded'

/** The accordion children that become items: the ones carrying a non-empty `props.id`. */
const itemChildrenOf = (rawChildren: unknown): readonly unknown[] =>
  (Array.isArray(rawChildren) ? (rawChildren as readonly unknown[]) : []).filter((child) => {
    const id = (child as { readonly props?: { readonly id?: unknown } } | null)?.props?.id
    return typeof id === 'string' && id !== ''
  })

/**
 * The accordion's placeholder until its island mounts: one pulsing header row
 * per item, as `buildAccordionItems` selects them. A page export's copy of an
 * item carries its node id, so each row stamps the item it stands for — the
 * island draws the items from data, so this row is the only element they get.
 */
export function AccordionSkeleton({
  rawChildren,
}: {
  readonly rawChildren: unknown
}): ReactElement {
  return (
    <div className="divide-border border-border divide-y rounded-lg border">
      {itemChildrenOf(rawChildren).map((child, index) => (
        <div
          key={index}
          className="px-4 py-3"
          data-sovrium-id={exportNodeIdOf(child)}
        >
          <div className={index % 2 === 0 ? PULSE_WIDE : PULSE_NARROW} />
        </div>
      ))}
    </div>
  )
}
