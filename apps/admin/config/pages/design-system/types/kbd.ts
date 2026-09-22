// `kbd` — a key, and a chord of them.
//
// Both are the real component. `keys` and `separator` are the whole of it: a
// chord is not a second component but the same one given more than one key, and
// drawing it that way is what stops an author composing three of these by hand
// with a plus sign between.

import type { TypePageBody } from './_shape'

const kbd: TypePageBody = {
  drawings: [
    {
      label: 'single',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'text-foreground flex items-center gap-2 text-sm' },
          children: [
            { type: 'text', element: 'span', content: 'Press' },
            { type: 'kbd', keys: ['Esc'] },
            { type: 'text', element: 'span', content: 'to close.' },
          ],
        },
      ],
    },
    {
      label: 'chord',
      children: [{ type: 'kbd', keys: ['⌘', 'K'] }],
    },
  ],
}

export default kbd
