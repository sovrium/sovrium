/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A specimen re-rendered in a document of its own at a declared width — the
 * `<iframe>`, the box it is scaled into, and the root that gives that box the
 * column's width. Split from `design-components.tsx`, which draws the
 * specimen; this draws only its frame.
 */

import { componentFrameHref } from '@/domain/models/app/admin/mount-hrefs'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReactElement } from 'react'

/**
 * The declared viewport width, when this specimen asked to be re-rendered in a
 * document of its own.
 *
 * Read defensively rather than through the schema type: a renderer is reached
 * by synthesized nodes as well as decoded ones, and a width that is not a
 * positive number draws the ordinary inline specimen rather than a frame of
 * nonsense size.
 */
export const declaredViewportWidth = (component: Component | undefined): number | undefined => {
  const viewport = (component as { readonly viewport?: unknown } | undefined)?.viewport
  if (typeof viewport !== 'object' || viewport === null) return undefined
  const { width } = viewport as { readonly width?: unknown }
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : undefined
}

/**
 * The stage of a FRAMED specimen: the subject re-rendered in its own document.
 *
 * ─── WHY AN `<iframe>` AND NOT A NARROWER BOX ──────────────────────────────
 *
 * A `@media` query has exactly one input — the viewport — and nothing inside a
 * document can change it. Drawing the subject into a 375px-wide `div` on the
 * console page narrows the markup while every breakpoint keeps answering the
 * reader's window, so the component squeezes sideways and overflows instead of
 * collapsing to the layout it actually has at 375. A document boundary is the
 * only thing that gives the subject a viewport of its own.
 *
 * ─── THE THREE ATTRIBUTES THAT ARE NOT DECORATION ──────────────────────────
 *
 *  - **`width` as an attribute AND a style, with NO `maxWidth`.** The width IS
 *    the claim: a `maxWidth: '100%'` would shrink a 1280 frame to the console
 *    column and leave the heading above it saying 1280 about a document that is
 *    854. The declared number reaches the document or the frame is a lie. What
 *    fits it to the column is a SCALE, applied by the framed document itself
 *    inside the `data-specimen-scale-box` wrapper, so the document keeps its
 *    width and the reader sees all of it.
 *  - **`title`.** An `<iframe>` is an embedded browsing context and needs an
 *    accessible name; without one a screen-reader user meets three unlabelled
 *    frames in a row.
 *  - **`loading="lazy"`** (eco R2). Not asserted by any criterion, deliberately:
 *    these frames are short and sit above the fold at an ordinary window
 *    height, so "it did not load until scrolled" is unobservable here and a
 *    test for it could not fail.
 *
 * `display: block` removes the inline baseline gap an `<iframe>` otherwise sits
 * on, which would show as a few stray pixels under a frame sized exactly to its
 * content. No `sandbox`: without `allow-same-origin` the frame gets an opaque
 * origin and loses the one property that matters — a same-origin document that
 * can read the console's resolved scheme and size its own frame. With
 * `allow-same-origin allow-scripts` it would be equivalent to no sandbox at
 * all. What actually bounds the document is `frame-ancestors 'self'`, set by
 * the route that serves it.
 *
 * The HEIGHT is not set here. The framed document measures itself and grows its
 * own frame, because it is the only party that knows how tall it is — see
 * `application/use-cases/admin/design-system-component-frame.ts`.
 */
const frameStyle = (width: number): Record<string, string> => ({
  width: `${width}px`,
  display: 'block',
  border: '0',
  transformOrigin: '0 0',
})

/**
 * The box a frame is scaled into: the column's width, its height set by the
 * framed document to the SCALED height, and nothing outside it painted — the
 * transform shrinks what is drawn, not the layout box it came from.
 */
const SCALE_BOX_STYLE: Record<string, string> = { width: '100%', overflow: 'hidden' }

export const specimenFrame = (name: string, width: number): ReactElement => (
  <div
    data-specimen-scale-box=""
    style={SCALE_BOX_STYLE}
  >
    <iframe
      src={componentFrameHref(name)}
      title={`${name} at ${width}px`}
      width={width}
      loading="lazy"
      data-design-viewport-document={name}
      style={frameStyle(width)}
    />
  </div>
)

/**
 * A FRAMED specimen's root is a block as wide as its column. The specimen root
 * is otherwise `inline-block`, which shrink-wraps its content: around a 1280px
 * frame that made the scale box 1280px wide too, so the frame measured all the
 * room it needed and was never scaled to the column.
 */
export const framedRootProps = (
  props: Readonly<Record<string, unknown>>,
  component: Component | undefined,
  drawn: Component | undefined
): Readonly<Record<string, unknown>> => {
  if (drawn === undefined || declaredViewportWidth(component) === undefined) return props
  const style = (props['style'] ?? {}) as Readonly<Record<string, unknown>>
  return { ...props, style: { ...style, display: 'block', width: '100%' } }
}
