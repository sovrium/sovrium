/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The authored body for a type whose whole drawing is itself.
//
// ─── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
//
// Eight types have one appearance and no axis: an icon is an icon, an image is
// an image. The reference draws each of them once, as itself, which is exactly
// what the derived page already did — so for a while they were left on the
// derived path on the grounds that authoring them would copy a drawing rather
// than improve one.
//
// That was wrong, and for a reason that has nothing to do with how the page
// looks. The decision behind this whole surface is that the pages are authored
// and the derived model is NOT KEPT. A type left on the derived path is a type
// the derived path cannot be deleted without, so eight types with nothing to
// author were quietly holding the old model alive. They get an authored body
// that produces the same page, and the derived path becomes deletable.
//
// ─── IT STILL DRAWS THE REAL COMPONENT ─────────────────────────────────────
//
// `specimen` resolves the catalogue's own exhibit for the type and renders it
// with the real renderer. What is authored here is the PAGE — one section,
// named `default`, declared rather than built from a response — not a picture
// of the component.
//
// A type the catalogue refuses still refuses here, and says why in its own
// words. `drawable` is a scalar of the page's record, so the two cases are two
// gated children of one authored section rather than two bodies.

import type { PageComponent, TypePageBody } from './_shape'

/** One `default` section: the type drawn as itself, or its refusal. */
export const genericBody = (type: string): TypePageBody => ({
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'contents' },
          visibility: { record: { field: 'drawable', eq: true } },
          children: [
            {
              type: 'specimen',
              subject: { type },
              props: { 'data-design-kit-type': 'specimen' },
            },
          ],
        } as PageComponent,
        {
          type: 'container',
          element: 'div',
          props: {
            className:
              'border-border bg-background-subtle flex flex-col gap-2 rounded-md border border-dashed p-4',
            'data-design-specimen-state': '$record.refusalState',
          },
          visibility: { record: { field: 'drawable', eq: false } },
          children: [
            {
              type: 'text',
              element: 'p',
              props: {
                className: 'text-foreground-subtle max-w-2xl text-[11px] leading-relaxed',
                'data-design-refusal': 'true',
              },
              content: '$record.refusalReason',
            },
          ],
        } as PageComponent,
      ],
    },
  ],
})
