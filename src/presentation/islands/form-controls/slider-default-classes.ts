/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui slider (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `slider` component's parts, drawn on shadcn/ui's `Slider` anatomy
 * (base-nova): `data-slot="slider"` on the root, `slider-track`, `slider-range`
 * and `slider-thumb` on the parts. Every orientation rule reads Base UI's
 * `data-orientation`, so a horizontal slider fills its row.
 */

/** shadcn/ui `Slider` root. */
export const SLIDER_ROOT = 'data-horizontal:w-full data-vertical:h-full'

/** shadcn/ui `Slider` control, the box the track and thumbs sit in. */
export const SLIDER_CONTROL =
  'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col'

/** shadcn/ui `Slider` track. */
export const SLIDER_TRACK =
  'relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1'

/** shadcn/ui `Slider` range, the filled part of the track. */
export const SLIDER_RANGE = 'bg-primary select-none data-horizontal:h-full data-vertical:w-full'

/**
 * shadcn/ui `Slider` thumb. Filled with the background colour where shadcn
 * writes a literal white: the islands draw no literal colour, and on the light
 * theme the two are the same.
 */
export const SLIDER_THUMB =
  'relative block size-3 shrink-0 rounded-full border border-ring bg-background ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50'

/** The caption row above the slider: shadcn/ui `Label` and a muted value. */
export const SLIDER_LABEL = 'text-sm leading-none font-medium'
export const SLIDER_VALUE = 'text-sm text-muted-foreground'
