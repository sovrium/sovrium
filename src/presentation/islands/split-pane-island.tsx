/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `split-pane` enhancement island
 *.
 *
 * A pure side-effect island: it renders NOTHING and instead wires
 * pointer-drag resizing onto the STATIC split-pane structure the SSR renderer
 * already emitted (located by `data-split-pane="<hostId>"`). Because it never
 * re-renders the panes, the nested islands inside each pane (the config
 * editor, the live preview) survive hydration untouched — the drag is
 * progressive enhancement layered on top of the server-rendered fallback.
 *
 * Dragging the `role="separator"` divider adjusts the first pane's flex-basis
 * (width for `horizontal`, height for `vertical`) within the configured
 * `minSize`/`maxSize` constraints; the second pane fills the remainder.
 */

import { useEffect } from 'react'

interface SplitPaneIslandProps {
  readonly hostId: string
  readonly orientation?: 'horizontal' | 'vertical'
  readonly minSize?: number
  readonly maxSize?: number
}

interface SplitPaneElements {
  readonly host: HTMLElement
  readonly first: HTMLElement
  readonly divider: HTMLElement
}

/** Locate the SSR-rendered split-pane structure for `hostId`. */
function findElements(hostId: string): SplitPaneElements | undefined {
  const host = document.querySelector<HTMLElement>(`[data-split-pane="${hostId}"]`)
  if (!host) return undefined
  const first = host.querySelector<HTMLElement>('[data-split-pane-first]')
  const divider = host.querySelector<HTMLElement>('[data-split-pane-divider]')
  if (!first || !divider) return undefined
  return { host, first, divider }
}

/** Clamp a candidate first-pane size to the configured min/max bounds. */
function clampSize(size: number, total: number, min?: number, max?: number): number {
  const lower = typeof min === 'number' ? min : 0
  const upper = typeof max === 'number' ? max : total
  return Math.max(lower, Math.min(size, upper))
}

/**
 * Wire pointer-drag resizing onto the static structure. Returns the cleanup
 * function that removes every listener it attached.
 */
function wireResize(els: SplitPaneElements, props: SplitPaneIslandProps): () => void {
  const { host, first, divider } = els
  const horizontal = (props.orientation ?? 'horizontal') === 'horizontal'

  const onPointerMove = (event: PointerEvent): void => {
    const rect = host.getBoundingClientRect()
    const total = horizontal ? rect.width : rect.height
    const offset = horizontal ? event.clientX - rect.left : event.clientY - rect.top
    const next = clampSize(offset, total, props.minSize, props.maxSize)
    // eslint-disable-next-line functional/immutable-data -- DOM resize is the contract here
    first.style.flexBasis = `${next}px`
  }

  const onPointerUp = (event: PointerEvent): void => {
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    if (divider.hasPointerCapture(event.pointerId)) {
      divider.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    divider.setPointerCapture(event.pointerId)
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  divider.addEventListener('pointerdown', onPointerDown)
  return () => {
    divider.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
  }
}

/**
 * Split-pane island — renders nothing; enhances the SSR structure in place.
 */
export default function SplitPaneIsland(props: SplitPaneIslandProps): null {
  useEffect(() => {
    const els = findElements(props.hostId)
    if (!els) return undefined
    return wireResize(els, props)
  }, [props])
  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  return null
}
