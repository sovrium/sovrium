/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `record-picker` — searches a table of yours and links the row it finds.
//
// ─── WHY THIS PAGE DRAWS A CONTEXT AND NOT THE COMPONENT ───────────────────
//
// The component needs a table. This console is bound to none, and binding it to
// one of yours is exactly what the confidentiality bound forbids — so a real
// picker here would have nothing to offer and would refuse to decode. The
// drawing below is therefore composed from other kit types: it is what the
// control LOOKS like, authored, rather than the control itself.
//
// Its states, its paging and its create path are drawn as authored option
// sections further down this page, for the same reason.
//
// The one thing to carry away: a filter declared on the picker is enforced on
// the server, not in the browser. A filter that lives only in the island is a
// filter that does not exist.

import type { PageComponent, TypePageBody } from './body-shape'

const box = (children: readonly unknown[], className = ''): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        `border-border flex w-80 flex-col gap-2 rounded-md border px-2 py-2 ${className}`.trim(),
    },
    children,
  }) as PageComponent

const line = (content: string, className = 'text-foreground-subtle px-1 text-sm'): PageComponent =>
  ({ type: 'text', element: 'p', content, props: { className } }) as PageComponent

const label = (content: string): PageComponent =>
  ({
    type: 'text',
    element: 'label',
    content,
    props: { className: 'text-foreground text-sm font-medium' },
  }) as PageComponent

const field = (labelText: string, children: readonly unknown[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-80 flex-col gap-1.5' },
    children: [label(labelText), ...children],
  }) as PageComponent

const row = (content: string, muted = false): PageComponent =>
  ({
    type: 'text',
    element: 'p',
    content,
    props: {
      className: muted
        ? 'text-foreground-subtle rounded px-2 py-1 text-sm'
        : 'text-foreground hover:bg-background-subtle rounded px-2 py-1 text-sm',
    },
  }) as PageComponent

const list = (children: readonly unknown[]): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border flex flex-col gap-0.5 border-t pt-2' },
    children,
  }) as PageComponent

const chip = (label: string) => ({
  type: 'container' as const,
  element: 'div' as const,
  props: {
    className: 'bg-muted text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm',
  },
  children: [
    { type: 'text' as const, element: 'span' as const, content: label },
    {
      type: 'text' as const,
      element: 'span' as const,
      content: '×',
      props: { className: 'text-muted-foreground' },
    },
  ],
})

const recordPicker: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-80 flex-col gap-1.5' },
          children: [
            {
              type: 'text',
              element: 'label',
              content: 'Companies',
              props: { className: 'text-foreground text-sm font-medium' },
            },
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border flex flex-col gap-2 rounded-md border px-2 py-2',
              },
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-wrap gap-1.5' },
                  children: [chip('Acme Europe'), chip('Northwind SAS')],
                },
                {
                  type: 'text',
                  element: 'p',
                  content: 'Search companies…',
                  props: { className: 'text-muted-foreground px-1 text-sm' },
                },
              ],
            },
            {
              type: 'text',
              element: 'p',
              content: 'Two of three linked.',
              props: { className: 'text-muted-foreground text-xs' },
            },
          ],
        },
      ],
    },
  ],
  options: [
    {
      id: 'source',
      title: 'Source',
      configKey: 'record-picker.dataSource',
      drawings: [
        {
          label: 'closed',
          children: [field('Company', [box([chip('Acme Europe'), line('Search companies…')])])],
        },
        {
          label: 'searching',
          children: [
            field('Company', [
              box([
                line('acme', 'text-foreground px-1 text-sm'),
                list([row('Acme Europe'), row('Acme Nordics'), row('Acme Iberia')]),
              ]),
            ]),
          ],
        },
        {
          label: 'no displayField',
          children: [
            field('Company', [
              box([
                line(
                  'Showing record ids — no displayField is declared.',
                  'text-foreground-subtle px-1 text-[11px]'
                ),
                list([row('rec_8f21'), row('rec_44ad')]),
              ]),
            ]),
          ],
        },
        {
          label: 'filter: [{ field, operator, value }]',
          children: [
            field('Company', [
              box([
                line('Lyon only', 'text-foreground-subtle px-1 text-[11px]'),
                list([row('Acme Lyon'), row('Northwind Lyon')]),
              ]),
            ]),
          ],
        },
      ],
    },
    {
      id: 'paging',
      title: 'Paging',
      configKey: 'record-picker.pageSize',
      drawings: [
        {
          label: 'pageSize: 20 · more to come',
          children: [
            field('Company', [
              box([
                line('a'),
                list([row('Acme Europe'), row('Acme Nordics'), row('Load more…', true)]),
              ]),
            ]),
          ],
        },
        {
          label: 'everything shown',
          children: [
            field('Company', [
              box([
                line('acme'),
                list([row('Acme Europe'), row('Acme Nordics'), row('2 companies', true)]),
              ]),
            ]),
          ],
        },
        {
          label: 'no match',
          children: [
            field('Company', [box([line('zzz'), list([row('No companies match zzz.', true)])])]),
          ],
        },
        {
          label: 'load failed',
          children: [
            field('Company', [
              box([line('acme'), list([row('Couldn’t search companies. Try again.', true)])]),
            ]),
          ],
        },
      ],
    },
    {
      id: 'create',
      title: 'Create',
      configKey: 'record-picker.allowCreate',
      drawings: [
        {
          label: 'allowCreate: false',
          children: [
            field('Company', [
              box([line('Nordwind'), list([row('No companies match Nordwind.', true)])]),
            ]),
          ],
        },
        {
          label: 'allowCreate: true · offered',
          children: [
            field('Company', [box([line('Nordwind'), list([row('+ Create “Nordwind”')])])]),
          ],
        },
        {
          label: 'allowCreate: true · created',
          children: [
            field('Company', [
              box([
                chip('Nordwind'),
                line('Created and linked.', 'text-foreground-subtle px-1 text-[11px]'),
              ]),
            ]),
          ],
        },
        {
          label: 'allowCreate: true · refused',
          children: [
            field('Company', [
              box([
                line('Nordwind'),
                list([row('Can’t create here: companies also requires a country.', true)]),
              ]),
            ]),
          ],
        },
        {
          label: 'not permitted',
          children: [
            field('Company', [
              box([line('Nordwind'), list([row('No companies match Nordwind.', true)])]),
            ]),
          ],
        },
      ],
    },
    {
      id: 'multiple',
      title: 'Multiple',
      configKey: 'record-picker.multiple | maxLinked',
      drawings: [
        {
          label: 'multiple: false',
          children: [field('Company', [box([chip('Acme Europe'), line('Search companies…')])])],
        },
        {
          label: 'multiple: true',
          children: [
            field('Companies', [
              box([
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-wrap gap-1.5' },
                  children: [chip('Acme Europe'), chip('Northwind SAS')],
                } as PageComponent,
                line('Search companies…'),
              ]),
            ]),
          ],
        },
        {
          label: 'multiple: true · maxLinked reached',
          children: [
            field('Companies', [
              box([
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-wrap gap-1.5' },
                  children: [chip('Acme Europe'), chip('Northwind SAS'), chip('Contoso')],
                } as PageComponent,
                line('Three of three linked.', 'text-foreground-subtle px-1 text-[11px]'),
              ]),
            ]),
          ],
        },
      ],
    },
    {
      id: 'renderings',
      title: 'Where it appears',
      configKey: 'record-picker — across surfaces',
      drawings: [
        {
          label: 'in a form',
          children: [field('Company', [box([chip('Acme Europe'), line('Search companies…')])])],
        },
        {
          label: 'in a grid cell · read',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border flex w-72 items-center rounded-md border px-3 py-2',
              },
              children: [chip('Acme Europe')],
            } as PageComponent,
          ],
        },
        {
          label: 'in a grid cell · edit',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'bg-background-raised rounded-md shadow-md' },
              children: [box([line('acme'), list([row('Acme Europe'), row('Acme Nordics')])])],
            } as PageComponent,
          ],
        },
        {
          label: 'read-only',
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-80 flex-col gap-1.5' },
              children: [
                label('Company'),
                {
                  type: 'text',
                  element: 'p',
                  content: 'Acme Europe',
                  props: { className: 'text-foreground text-sm' },
                },
              ],
            } as PageComponent,
          ],
        },
      ],
    },
    {
      id: 'states',
      title: 'States',
      configKey: 'record-picker — states',
      drawings: [
        {
          label: 'default',
          children: [field('Company', [box([chip('Acme Europe'), line('Search companies…')])])],
        },
        {
          label: 'loading',
          children: [
            field('Company', [
              box([
                line('acme'),
                list([
                  // No className: `skeleton` writes its own width and height
                  // inline, so one here is a class that does nothing.
                  { type: 'skeleton' } as PageComponent,
                  { type: 'skeleton' } as PageComponent,
                ]),
              ]),
            ]),
          ],
        },
        {
          label: 'empty',
          children: [field('Company', [box([line('No company linked.')])])],
        },
        {
          label: 'invalid',
          children: [
            field('Company', [
              box([line('Search companies…')], 'border-error-border'),
              {
                type: 'text',
                element: 'p',
                content: 'Link a company before saving — an invoice needs one to bill.',
                props: { className: 'text-error-fg text-[11px]' },
              } as PageComponent,
            ]),
          ],
        },
        {
          label: 'disabled',
          children: [field('Company', [box([line('Search companies…')], 'opacity-60')])],
        },
      ],
    },
  ],
}

export default recordPicker
