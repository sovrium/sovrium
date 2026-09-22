// `grid` — columns, and the one thing about them that is not a number.
//
// The type has no keys of its own: the column count is Tailwind on `props`, and
// that is deliberate — a grid's arrangement is a layout decision per breakpoint
// rather than a property of the component. So all four drawings are the real
// component and what differs is the class, which is exactly what an author
// writes.
//
// The fourth is the one worth the page: two counts at two widths, which is what
// every real grid in this app actually does and what a fixed-column drawing
// cannot show.

import type { PageComponent, TypePageBody } from './_shape'

const cell = (n: number): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border bg-background-subtle text-foreground-subtle rounded border px-3 py-6 text-center text-[11px]',
    },
    children: [{ type: 'text', element: 'span', content: String(n) }],
  }) as PageComponent

const gridOf = (className: string, count: number): PageComponent =>
  ({
    type: 'grid',
    props: { className: `w-full gap-3 ${className}` },
    children: Array.from({ length: count }, (_, i) => cell(i + 1)),
  }) as PageComponent

const grid: TypePageBody = {
  drawings: [
    { label: '2 columns', children: [gridOf('grid-cols-2', 4)] },
    { label: '3 columns', children: [gridOf('grid-cols-3', 6)] },
    { label: '4 columns', children: [gridOf('grid-cols-4', 8)] },
    {
      label: 'per breakpoint',
      children: [gridOf('grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', 8)],
    },
  ],
}

export default grid
