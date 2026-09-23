/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `badge` — six drawings over two independent axes, which is why the names here
// are not the schema's.
//
// `badgeVariant` picks the fill (`default secondary destructive outline`) and
// `variant` picks the MODE (`status` or `contrast`), and the two are orthogonal.
// The design system's six named forms each pin a point in that product, so each
// heading is the form and each drawing is the real component with whichever keys
// produce it.
//
// ─── AND THAT IS WHY THE DERIVATION RULE DOES NOT REACH THIS FILE ──────────
//
// The ruling of 2026-09-16 is that a type page's variant sections ARE the axis
// the schema publishes — every member, named by the value an author writes,
// read from the type's own record rather than transcribed here. It applies to a
// variant AXIS. These six are not one: they are a demonstration of two axes
// composed, and `badgeVariant`'s four members are reachable from any of them.
// Deriving here would replace six forms the design system has names for with
// four fills nobody asks for by name, so this file keeps its authored drawings
// and is the declared exception the rule names.
//
// ─── THE SIZE LADDER IS THE RECIPE'S, NOT THE SCHEMA'S ─────────────────────
//
// A badge has no `size` key. Its height comes from the recipe, which sets one
// step, so there is no Sizes section here and nothing to draw in one: claiming
// an axis the config surface does not have would send an author to write a key
// the decoder refuses.

import type { TypePageBody } from './body-shape'

const badgeOf = (props: Readonly<Record<string, unknown>>, label: string) => ({
  type: 'badge' as const,
  ...props,
  children: [{ type: 'text' as const, element: 'span', content: label }],
})

const badge: TypePageBody = {
  variants: [
    { label: 'contrast', children: [badgeOf({ badgeVariant: 'default' }, 'Live')] },
    { label: 'neutral', children: [badgeOf({ badgeVariant: 'secondary' }, 'Draft')] },
    {
      label: 'inverted',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'bg-foreground flex items-center gap-2 rounded-md px-3 py-2' },
          children: [badgeOf({ badgeVariant: 'secondary' }, 'Beta')],
        },
      ],
    },
    { label: 'outline', children: [badgeOf({ badgeVariant: 'outline' }, 'Archived')] },
    {
      label: 'status',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex items-center gap-3' },
          // The label goes in `status`, NOT in children. A badge in status mode
          // renders the dot and its `status` string and drops whatever children
          // it was given — silently, so a label written as a child produces a
          // bare dot and no error. Measured on this page before it was fixed.
          children: [
            { type: 'badge', variant: 'status', statusColor: 'green', status: 'Passing' },
            { type: 'badge', variant: 'status', statusColor: 'amber', status: 'Queued' },
            { type: 'badge', variant: 'status', statusColor: 'red', status: 'Failed' },
          ],
        },
      ],
    },
    { label: 'semantic', children: [badgeOf({ badgeVariant: 'destructive' }, 'Revoked')] },
  ],
}

export default badge
