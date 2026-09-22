// `description-list` — term-and-detail pairs, which is what a record detail is.
//
// All three are the real component. `layout` and `dividers` are what separate
// them, and the third adds children rather than a key: an action beside a pair
// is a composition, because the type declares no slot for one.

import type { TypePageBody } from './_shape'

const PAIRS = [
  { term: 'Client', detail: 'Menuiserie Roux' },
  { term: 'Stage', detail: 'Proposal' },
  { term: 'Amount', detail: '24 500 €' },
  { term: 'Close date', detail: '14 Oct 2026' },
]

const descriptionList: TypePageBody = {
  drawings: [
    {
      label: 'two columns',
      children: [{ type: 'description-list', items: PAIRS, layout: 'rows', dividers: true }],
    },
    {
      label: 'stacked',
      children: [{ type: 'description-list', items: PAIRS, layout: 'stacked' }],
    },
    {
      label: 'with actions',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-3' },
          children: [
            { type: 'description-list', items: PAIRS.slice(0, 3), layout: 'rows', dividers: true },
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex justify-end gap-2' },
              children: [
                {
                  type: 'button',
                  variant: 'outline',
                  size: 'sm',
                  label: 'Edit',
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

export default descriptionList
