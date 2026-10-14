/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/kit-specimen-frame@0.37.0#7ab6208e6b82
// sovrium-library: block/kit-specimen-frame@0.37.0#a29b482821aa

// The frame every drawing on a design-system page sits in, INSTALLED from the
// library's `kit-specimen-frame` block: the config line in monospace over a
// bordered frame that centres the drawing. Two installs of the one block:
//
//   - `specimenFrameCopy`      the label and the frame;
//   - `specimenFrameBareCopy`  the frame alone (`label` empty), for a section
//                              whose heading already names the drawing.
//
// `Console Block Parity` holds both to the block. Re-install with
// `sovrium library add block/kit-specimen-frame --update`. The bindings are
// the label, the drawing inside the frame, and the console's own markers.
//
// ─── WHY THE FRAME CARRIES A TYPE STEP ─────────────────────────────────────
//
// `text-base` is the body step, and it sits on the frame rather than on each
// drawing because font-size INHERITS. A component that rules its own step keeps
// it; one that rules none — an authored `text` span, a `swatch` label — would
// otherwise fall through to the document root and draw bigger than the page.

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

export const specimenFrameCopy = {
  type: 'container',
  element: 'div',
  props: { className: 'flex flex-col gap-2' },
  children: [
    {
      type: 'text',
      element: 'span',
      props: { className: 'font-mono text-xs text-muted-foreground' },
      content: '',
    },
    {
      type: 'container',
      element: 'div',
      props: {
        className:
          'flex flex-wrap items-start justify-center gap-4 rounded-lg border px-6 py-10 text-base',
      },
      children: [],
    },
  ],
} as const

export const specimenFrameBareCopy = {
  type: 'container',
  element: 'div',
  props: {
    className:
      'flex flex-wrap items-start justify-center gap-4 rounded-lg border px-6 py-10 text-base',
  },
  children: [],
} as const

/** The marker a spec addresses a frame by. */
const FRAME_MARKER = { 'data-design-preview-card': 'true' } as const

/** One drawing in its own frame, with no label above it. */
export const specimenFrame = (children: readonly PageComponent[]): PageComponent =>
  ({
    ...specimenFrameBareCopy,
    props: { ...specimenFrameBareCopy.props, ...FRAME_MARKER },
    children: [...children],
  }) as PageComponent

/** One drawing in its own frame, under the config line that produces it. */
export const labelledSpecimenFrame = (
  label: string,
  children: readonly PageComponent[],
  props: Readonly<Record<string, string>> = {}
): PageComponent => {
  const [caption, frame] = specimenFrameCopy.children
  return {
    ...specimenFrameCopy,
    props: { ...specimenFrameCopy.props, ...props },
    children: [
      { ...caption, content: label },
      { ...frame, props: { ...frame.props, ...FRAME_MARKER }, children: [...children] },
    ],
  } as PageComponent
}
