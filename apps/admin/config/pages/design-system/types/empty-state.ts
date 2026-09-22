// `empty-state` — a surface with nothing on it, saying what would be.
//
// Both drawings are the real component. The difference is whether the reader is
// given the next action, and that is the whole design question this type poses:
// an empty state without one is a dead end, which is the thing the house rules
// name outright.

import type { TypePageBody } from './_shape'

const emptyState: TypePageBody = {
  drawings: [
    {
      label: 'with action',
      children: [
        {
          type: 'empty-state',
          // INSIDE `props`, though the schema declares these at the top level:
          // the renderer reads them off `elementProps`, so written top-level
          // they validate, typecheck, and draw an empty dashed box.
          props: {
            emptyIcon: 'table',
            emptyTitle: 'No records yet',
            emptyDescription: 'This table has no rows. Add one, or import a CSV to fill it.',
          },
          children: [
            {
              type: 'button',
              variant: 'default',
              size: 'sm',
              label: 'New record',
              props: { type: 'button' },
            },
          ],
        },
      ],
    },
    {
      label: 'plain',
      children: [
        {
          type: 'empty-state',
          props: {
            emptyIcon: 'search',
            emptyTitle: 'No deals match these filters',
            emptyDescription: 'Widen the stage or the amount to see more.',
          },
        },
      ],
    },
  ],
}

export default emptyState
