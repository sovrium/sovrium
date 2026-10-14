/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, stringParam, type BlockNode } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  crumbs,
  insetHeader,
  placeholderContent,
  SIDEBAR_NOTES,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
} from '@/library/manifest/navigation-block-kit'

type Change = readonly [file: string, state: string]

/** shadcn's sample changes: a file and the letter its version control gives it. */
const CHANGES: readonly Change[] = [
  ['README.md', 'M'],
  ['api/hello/route.ts', 'U'],
  ['app/layout.tsx', 'M'],
]

/** The Files group: the `tree` over the files table, under its own label. */
const filesNav = (table: string, nameField: string, parentField: string): BlockNode => ({
  type: 'container',
  element: 'nav',
  props: { 'aria-label': 'Files', className: 'flex w-full min-w-0 flex-col p-2' },
  children: [
    {
      type: 'text',
      element: 'p',
      content: 'Files',
      props: {
        className:
          'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70',
      },
    },
    {
      type: 'tree',
      dataSource: { table },
      parentField,
      labelField: nameField,
      sortBy: { field: nameField },
      search: false,
      emptyMessage: 'No file yet.',
    },
  ],
})

/** shadcn/ui's `sidebar-11`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-11',
  shadcnBlock: 'sidebar-11',
  title: 'Sidebar 11',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'file tree', 'tree', 'shadcn'],
  description: 'A sidebar with a collapsible file tree.',
  notes: [
    'The Changes group lists three files, each with the letter its version control gives it. Edit them in the installed fragment.',
    'The Files group is the `tree` component over one of your tables: each record names its parent through a relationship back to the same table, and a record with no parent is a root. The first level starts open; a chevron opens or closes each branch, and the arrow keys walk the tree.',
    ...SIDEBAR_NOTES,
  ],
  params: [
    stringParam('table', 'The table the file tree is read from.', 'files'),
    stringParam('nameField', 'The text field naming each file or folder.', 'name'),
    stringParam(
      'parentField',
      'The relationship back to the same table naming the folder a record sits in.',
      'parent'
    ),
  ],
  tables: [
    {
      param: 'table',
      fields: [
        { name: 'name', param: 'nameField', type: 'single-line-text' },
        { name: 'parent', param: 'parentField', type: 'relationship' },
      ],
    },
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(
      name,
      sidebarLayout([
        sidebarFrame({
          type: 'sidebar',
          drawer: { below: 'md', label: 'Menu' },
          props: { className: 'min-h-0 flex-1 overflow-y-auto' },
          groups: [
            {
              label: 'Changes',
              items: CHANGES.map(([file, state]) => ({
                label: file,
                href: `/files/${file.replaceAll('/', '-').replaceAll('.', '-').toLowerCase()}`,
                icon: 'file',
                badge: state,
              })),
            },
          ],
          children: [filesNav(p('table'), p('nameField'), p('parentField'))],
        }),
        sidebarInset([
          insetHeader([
            crumbs([['components', '/components'], ['ui', '/components/ui'], ['button.tsx']]),
          ]),
          placeholderContent(),
        ]),
      ])
    )
  },
})
