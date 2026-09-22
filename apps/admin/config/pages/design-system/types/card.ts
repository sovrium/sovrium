// `card` — a bounded surface, and three things that are not one.
//
// `variant` is the key, and it carries more than a look: `scoped` is a
// BOUNDARY rather than a surface — it drops the card recipe entirely and paints
// no background, border, radius or padding, because the design it wraps
// re-declares all four inside it. This console's own pages are built on that,
// which is why it is drawn rather than described.
//
// The last two are compositions. A card with an image and a card with a footer
// are arrangements of children, not modes, and there is no key for either.

import type { TypePageBody } from './_shape'

const body = (text: string) => ({
  type: 'text' as const,
  element: 'p',
  props: { className: 'text-foreground-subtle text-sm leading-relaxed' },
  content: text,
})

const card: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'card',
          props: { className: 'w-full p-4' },
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
          props: { className: 'w-full overflow-hidden' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'bg-background-subtle h-24 w-full' },
              children: [],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'p-4' },
              children: [body('Atelier Nord — onboarding deck.')],
            },
          ],
        },
      ],
    },
    {
      label: 'with footer',
      children: [
        {
          type: 'card',
          props: { className: 'w-full' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'p-4' },
              children: [body('This share link expires in 30 days.')],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-border flex justify-end gap-2 border-t px-4 py-2' },
              children: [
                {
                  type: 'button',
                  variant: 'outline',
                  size: 'sm',
                  label: 'Revoke',
                  props: { type: 'button' },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default card
