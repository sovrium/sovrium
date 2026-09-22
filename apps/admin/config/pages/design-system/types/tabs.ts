/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `tabs` — one surface, several views of it.
//
// All three are the real component. The first two differ only in how the
// selected trigger is marked, which is a theme decision rather than a key — so
// they are drawn with the same config and read differently, and the page says
// so rather than inventing a variant name the schema does not have.
//
// ─── EACH DRAWING SITS IN A BOX OF ITS OWN, AND THAT IS THE POINT ──────────
//
// Since 2026-09-16 a tab set runs FLUSH to the edges of whatever contains it:
// the leading caption gives up its left padding and the panel reserves no
// horizontal padding at all (`render/registry/island-tabs-ssr.tsx`,
// `[internal ref]`). Drawn straight into the preview card, the captions and
// the panel body therefore start exactly where the card's own inset ends, and
// the card reads as having lost its padding rather than as holding a component.
//
// So the specimen supplies the container the component is flush TO. The inset
// lives on that frame and never on the tab set, which is what keeps the drawing
// honest: the component is still edge-to-edge in its box, and the reader can
// see where the box is.

import type { PageComponent, TypePageBody } from './_shape'

const PANELS = [{ label: 'Table' }, { label: 'Board' }, { label: 'Calendar' }]

const body = (text: string) => ({
  type: 'text' as const,
  element: 'p',
  props: { className: 'text-foreground-subtle text-sm' },
  content: text,
})

/** The box one tab set is drawn in — its own inset, nothing else. */
const framed = (node: unknown): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'w-full px-4' },
    children: [node],
  }) as PageComponent

const tabs: TypePageBody = {
  drawings: [
    {
      label: 'underline',
      children: [
        framed({
          type: 'tabs',
          defaultTab: 'Table',
          panels: PANELS,
          children: [
            body('Six deals, newest first.'),
            body('Grouped by stage.'),
            body('By close date.'),
          ],
        }),
      ],
    },
    {
      label: 'pills',
      children: [
        framed({
          type: 'tabs',
          defaultTab: 'Board',
          panels: PANELS,
          children: [
            body('Six deals, newest first.'),
            body('Grouped by stage.'),
            body('By close date.'),
          ],
        }),
      ],
    },
    {
      label: 'with panel',
      children: [
        framed({
          type: 'tabs',
          defaultTab: 'Table',
          panels: [{ label: 'Overview' }, { label: 'Runs' }],
          children: [
            body('What this automation does, and when it last ran.'),
            body('Every execution, newest first, with its outcome.'),
          ],
        }),
      ],
    },
  ],
}

export default tabs
