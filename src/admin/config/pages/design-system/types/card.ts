/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `card` — a bounded surface, and three things that are not one.
//
// The card is shadcn's `Card` root: the `card` colours, `rounded-xl`, a faint
// ring instead of a border, and a 16 px spacing that separates its children
// and pads all four edges, because its children sit directly inside it.
//
// `variant` is the key, and it carries more than a look: `scoped` is a
// BOUNDARY rather than a surface — it drops the card recipe entirely and paints
// no background, border, radius or padding, because the design it wraps
// re-declares all four inside it. This console's own pages are built on that,
// which is why it is drawn rather than described.
//
// The header and the footer are the card's own keys: `title` and
// `description` fill `card-header`, `action` sits on the title row, `footer`
// is the band under the body — and a card that declares any of them puts its
// children in `card-content`, so a chart in a card is framed once. The cover
// image is still a composition: a block bled to the edges. The `sm` size is a
// closed `size` union, so the page derives its Sizes section itself.

import type { PageComponent, TypePageBody } from './body-shape'

const body = (text: string) => ({
  type: 'text' as const,
  element: 'p',
  props: { className: 'text-sm' },
  content: text,
})

const button = (label: string, variant: 'outline' | 'ghost'): PageComponent =>
  ({ type: 'button', variant, size: 'sm', label, props: { type: 'button' } }) as PageComponent

const card: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'card',
          title: 'Proposal',
          description: 'Deals waiting on the client.',
          props: { className: 'w-full' },
          children: [body('Six deals in Proposal, worth 94 200 € between them.')],
        },
      ],
    },
    {
      label: 'specimen',
      children: [
        {
          type: 'card',
          variant: 'specimen',
          props: { className: 'w-full p-4' },
          children: [body('The drawing sits on its own stage.')],
        },
      ],
    },
    {
      label: 'scoped',
      children: [
        {
          type: 'card',
          variant: 'scoped',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'bg-background text-foreground w-full rounded p-4' },
              children: [body('Inside the scope, a design paints its own background and border.')],
            },
          ],
        },
      ],
    },
    {
      label: 'with image',
      children: [
        {
          type: 'card',
          props: { className: 'w-full' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'bg-muted -mx-4 -mt-4 h-24' },
              children: [],
            },
            body('Atelier Nord — onboarding deck.'),
          ],
        },
      ],
    },
    {
      label: 'with action',
      children: [
        {
          type: 'card',
          title: 'Share link',
          description: 'Anyone with the link can read this table.',
          action: button('Copy', 'ghost'),
          props: { className: 'w-full' },
          children: [body('Expires in 30 days.')],
        } as PageComponent,
      ],
    },
    {
      label: 'with footer',
      children: [
        {
          type: 'card',
          title: 'Share link',
          footer: [button('Revoke', 'outline')],
          props: { className: 'w-full' },
          children: [body('This share link expires in 30 days.')],
        } as PageComponent,
      ],
    },
  ],
}

export default card
