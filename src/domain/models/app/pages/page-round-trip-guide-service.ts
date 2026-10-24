/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page import's own three TABLES — what a round trip through a drawing
 * carries back into the config, what it keeps, and what it refuses — and the
 * guide a Claude Design canvas carries, generated from them.
 *
 * The tables are published in the bundle's `pages/node-map.json` and rendered
 * as the project's `SOVRIUM.md`, so a designer, or an agent editing the canvas,
 * reads the import's own rules before editing and a new importable edit
 * reaches the guide with no hand edit. Every refusal code the import reports
 * has its row.
 *
 * Pure: the same tables always render the same bytes.
 */

import { escapeMarkdownTableCell } from '@/domain/kernel/markdown/markdown-escaping'
import type { PageNodeMap } from '@/domain/models/api/admin/design-system/page-node-map'

/** The three tables, as the node map publishes them. */
type PageRoundTripTables = NonNullable<PageNodeMap['roundTrip']>

/** The guide's file name, in the Claude Design project. */
export const ROUND_TRIP_GUIDE_FILE = 'SOVRIUM.md'

/** What a round trip through a drawing carries, keeps and refuses. */
export const PAGE_ROUND_TRIP_TABLES: PageRoundTripTables = {
  carried: [
    {
      edit: 'A node moved among its siblings, or to another parent on the same page',
      outcome: 'Written as a move; its bindings, rules and interactions go with it',
    },
    { edit: 'A node deleted', outcome: 'Removed from the page' },
    {
      edit: 'A new node drawn with a kit component (`data-kit`)',
      outcome:
        'Added with the rules drawn on it (`data-sovrium-*`), and named in the report; one naming what the config does not declare is refused and left out',
    },
    {
      edit: 'A variant or a size (`data-kit-variant`, `data-kit-size`)',
      outcome: "Written as drawn; a badge's tone as its `badgeVariant`",
    },
    {
      edit: "A container's gap, padding, direction, alignment or width, on the spacing scale, set in its inline `style`, its `class` list or its `data-kit-layout`",
      outcome:
        'Written as the utility class of its token (`gap-6`); the inline style wins over the class list, and the class list over `data-kit-layout`',
    },
    {
      edit: 'A breakpoint-prefixed class (`md:gap-12`)',
      outcome: 'Written to that breakpoint of the page',
    },
    {
      edit: 'A colour or a text size equal to one of your tokens, by value or as its `var(--…)`',
      outcome: "Written as the token's class: `bg-muted`, `text-primary`, `text-lead`",
    },
    { edit: 'Literal text (`data-kit-content`)', outcome: 'Written as drawn' },
    {
      edit: 'Translated text (a `$t:` key)',
      outcome: "Written to your default language's entry for that key; the page keeps the key",
    },
    {
      edit: 'A value a template placement passes as one text input',
      outcome: "Written as that placement's `vars.<input>`",
    },
    {
      edit: 'An edited `data-sovrium-bind`, `data-sovrium-visible`, `data-sovrium-source` or `data-sovrium-form`',
      outcome: "Written as that node's binding, `visibility`, `dataSource` or `formRef`",
    },
    {
      edit: 'A `data-sovrium-href` on a button',
      outcome: 'Written as its `navigate` action to that page',
    },
    {
      edit: 'A board drawing a page the config does not declare, imported with `--new-pages`',
      outcome:
        "A new page named after its root's `data-sovrium-page`, at its root's `data-sovrium-path` (else `/<name>`), with the access of the page its `data-sovrium-like` names, appended to a TypeScript config's `pages` literal",
    },
    {
      edit: "A colour changed in the canvas's Theme menu, imported with `--tokens`",
      outcome: '`design.colors` of a JSON or YAML config; reported for a TypeScript one',
    },
  ],
  kept: [
    {
      edit: 'A length off the spacing scale (`gap-[13px]`, `padding: 13px`)',
      outcome: 'Reported with the nearest spacing token, never written',
    },
    {
      edit: 'A colour or a text size no token holds',
      outcome: 'Reported with the nearest token, never written',
    },
    {
      edit: 'A class or a style the import does not read (`italic`, a border)',
      outcome: 'Named on its node, never written',
    },
    {
      edit: 'The sample text a bound node draws',
      outcome: 'Never read as copy; edit its `data-sovrium-bind` instead',
    },
    {
      edit: "What an island draws inside (a table's rows)",
      outcome: 'Not read; only its box is',
    },
    {
      edit: 'A board drawing a page the config does not declare, without `--new-pages`',
      outcome: 'Skipped and named',
    },
  ],
  refused: [
    {
      edit: 'Text a binding fills (`$record.*`, `$currentUser.*`), edited on the board',
      outcome: 'Refused, `BINDING_EDIT`; the binding stays',
    },
    {
      edit: 'Anything inside a template, a library block or an expanded reference',
      outcome: "Refused, `TEMPLATE_EDIT_OUT_OF_SCOPE`; the placement's own values are written",
    },
    {
      edit: "A layer that is no kit component, or an element wrapping a node's text (a `<span>`)",
      outcome: 'Refused, `NOT_A_KIT_COMPONENT`, by name; the kit components inside it are read',
    },
    {
      edit: 'The page path, or its title and meta',
      outcome: 'Refused, `PAGE_SETTINGS_EDIT`',
    },
    {
      edit: "A new node missing a value its component requires (a collapsible's label)",
      outcome: 'Refused, `REQUIRED_VALUE_MISSING`',
    },
    {
      edit: "In a TypeScript config, an edit to a computed value (a helper's return, a template, an imported constant)",
      outcome: 'Refused, `NOT_A_LITERAL`, naming the file and line to change by hand',
    },
    {
      edit: 'A rule or a link naming a table, a field, a form or a page the config does not declare',
      outcome: 'Refused, `UNDECLARED_REFERENCE`, naming it',
    },
  ],
}

/** One table of the guide, as Markdown. */
const tableOf = (rows: PageRoundTripTables['carried']): readonly string[] => [
  '| On the board | What the import does |',
  '| --- | --- |',
  ...rows.map(
    (row) => `| ${escapeMarkdownTableCell(row.edit)} | ${escapeMarkdownTableCell(row.outcome)} |`
  ),
]

/**
 * The round-trip guide a Claude Design canvas carries, as Markdown.
 *
 * @param tables - the import's carried, kept and refused tables.
 */
export const roundTripGuideOf = (tables: PageRoundTripTables): string =>
  [
    '# Bringing this canvas back into Sovrium',
    '',
    'Every board on this canvas is a page of a Sovrium app. Edit a board, then bring it back with:',
    '',
    '```sh',
    'sovrium design-system import <canvas folder> --pages --config <app config> --dry-run --json',
    '```',
    '',
    'The dry run gives one verdict per board: the nodes whose edit it carries, keeps and refuses. Fix what it refuses, then run it again with `--write`.',
    '',
    "A component's `data-sovrium-*` attributes hold what it does, in the app config's own words: change the attribute to change the rule, and leave the text a bound component draws as it is, since it is a sample.",
    '',
    '## Carried back into the config',
    '',
    ...tableOf(tables.carried),
    '',
    '## Kept as the config has it, and reported',
    '',
    ...tableOf(tables.kept),
    '',
    '## Refused, and reported with its reason',
    '',
    ...tableOf(tables.refused),
    '',
    'Anything new in kind — a table, a field, a form, an automation, a component outside the kit — is made in the app config, not on the canvas.',
    '',
  ].join('\n')
