/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `sidebar` — one navigation language, in the two places this product navigates.
//
// The console's chrome is a `sidebar`. So is the docs zone's column on the
// website, and so is the second column beside this very page. That is the type's
// whole claim: a reader crossing from the console to the documentation is still
// in one product, because the row geometry, the group heading, the current mark
// and the `aria-current` all come from one recipe rather than from three.
//
// Six renderings, at the width the console actually uses. Three are shapes the
// console asks for and three are shapes the docs zone asks for — and the docs
// three are produced by keys that do NOT live on this component. They live on
// the page's `contentDir.nav` block, which decides whether a collection renders
// grouped, zoned by tab, or collapsed into native disclosures; the sidebar is
// what each of those decisions produces. Each drawing below names the key.
//
// ─── ONE HONEST CAVEAT ABOUT THE DOCS THREE ────────────────────────────────
//
// They are drawn here as this component renders them, which is what the docs
// zone is moving TO. sovrium.com's documentation has not adopted this vocabulary
// yet: its current article is a left-barred row rather than a filled pill, its
// group labels and glyphs are its own, and a rule separates its groups. The
// behaviour is identical either way — what differs is only the paint, and
// closing that gap is in flight.
//
// ─── THE CURRENT MARK CANNOT BE DECLARED, AND THAT IS THE POINT ────────────
//
// `props` may only add attributes the renderer does not own, and the current
// mark is one it owns: it is computed server-side by matching the request path
// against each entry's `href` (`exact` by default, `prefix` where the row is a
// section), and the marked entry gets `aria-current="page"` from the renderer.
// Writing `aria-current` by hand is refused outright.
//
// So the only marked row on this page is one that genuinely addresses where the
// reader is: `Design` in the first drawing, with `activeMatch: 'prefix'`, which
// is current because you are inside `/design-system` right now. The other five
// drawings link nowhere real and are therefore unmarked — a specimen cannot
// pretend to be somewhere it is not, which is a better property than a drawing
// that always looks complete.
//
// ─── AND ONE THING THE TYPE DOES NOT HAVE ──────────────────────────────────
//
// There is no icon rail. Below the medium breakpoint the console's aside leaves
// the flow and the burger reveals it as a drawer over a backdrop, by class alone
// so it works before any island hydrates. That is the only collapsed state in
// the schema and in the renderer, and none is drawn here that is not.

import { SPECIMEN_ROWS_ENDPOINT } from '../../../system-sources'
import type { PageComponent, TypePageBody } from './body-shape'

/** The console aside's real geometry, minus the chrome that is not this type. */
const COLUMN = 'flex w-64 shrink-0 flex-col gap-4 rounded-md border border-border p-4'

const nav = (landmark: string, groups: readonly unknown[], className = COLUMN): PageComponent =>
  ({ type: 'sidebar', props: { className }, groups }) as PageComponent

const item = (label: string, href: string) => ({ label, href })

const sidebar: TypePageBody = {
  drawings: [
    {
      label: 'console · grouped',
      children: [
        nav('Console', [
          {
            label: 'Overview',
            landmark: 'Console',
            headingLevel: 2 as const,
            items: [item('Dashboard', '#dashboard')],
          },
          {
            label: 'Application',
            landmark: 'Console',
            headingLevel: 2 as const,
            items: [
              item('Records', '#records'),
              item('Submissions', '#submissions'),
              item('Files', '#files'),
            ],
          },
          {
            label: 'System',
            landmark: 'Console',
            headingLevel: 2 as const,
            items: [
              item('Automations', '#automations'),
              item('Users', '#users'),
              { label: 'Design', href: '/design-system', activeMatch: 'prefix' as const },
            ],
          },
        ]),
      ],
    },
    {
      label: 'console · expandable entry',
      children: [
        nav('Fetched', [
          {
            label: 'Application',
            landmark: 'Fetched',
            headingLevel: 2 as const,
            items: [
              {
                label: 'Records',
                href: '#fetched-records',
                defaultExpanded: true,
                source: {
                  endpoint: SPECIMEN_ROWS_ENDPOINT,
                  rowsKey: 'items',
                  query: { rows: '3' },
                  labelKey: 'name',
                  hrefTemplate: '#{id}',
                  loadingLabel: 'Loading…',
                  errorLabel: 'Couldn’t load the list.',
                  emptyLabel: 'No items.',
                },
              },
              item('Submissions', '#fetched-submissions'),
            ],
          },
        ]),
      ],
    },
    {
      label: 'console · mobile drawer',
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'bg-foreground/10 flex w-full justify-start rounded-md p-4',
          },
          children: [
            nav(
              'Drawer',
              [
                {
                  label: 'Application',
                  landmark: 'Drawer',
                  headingLevel: 2 as const,
                  items: [
                    item('Records', '#records'),
                    item('Submissions', '#submissions'),
                    item('Files', '#files'),
                  ],
                },
              ],
              `${COLUMN} bg-background-raised shadow-lg`
            ),
          ],
        } as PageComponent,
      ],
    },
    {
      label: 'docs · grouped',
      children: [
        nav('Docs', [
          {
            label: 'Get started',
            landmark: 'Docs',
            headingLevel: 2 as const,
            items: [item('Installation', '#installation'), item('Your first app', '#first-app')],
          },
          {
            label: 'Configuration',
            landmark: 'Docs',
            headingLevel: 2 as const,
            items: [
              item('Tables', '#tables'),
              item('Pages', '#pages'),
              item('Automations', '#docs-automations'),
            ],
          },
        ]),
      ],
    },
    {
      label: 'docs · zoned',
      children: [
        nav('Zone', [
          {
            label: 'Agents',
            landmark: 'Zone',
            headingLevel: 2 as const,
            items: [
              item('Tools', '#tools'),
              item('Conversations', '#conversations'),
              item('Knowledge', '#knowledge'),
            ],
          },
        ]),
      ],
    },
    {
      label: 'docs · collapsed',
      children: [
        nav('Collapsed', [
          {
            label: 'Sections',
            landmark: 'Collapsed',
            headingLevel: 2 as const,
            items: [
              {
                label: 'Get started',
                href: '#get-started',
                defaultExpanded: true,
                children: [
                  item('Installation', '#c-installation'),
                  item('Your first app', '#c-first-app'),
                ],
              },
              {
                label: 'Configuration',
                href: '#configuration',
                children: [item('Tables', '#c-tables'), item('Pages', '#c-pages')],
              },
            ],
          },
        ]),
      ],
    },
  ],
}

export default sidebar
