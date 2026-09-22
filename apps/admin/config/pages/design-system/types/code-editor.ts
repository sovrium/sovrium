/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `code-editor` — code a reader may change, as against `code`, which they may only read.
//
// That is the whole distinction between the two types and it decides which one an
// author reaches for: a snippet on a documentation page is `code`; an automation
// body someone edits is `code-editor`. Reaching for the editor to display a
// snippet ships a syntax-highlighting engine to render four lines.
//
// Three drawings for the three things that change how it is used: the grammar,
// whether it accepts input at all, and whether the gutter is worth its width.

import type { PageComponent, TypePageBody } from './_shape'

const SAMPLE = `export const onDealWon = async (record) => {
  await notify('#sales', record.name + ' closed at ' + record.amount)
  return { status: 'done' }
}`

// No `name` and no `label`, deliberately: the island renders whichever of the
// two it is given as a visible caption, and an internal id printed over every
// drawing on the page is a caption that says nothing.
const editor = (_id: string, extra: Record<string, unknown>) =>
  ({
    type: 'code-editor' as const,
    language: 'typescript',
    value: SAMPLE,
    minLines: 4,
    ...extra,
  }) as PageComponent

/** Indented with TABS, so `tabSize` has something to act on. */
const TABBED =
  'function total(items) {\n\tlet sum = 0\n\tfor (const i of items) {\n\t\tsum += i.amount\n\t}\n\treturn sum\n}'

const LANGUAGES: readonly (readonly [string, string])[] = [
  ['javascript', 'const total = items.reduce((sum, i) => sum + i.amount, 0)'],
  [
    'typescript',
    'const total = (items: Item[]): number => items.reduce((s, i) => s + i.amount, 0)',
  ],
  ['jsx', 'const Row = ({ item }) => <li className="row">{item.name}</li>'],
  ['tsx', 'const Row = ({ item }: { item: Item }) => <li>{item.name}</li>'],
  ['json', '{\n  "status": "done",\n  "durationMs": 412\n}'],
  ['html', '<section class="card">\n  <h2>Deals</h2>\n</section>'],
  ['css', '.card {\n  border: 1px solid var(--sv-border);\n}'],
  ['sql', "select name, amount\nfrom deals\nwhere status = 'won'"],
  ['markdown', '## Deals\n\nA **won** deal closes the record.'],
  ['python', 'total = sum(item["amount"] for item in items)'],
  ['yaml', 'status: done\ndurationMs: 412'],
]

const codeEditor: TypePageBody = {
  drawings: [
    {
      label: 'typescript',
      children: [
        {
          type: 'field',
          fieldLabel: 'Automation body',
          children: [
            {
              type: 'code-editor',
              name: 'body',
              language: 'typescript',
              value: SAMPLE,
              minLines: 4,
              maxLines: 12,
            },
          ],
        },
      ],
    },
    {
      label: 'read-only',
      children: [
        {
          type: 'code-editor',
          name: 'executed',
          language: 'json',
          readOnly: true,
          value: '{\n  "status": "done",\n  "durationMs": 412\n}',
          minLines: 4,
        },
      ],
    },
    {
      label: 'no line numbers',
      children: [
        {
          type: 'code-editor',
          name: 'expression',
          language: 'javascript',
          lineNumbers: false,
          tabSize: 2,
          value: "record.amount > 10000 ? 'enterprise' : 'standard'",
          minLines: 3,
        },
      ],
    },
  ],
  options: [
    {
      id: 'language',
      title: 'Language',
      configKey: 'code-editor.language',
      drawings: [
        ...LANGUAGES.map(([language, value]) => ({
          label: `language: '${language}'`,
          children: [editor(`ce-lang-${language}`, { language, value, minLines: 3 })],
        })),
        {
          label: "language: 'cobol'",
          children: [
            editor('ce-lang-unknown', {
              language: 'cobol',
              value: 'IDENTIFICATION DIVISION.\nPROGRAM-ID. DEALS.',
              minLines: 3,
            }),
          ],
        },
      ],
    },
    {
      id: 'gutter',
      title: 'Gutter',
      configKey: 'code-editor.lineNumbers',
      drawings: [
        {
          label: 'lineNumbers: true',
          children: [editor('ce-gutter-on', { lineNumbers: true, minLines: 3 })],
        },
        {
          label: 'lineNumbers: false',
          children: [
            editor('ce-gutter-off', {
              lineNumbers: false,
              language: 'javascript',
              value: "record.amount > 10000 ? 'enterprise' : 'standard'",
              minLines: 2,
            }),
          ],
        },
      ],
    },
    {
      id: 'indent',
      title: 'Indent',
      configKey: 'code-editor.tabSize',
      drawings: [
        {
          label: 'tabSize: 2',
          children: [editor('ce-tab-2', { tabSize: 2, value: TABBED, minLines: 5 })],
        },
      ],
    },
    {
      id: 'height',
      title: 'Height',
      configKey: 'code-editor.minLines | maxLines',
      drawings: [
        {
          label: 'minLines: 6',
          children: [
            editor('ce-min', { minLines: 6, language: 'json', value: '{\n  "status": "done"\n}' }),
          ],
        },
        {
          label: 'maxLines: 4',
          children: [
            editor('ce-max', {
              maxLines: 4,
              minLines: 4,
              language: 'sql',
              value:
                "select\n  d.name,\n  d.amount,\n  c.name as company\nfrom deals d\njoin companies c on c.id = d.company_id\nwhere d.status = 'won'\norder by d.amount desc",
            }),
          ],
        },
      ],
    },
    {
      id: 'read-only',
      title: 'Read-only',
      configKey: 'code-editor.readOnly',
      drawings: [
        { label: 'readOnly: false', children: [editor('ce-ro-off', { minLines: 3 })] },
        {
          label: 'readOnly: true',
          children: [
            editor('ce-ro-on', {
              readOnly: true,
              minLines: 3,
              language: 'json',
              value: '{\n  "status": "done",\n  "durationMs": 412\n}',
            }),
          ],
        },
      ],
    },
    {
      id: 'renderings',
      title: 'Where it appears',
      configKey: 'code — the field type, across surfaces',
      drawings: [
        {
          label: 'in a form',
          children: [editor('ce-in-form', { minLines: 3 })],
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
                  props: { className: 'text-foreground truncate font-mono text-[11px]' },
                  content: "record.amount > 10000 ? 'enterprise' : 'standard'",
                },
              ],
            } as PageComponent,
          ],
        },
        {
          label: 'in a table cell · edit',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border bg-background-raised w-72 rounded-md border p-2 shadow-md',
              },
              children: [
                {
                  type: 'text',
                  element: 'p',
                  props: { className: 'text-foreground font-mono text-[11px]' },
                  content: "record.amount > 10000 ? 'enterprise' : 'standard'",
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
  ],
}

export default codeEditor
