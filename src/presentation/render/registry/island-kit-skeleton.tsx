/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import type { ReactElement } from 'react'

/**
 * The placeholder every kit-addition island renders until its chunk arrives.
 *
 * ─── WHY IT HAS A HEIGHT ───────────────────────────────────────────────────
 *
 * It reserves the box the island will claim, so a page carrying one settles
 * ONCE instead of twice. The height is per-call because the four islands claim
 * very different boxes — a trigger button against a six-line editor — and a
 * code editor's is the author's own `minLines`, so it cannot be a class.
 *
 * ─── AND WHY IT IS NEVER WRITABLE ──────────────────────────────────────────
 *
 * No `<textarea>`, no editable region, no submit control. The editors are
 * asserted to have no write path before they mount, and a skeleton that shipped
 * one would put a live control on the page for as long as the chunk takes to
 * arrive — accepting keystrokes that the mounting island then discards.
 * `aria-busy` says the same thing to a reader who is not looking at it.
 *
 * ─── AND WHY IT LIVES IN ITS OWN FILE ──────────────────────────────────────
 *
 * `island-kit-components.tsx` exports a renderer MAP, not components. A React
 * component declared beside it makes the module a mixed export, which costs
 * fast refresh for the whole file. `data-table-skeleton.tsx` is the same
 * separation for the same reason.
 */
export function IslandSkeleton({
  label,
  minHeight,
  mono,
}: {
  readonly label?: string
  readonly minHeight: string
  readonly mono?: boolean
}): ReactElement {
  // Memoized so the reserved box is one stable object rather than a fresh one
  // per render — `style` is the one prop here that cannot be a class.
  const style = useMemo(() => ({ minHeight }), [minHeight])
  return (
    <>
      {label === undefined ? undefined : <span className="text-md block font-medium">{label}</span>}
      <div
        role="status"
        aria-busy="true"
        className={
          mono === true
            ? 'text-foreground-subtle border-border overflow-hidden rounded border p-3 font-mono'
            : 'text-foreground-subtle border-border overflow-hidden rounded border p-3'
        }
        style={style}
      />
    </>
  )
}
