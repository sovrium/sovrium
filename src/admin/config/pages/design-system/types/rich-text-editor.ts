/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `rich-text-editor` — formatted prose someone writes in place.
//
// `toolbar` is the decision, and the three drawings are three answers to the same
// question: how much formatting does this field's content actually need? A note
// on a record needs bold and a link. A knowledge-base article needs everything.
// Offering everything for a note is how a one-line comment ends up carrying a
// heading level.
//
// The slash menu is the same set reached by typing rather than pointing — it is
// what someone writing at speed uses, and it costs nothing to leave on.

import type { PageComponent, TypePageBody } from './body-shape'

/** One editor, one toolbar, and the markup that button produces. */
const rte = (extra: Readonly<Record<string, unknown>>) =>
  ({ type: 'rich-text-editor' as const, ...extra }) as PageComponent

/** The twelve toolbar actions, each with what it makes. */
const ACTIONS: readonly (readonly [action: string, button: string, value: string])[] = [
  ['bold', 'B', '<p>A deal closes when <strong>legal</strong> signs.</p>'],
  ['italic', 'I', '<p>A deal closes when <em>legal</em> signs.</p>'],
  ['strike', 'S', '<p>Closing <s>this week</s> next week.</p>'],
  ['heading', 'H', '<h2>Before you start</h2><p>You need an account.</p>'],
  ['list', 'List', '<ul><li>Qualify</li><li>Propose</li></ul>'],
  ['ordered-list', '1.', '<ol><li>Qualify</li><li>Propose</li></ol>'],
  ['code-block', '</>', '<pre><code>status === "won"</code></pre>'],
  ['blockquote', '"', '<blockquote><p>They asked for a September pilot.</p></blockquote>'],
  ['link', 'Link', '<p>See the <a href="#">proposal</a>.</p>'],
  ['image', 'Img', '<p>The signed page follows.</p>'],
  [
    'table',
    'Tbl',
    '<table><tbody><tr><td>Plan</td><td>Seats</td></tr><tr><td>Team</td><td>20</td></tr></tbody></table>',
  ],
  ['horizontal-rule', '—', '<p>Above.</p><hr><p>Below.</p>'],
]

const richTextEditor: TypePageBody = {
  drawings: [
    {
      label: 'default toolbar',
      children: [
        {
          type: 'field',
          fieldLabel: 'Call notes',
          children: [
            {
              type: 'rich-text-editor',
              name: 'notes',
              placeholder: 'What was agreed?',
              value: '<p>Agreed on a <strong>September</strong> pilot with two teams.</p>',
            },
          ],
        },
      ],
    },
    {
      label: 'every toolbar action',
      children: [
        {
          type: 'field',
          fieldLabel: 'Article body',
          children: [
            {
              type: 'rich-text-editor',
              name: 'article',
              toolbar: [
                'bold',
                'italic',
                'strike',
                'heading',
                'list',
                'ordered-list',
                'code-block',
                'blockquote',
                'link',
                'image',
                'table',
                'horizontal-rule',
              ],
              value:
                '<h2>Before you start</h2><p>You need an account and a table to write into.</p>',
            },
          ],
        },
      ],
    },
    {
      label: 'slash menu',
      children: [
        {
          type: 'field',
          fieldLabel: 'Article body',
          children: [
            {
              type: 'rich-text-editor',
              name: 'article-slash',
              placeholder: 'Type / for blocks',
              maxLength: 4000,
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'toolbar',
      title: 'Toolbar',
      configKey: 'rich-text-editor.toolbar[]',
      drawings: [
        {
          label: 'toolbar: (omitted)',
          children: [
            rte({ value: '<p>Agreed on a <strong>September</strong> pilot with two teams.</p>' }),
          ],
        },
        ...ACTIONS.map(([action, _button, value]) => ({
          label: `toolbar: ['${action}']`,
          children: [rte({ toolbar: [action], value })],
        })),
      ],
    },
    {
      id: 'slash-menu',
      title: 'Slash menu',
      configKey: "rich-text-editor.toolbar[] → '/'",
      drawings: [
        {
          label: 'toolbar: (omitted) → every block action',
          children: [rte({ placeholder: 'Type / for blocks' })],
        },
        {
          label: "toolbar: ['bold', 'link'] → two",
          children: [rte({ toolbar: ['bold', 'link'], placeholder: 'Type / for blocks' })],
        },
      ],
    },
    {
      id: 'placeholder',
      title: 'Placeholder',
      configKey: 'rich-text-editor.placeholder',
      drawings: [
        {
          label: "placeholder: 'What was agreed?'",
          children: [rte({ placeholder: 'What was agreed?' })],
        },
      ],
    },
    {
      id: 'length',
      title: 'Length',
      configKey: 'rich-text-editor.maxLength',
      drawings: [
        {
          label: 'maxLength: 2000',
          children: [
            rte({ maxLength: 2000, value: '<p>Agreed on a September pilot with two teams.</p>' }),
          ],
        },
        {
          label: 'maxLength: 60 · at the limit',
          children: [
            rte({
              maxLength: 60,
              value: '<p>Agreed on a September pilot with two teams and a pilot lead.</p>',
            }),
          ],
        },
      ],
    },
    {
      id: 'image',
      title: 'Image',
      configKey: 'rich-text-editor.imageBucket',
      drawings: [
        {
          label: "toolbar: ['image'] · imageBucket: 'attachments'",
          children: [
            rte({
              toolbar: ['image'],
              imageBucket: 'attachments',
              value: '<p>The signed page follows.</p>',
            }),
          ],
        },
        {
          label: 'uploading',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border flex w-72 flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6',
              },
              children: [
                { type: 'spinner' },
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: 'Uploading signed-proposal.pdf…',
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'renderings',
      title: 'Where it appears',
      configKey: 'rich-text — the field type, across surfaces',
      drawings: [
        {
          label: 'in a form',
          children: [rte({ value: '<p>Agreed on a <strong>September</strong> pilot.</p>' })],
        },
        {
          label: 'in a table cell · read',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border w-72 overflow-hidden rounded-md border px-3 py-2',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground truncate text-sm' },
                  content: 'Agreed on a September pilot with two teams.',
                },
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'read-only · record-field',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-border w-72 rounded-md border px-3 py-2' },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground text-sm' },
                  content: 'Agreed on a September pilot with two teams.',
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default richTextEditor
