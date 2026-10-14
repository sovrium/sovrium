/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `resizable` island: two panels and the handle between them, through
 * react-resizable-panels (`parts/resizable-primitives`, shadcn's `resizable`).
 *
 * The server draws the two panes as a static split, and whatever they hold
 * (nested islands included) mounts there first. This island then takes the
 * split over: it renders the panel group into the host and MOVES each pane's
 * nodes into its panel, then hides the static split. Moving, not copying, is
 * what keeps a nested island alive: its React root stays attached to the same
 * element, wherever that element now sits.
 *
 * Sizes are the author's: `defaultRatio` is the first panel's share, and
 * `minSize` / `maxSize` bound the first panel in pixels, as they always have.
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../parts/resizable-primitives'

interface ResizableIslandProps {
  readonly hostId: string
  readonly orientation?: 'horizontal' | 'vertical'
  readonly ratio?: number
  readonly minSize?: number
  readonly maxSize?: number
  readonly separatorLabel?: string
}

/** The server-drawn split this island takes over. */
interface StaticSplit {
  readonly host: HTMLElement
  readonly first: HTMLElement
  readonly second: HTMLElement
  readonly divider: HTMLElement
}

function findSplit(hostId: string): StaticSplit | undefined {
  const host = document.querySelector<HTMLElement>(`[data-split-pane="${hostId}"]`)
  const first = host?.querySelector<HTMLElement>(':scope > [data-split-pane-first]')
  const second = host?.querySelector<HTMLElement>(':scope > [data-split-pane-second]')
  const divider = host?.querySelector<HTMLElement>(':scope > [data-split-pane-divider]')
  if (!host || !first || !second || !divider) return undefined
  return { host, first, second, divider }
}

/** A panel's content box, which adopts the static pane's nodes once it exists. */
function AdoptedPane({ source }: { readonly source: HTMLElement }): ReactElement {
  const adopt = useCallback(
    (target: HTMLDivElement | null) => {
      if (target === null || source.childNodes.length === 0) return
      target.append(...Array.from(source.childNodes))
    },
    [source]
  )
  return (
    <div
      ref={adopt}
      className="size-full min-h-0 min-w-0 overflow-auto"
    />
  )
}

export default function ResizableIsland({
  hostId,
  orientation = 'horizontal',
  ratio = 0.5,
  minSize,
  maxSize,
  separatorLabel = 'Resize panels',
}: ResizableIslandProps): ReactElement | null {
  const [split, setSplit] = useState<StaticSplit | undefined>(undefined)
  useEffect(() => setSplit(findSplit(hostId)), [hostId])
  useEffect(() => {
    if (split === undefined) return
    // The static split stays in the document (empty) so the host keeps its own
    // attributes; only the live group is shown.
    split.first.hidden = true
    split.second.hidden = true
    split.divider.hidden = true
  }, [split])
  if (split === undefined) return null
  return createPortal(
    <ResizablePanelGroup orientation={orientation}>
      <ResizablePanel
        defaultSize={`${Math.round(ratio * 100)}%`}
        minSize={minSize}
        maxSize={maxSize}
      >
        <AdoptedPane source={split.first} />
      </ResizablePanel>
      <ResizableHandle
        withHandle
        aria-label={separatorLabel}
      />
      <ResizablePanel>
        <AdoptedPane source={split.second} />
      </ResizablePanel>
    </ResizablePanelGroup>,
    split.host
  )
}
