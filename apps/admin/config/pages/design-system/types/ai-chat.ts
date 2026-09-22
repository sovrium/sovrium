// `ai-chat` — a conversation with an agent this app declares.
//
// The catalogue refuses to preview it, and the refusal is the strongest one in
// the kit: the component hydrates a prompt composer, which is a live submit
// control that sends a message to this instance's AI provider. A documentation
// page may carry no write path, so a real one here would be a console surface
// spending an operator's tokens to illustrate itself.
//
// All three are composed. The third is the useful one: a single message is what
// an author embeds beside a record, and it is the shape most people reach for
// rather than the full panel.

import type { PageComponent, TypePageBody } from './_shape'

const message = (who: 'agent' | 'reader', text: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        who === 'reader'
          ? 'bg-background-subtle text-foreground ml-auto max-w-[80%] rounded-lg px-3 py-2 text-sm'
          : 'border-border text-foreground max-w-[80%] rounded-lg border px-3 py-2 text-sm',
    },
    children: [{ type: 'text', element: 'span', content: text }],
  }) as PageComponent

const composer = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border text-foreground-subtle mt-1 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
    },
    children: [
      { type: 'text', element: 'span', content: 'Ask about this record…' },
      { type: 'icon', props: { name: 'arrow-up', size: 14 } },
    ],
  }) as PageComponent

const aiChat: TypePageBody = {
  drawings: [
    {
      label: 'panel',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'border-border flex w-full flex-col gap-2 rounded-lg border p-3' },
          children: [
            message('reader', 'Which deals slipped past their close date?'),
            message(
              'agent',
              'Three: Escalier chêne, Terrasse bois and Cuisine sur mesure. Two are still in Proposal.'
            ),
            composer(),
          ],
        },
      ],
    },
    {
      label: 'inline answer',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'border-border flex w-full flex-col gap-2 rounded-lg border p-3' },
          children: [
            message('agent', 'Pipeline is 94 200 € across six open deals, up 12% on last month.'),
          ],
        },
      ],
    },
    {
      label: 'message',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-2' },
          children: [
            message('reader', 'Summarise this deal.'),
            message(
              'agent',
              'Quote sent 12 Oct for 24 500 €. Client asked for oak instead of beech; no reply since.'
            ),
          ],
        },
      ],
    },
  ],
}

export default aiChat
