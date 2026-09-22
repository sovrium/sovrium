// `accordion` — sections that open one at a time, or several.
//
// All three are the real component. `accordionType` and `defaultOpen` are what
// separate them, and the difference between the first two is the one an author
// actually chooses between: whether opening a section closes its neighbour.
//
// ─── A SECTION IS NAMED BY ITS CHILD, NOT BY A PANELS ARRAY ────────────────
//
// The type declares only `accordionType` and `defaultOpen`. The renderer reads
// the RAW child objects to build its items, so each section's caption rides on
// the child as `content.title`, with its id in `props.id` — a child with no id
// is skipped entirely. Two traps here: `id` is NOT a top-level field on a
// container (the schema refuses it), and `props.label` looks like the right
// placement and is not — substitution reaches it, but the extractor throws away
// the rendered element that carries the substituted copy.
//
// ─── AND THE BODY RIDES ON `content.body`, NOT ON A CHILD ──────────────────
//
// The same trap one level down, and this page shipped with it: the panel bodies
// were written as a `text` child of each section, and every panel on the page
// rendered EMPTY. `buildAccordionItems` maps each raw child to
// `{ id, title, content }` and takes all three off the child object itself —
// `props.id`, `content.title`, `content.body` — so a rendered element inside the
// section is discarded exactly as `props.label` is. There is nowhere to hang a
// className on the body for the same reason: what reaches the island is a
// string, and the island decides how it is painted.

import type { PageComponent, TypePageBody } from './_shape'

// ─── TWO SENTENCES PER PANEL, NOT ONE ──────────────────────────────────────
//
// A panel holding a single short line shows that a section is OPEN without
// showing what a reader opened it for: nothing wraps, so the drawing says
// nothing about how a body sits inside the panel or how far the section grows
// when it is the one in force. Two sentences is the shortest body that answers
// both, and it stays plain prose — these panels document the component, not the
// product.
const SECTIONS: readonly (readonly [id: string, title: string, body: string])[] = [
  [
    'what',
    'What is a configuration file?',
    'One file describing your tables, pages, permissions and automations. It sits in your repository, beside the rest of your code.',
  ],
  [
    'where',
    'Where does it run?',
    'On your own infrastructure, read by one binary. The same file runs on a laptop and on a server.',
  ],
  [
    'change',
    'What happens when it changes?',
    'The running app changes with it. What you edit is what the next visitor is served.',
  ],
]

const panel = ([id, title, body]: readonly [string, string, string]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { id },
    content: { title, body },
  }) as PageComponent

const accordion: TypePageBody = {
  drawings: [
    {
      label: 'single open',
      children: [
        {
          type: 'accordion',
          accordionType: 'single',
          defaultOpen: ['what'],
          props: { className: 'w-full' },
          children: SECTIONS.map(panel),
        },
      ],
    },
    {
      label: 'all closed',
      children: [
        {
          type: 'accordion',
          accordionType: 'single',
          props: { className: 'w-full' },
          children: SECTIONS.map(panel),
        },
      ],
    },
    {
      label: 'collapsible',
      children: [
        {
          type: 'accordion',
          accordionType: 'multiple',
          defaultOpen: ['what', 'where'],
          props: { className: 'w-full' },
          children: SECTIONS.map(panel),
        },
      ],
    },
  ],
}

export default accordion
