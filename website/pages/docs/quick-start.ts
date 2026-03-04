/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, docsPage, sectionHeader, step, stepCodeBlock } from './shared'

// ─── Code Snippets ──────────────────────────────────────────────────────────

const yamlMinimal = 'name: my-app'

const yamlWithTables = [
  'name: my-app',
  '',
  'tables:',
  '  - id: 1',
  '    name: tasks',
  '    fields:',
  '      - id: 1',
  '        name: title',
  '        type: single-line-text',
  '        required: true',
  '      - id: 2',
  '        name: status',
  '        type: single-select',
  '        options:',
  '          - label: To Do',
  '            color: gray',
  '          - label: In Progress',
  '            color: blue',
  '          - label: Done',
  '            color: green',
].join('\n')

const tsMinimal = [
  "import { start } from 'sovrium'",
  '',
  'await start({',
  "  name: 'my-app',",
  '})',
].join('\n')

const tsWithTables = [
  "import { start } from 'sovrium'",
  '',
  'await start({',
  "  name: 'my-app',",
  '  tables: [',
  '    {',
  '      id: 1,',
  "      name: 'tasks',",
  '      fields: [',
  '        {',
  '          id: 1,',
  "          name: 'title',",
  "          type: 'single-line-text',",
  '          required: true,',
  '        },',
  '        {',
  '          id: 2,',
  "          name: 'status',",
  "          type: 'single-select',",
  '          options: [',
  "            { label: 'To Do', color: 'gray' },",
  "            { label: 'In Progress', color: 'blue' },",
  "            { label: 'Done', color: 'green' },",
  '          ],',
  '        },',
  '      ],',
  '    },',
  '  ],',
  '})',
].join('\n')

const tsInitCmd = 'bun init my-app && cd my-app'

const tsAddCmd = 'bun add sovrium'

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsQuickStart = docsPage({
  activeId: 'quick-start',
  path: '/docs/quick-start',
  metaTitle: '$t:docs.quickStart.meta.title',
  metaDescription: '$t:docs.quickStart.meta.description',
  keywords: 'sovrium, quick start, tutorial, YAML, JSON, first app, configuration example',
  toc: [
    {
      label: '$t:docs.quickStart.chooseApproach',
      anchor: 'choose-approach',
      children: [
        { label: '$t:docs.quickStart.yaml.title', anchor: 'option-yaml' },
        { label: '$t:docs.quickStart.ts.title', anchor: 'option-typescript' },
      ],
    },
    { label: '$t:docs.quickStart.whatsNext.title', anchor: 'whats-next' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.quickStart.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.quickStart.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Choose Your Approach ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.quickStart.chooseApproach',
          '$t:docs.quickStart.chooseApproach.description',
          'choose-approach'
        ),
      ],
    },

    // ── Option A: YAML + CLI ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h3',
          content: '$t:docs.quickStart.yaml.title',
          props: {
            id: 'option-yaml',
            className: 'text-xl font-bold mb-2 text-sovereignty-light',
            style: 'scroll-margin-top:5rem',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.quickStart.yaml.description',
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
        },

        // Step 1
        step(
          '1',
          '$t:docs.quickStart.yaml.step1.title',
          '$t:docs.quickStart.yaml.step1.description'
        ),
        stepCodeBlock('bun add -g sovrium', 'bash'),

        // Step 2
        step(
          '2',
          '$t:docs.quickStart.yaml.step2.title',
          '$t:docs.quickStart.yaml.step2.description'
        ),
        stepCodeBlock(yamlMinimal, 'yaml'),

        // Step 3
        step(
          '3',
          '$t:docs.quickStart.yaml.step3.title',
          '$t:docs.quickStart.yaml.step3.description'
        ),
        stepCodeBlock(yamlWithTables, 'yaml'),

        // Step 4
        step(
          '4',
          '$t:docs.quickStart.yaml.step4.title',
          '$t:docs.quickStart.yaml.step4.description'
        ),
        stepCodeBlock('sovrium start app.yaml', 'bash'),

        calloutTip('$t:docs.quickStart.tip.title', '$t:docs.quickStart.tip.body'),
      ],
    },

    // ── Option B: TypeScript + Bun ──────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h3',
          content: '$t:docs.quickStart.ts.title',
          props: {
            id: 'option-typescript',
            className: 'text-xl font-bold mb-2 text-sovereignty-light',
            style: 'scroll-margin-top:5rem',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.quickStart.ts.description',
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
        },

        // Step 1
        step('1', '$t:docs.quickStart.ts.step1.title', '$t:docs.quickStart.ts.step1.description'),
        stepCodeBlock(tsInitCmd, 'bash'),

        // Step 2
        step('2', '$t:docs.quickStart.ts.step2.title', '$t:docs.quickStart.ts.step2.description'),
        stepCodeBlock(tsAddCmd, 'bash'),

        // Step 3
        step('3', '$t:docs.quickStart.ts.step3.title', '$t:docs.quickStart.ts.step3.description'),
        stepCodeBlock(tsMinimal, 'typescript'),

        // Step 4
        step('4', '$t:docs.quickStart.ts.step4.title', '$t:docs.quickStart.ts.step4.description'),
        stepCodeBlock(tsWithTables, 'typescript'),

        // Step 5
        step('5', '$t:docs.quickStart.ts.step5.title', '$t:docs.quickStart.ts.step5.description'),
        stepCodeBlock('bun run index.ts', 'bash'),

        calloutTip('$t:docs.quickStart.ts.tip.title', '$t:docs.quickStart.ts.tip.body'),
      ],
    },

    // ── What's Next? ────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.quickStart.whatsNext.title',
          '$t:docs.quickStart.whatsNext.description',
          'whats-next'
        ),
        {
          type: 'div',
          props: { className: 'space-y-2 mt-4' },
          children: [
            {
              type: 'link',
              content: '$t:docs.quickStart.whatsNext.overview',
              props: {
                href: '$t:docs.sidebar.overview.href',
                className:
                  'block text-sm text-sovereignty-gray-300 hover:text-sovereignty-accent transition-colors py-1',
              },
            },
            {
              type: 'link',
              content: '$t:docs.quickStart.whatsNext.tables',
              props: {
                href: '$t:docs.sidebar.tables.href',
                className:
                  'block text-sm text-sovereignty-gray-300 hover:text-sovereignty-accent transition-colors py-1',
              },
            },
            {
              type: 'link',
              content: '$t:docs.quickStart.whatsNext.theme',
              props: {
                href: '$t:docs.sidebar.theme.href',
                className:
                  'block text-sm text-sovereignty-gray-300 hover:text-sovereignty-accent transition-colors py-1',
              },
            },
            {
              type: 'link',
              content: '$t:docs.quickStart.whatsNext.pages',
              props: {
                href: '$t:docs.sidebar.pages.href',
                className:
                  'block text-sm text-sovereignty-gray-300 hover:text-sovereignty-accent transition-colors py-1',
              },
            },
          ],
        },
      ],
    },
  ],
})
