/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The map frame's own chrome — the zoom pair and the corner line naming the
 * tiles — and the words the map draws itself (`map.*`), resolved on the server
 * in the page language and sent only where they differ from English.
 */

import { type ReactElement } from 'react'
import { computeVerticalButtonGroupClasses } from '@/presentation/design/button-group-default-classes'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'

/** The map's words in the page language, where they differ from English. */
export type MapWords = Readonly<Record<string, string>>

/** A zoom control: base-nova's outline `icon-sm` button. */
const CONTROL = computePartButtonClasses({ variant: 'outline', size: 'icon-sm' })

/** The zoom pair: a vertical button group in the frame's corner. */
const ZOOM_GROUP = `absolute bottom-3 left-3 ${computeVerticalButtonGroupClasses()}`

/** The zoom controls, the keyboard's way to change the scale. */
export function ZoomControls({
  onZoom,
  words,
}: {
  readonly onZoom: (step: number) => void
  readonly words: MapWords | undefined
}): ReactElement {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation="vertical"
      className={ZOOM_GROUP}
    >
      <button
        type="button"
        aria-label={words?.['map.zoomIn'] ?? 'Zoom in'}
        data-slot="button"
        data-variant="outline"
        data-size="icon-sm"
        className={CONTROL}
        onClick={() => onZoom(1)}
      >
        +
      </button>
      <button
        type="button"
        aria-label={words?.['map.zoomOut'] ?? 'Zoom out'}
        data-slot="button"
        data-variant="outline"
        data-size="icon-sm"
        className={CONTROL}
        onClick={() => onZoom(-1)}
      >
        −
      </button>
    </div>
  )
}
