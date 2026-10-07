/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { HEADER_HEIGHT } from '@/presentation/islands/graph/graph-layout'

/**
 * The lanes drawing's fixed geometry: glyph size and offsets, text baselines,
 * connector length and the heading class.
 */

/** Edge opacity at rest, as the layered drawing uses — see its note on bundling. */
export const EDGE_OPACITY = 0.35

/** The kind glyph's radius, and the centre of the 18px box the oracle reserves. */
export const GLYPH_RADIUS = 7
export const GLYPH_CX = 17
export const GLYPH_DY = 20

/** Where the gutter's two lines of text start, and their baselines. */
export const GUTTER_TEXT_X = 34
export const NAME_DY = 18
export const DETAIL_DY = 31

/** The state word's baseline inside its lane. */
export const STATE_DY = 24

/** The heading strip's baseline — the oracle's y=14, off the shared header. */
export const HEADING_DY = HEADER_HEIGHT - 12

/** The connector: a short rule, then a chevron landing on the next box's edge. */
export const CONNECTOR_LENGTH = 24

export const HEADING_CLASS = 'text-foreground-subtle text-[10px] font-medium tracking-wide'
