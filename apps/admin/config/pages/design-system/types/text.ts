// `text` — the workhorse, drawn at the four weights a page actually uses.
//
// Every drawing is the real component. `element` is the only key involved, and
// what changes between them is the class the theme puts on it — which is the
// point: a lead paragraph is not a different component from a body paragraph,
// it is the same one asked to carry more weight.

import type { TypePageBody } from './_shape'

const text: TypePageBody = {
  drawings: [
    {
      label: 'body',
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground max-w-2xl text-md leading-relaxed' },
          content:
            'Describe your tables, pages, permissions and automations in one file. Sovrium runs the application, on your own infrastructure.',
        },
      ],
    },
    {
      label: 'lead',
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground max-w-2xl text-xl leading-relaxed' },
          content: 'One configuration file, read by one binary, on your own infrastructure.',
        },
      ],
    },
    {
      label: 'caption',
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-foreground-subtle max-w-2xl text-[11px] leading-relaxed' },
          content: 'Counts are read live from the catalogue and are never written into this page.',
        },
      ],
    },
    {
      label: 'mono',
      children: [
        {
          type: 'text',
          element: 'code',
          props: { className: 'text-foreground font-mono text-sm' },
          content: 'design.components.button',
        },
      ],
    },
  ],
}

export default text
