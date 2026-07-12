/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

function findElements(hostId: string): SplitPaneElements | undefined {
  const host = document.querySelector<HTMLElement>(`[data-split-pane="${hostId}"]`)
  if (!host) return undefined
  const first = host.querySelector<HTMLElement>('[data-split-pane-first]')
  const divider = host.querySelector<HTMLElement>('[data-split-pane-divider]')
  if (!first || !divider) return undefined
  return { host, first, divider }
}

function clampSize(size: number, total: number, min?: number, max?: number): number {
  const lower = typeof min === 'number' ? min : 0
  const upper = typeof max === 'number' ? max : total
  return Math.max(lower, Math.min(size, upper))
}

function wireResize(els: SplitPaneElements, props: SplitPaneIslandProps): () => void {
  const { host, first, divider } = els
  const horizontal = (props.orientation ?? 'horizontal') === 'horizontal'

  const onPointerMove = (event: PointerEvent): void => {
    const rect = host.getBoundingClientRect()
    const total = horizontal ? rect.width : rect.height
    const offset = horizontal ? event.clientX - rect.left : event.clientY - rect.top
    const next = clampSize(offset, total, props.minSize, props.maxSize)
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

export default function SplitPaneIsland(props: SplitPaneIslandProps): null {
  useEffect(() => {
    const els = findElements(props.hostId)
    if (!els) return undefined
    return wireResize(els, props)
  }, [props])
  return null
}
