/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, sectionHeader } from './shared'

// ─── Helper: File Card ──────────────────────────────────────────────────────
// Renders a card for a single LLM file with description, URL, metadata, and
// optionally a grid of contained topics.

function fileCard(opts: {
  readonly anchor: string
  readonly name: string
  readonly description: string
  readonly url: string
  readonly sizeText: string
  readonly sizeIcon: string
  readonly useCaseText: string
  readonly useCaseIcon: string
  readonly topics?: readonly string[]
}) {
  const metaRows = [
    {
      icon: opts.sizeIcon,
      text: opts.sizeText,
    },
    {
      icon: opts.useCaseIcon,
      text: opts.useCaseText,
    },
  ]

  const children: Record<string, unknown>[] = [
    // File name heading
    {
      type: 'h3' as const,
      content: opts.name,
      props: {
        id: opts.anchor,
        className: 'text-lg font-semibold text-sovereignty-light mb-1 scroll-mt-24',
      },
    },
    // Description
    {
      type: 'paragraph' as const,
      content: opts.description,
      props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed mb-3' },
    },
    // URL
    codeBlock(opts.url, 'text'),
    // Size & use-case metadata
    {
      type: 'div' as const,
      props: { className: 'space-y-2 mt-3' },
      children: metaRows.map((row) => ({
        type: 'div' as const,
        props: { className: 'flex items-start gap-3' },
        children: [
          {
            type: 'icon' as const,
            props: {
              name: row.icon,
              size: 16,
              className: 'text-sovereignty-accent mt-0.5 flex-shrink-0',
            },
          },
          {
            type: 'paragraph' as const,
            content: row.text,
            props: { className: 'text-sm text-sovereignty-gray-300' },
          },
        ],
      })),
    },
  ]

  // Optional topics grid
  if (opts.topics) {
    children.push({
      type: 'div' as const,
      props: {
        className:
          'grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 p-4 rounded-lg border border-sovereignty-gray-800 bg-sovereignty-gray-900/30',
      },
      children: opts.topics.map((item) => ({
        type: 'div' as const,
        props: { className: 'flex items-center gap-2' },
        children: [
          {
            type: 'icon' as const,
            props: {
              name: 'check',
              size: 14,
              className: 'text-sovereignty-accent flex-shrink-0',
            },
          },
          {
            type: 'span' as const,
            content: item,
            props: { className: 'text-sm text-sovereignty-gray-300' },
          },
        ],
      })),
    })
  }

  return {
    type: 'div' as const,
    props: {
      className: 'p-5 rounded-lg border border-sovereignty-gray-800 bg-sovereignty-gray-900/30',
    },
    children,
  }
}

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsLlmReference = docsPage({
  activeId: 'llm-reference',
  path: '/docs/llm-reference',
  metaTitle: '$t:docs.llmReference.meta.title',
  metaDescription: '$t:docs.llmReference.meta.description',
  keywords:
    'sovrium, LLM, llms.txt, AI, large language model, machine-readable documentation, Claude, GPT, Copilot, AI integration, llms-full.txt',
  toc: [
    { label: '$t:docs.llmReference.whatIs.title', anchor: 'what-is-llms-txt' },
    {
      label: '$t:docs.llmReference.files.title',
      anchor: 'files',
      children: [
        { label: 'llms.txt', anchor: 'llms-txt' },
        { label: 'llms-full.txt', anchor: 'llms-full-txt' },
      ],
    },
    { label: '$t:docs.llmReference.usage.title', anchor: 'usage' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.llmReference.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.llmReference.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Quick Download CTA ────────────────────────────────────────────────
    {
      type: 'div',
      props: {
        className:
          'flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 rounded-lg border border-sovereignty-accent/30 bg-sovereignty-accent/5',
      },
      children: [
        {
          type: 'div',
          props: { className: 'flex-1' },
          children: [
            {
              type: 'h3',
              content: '$t:docs.llmReference.cta.title',
              props: { className: 'text-base font-semibold text-sovereignty-light mb-1' },
            },
            {
              type: 'paragraph',
              content: '$t:docs.llmReference.cta.description',
              props: { className: 'text-sm text-sovereignty-gray-400' },
            },
          ],
        },
        {
          type: 'div',
          props: { className: 'flex gap-3 shrink-0' },
          children: [
            {
              type: 'link',
              props: {
                href: '/llms.txt',
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sovereignty-accent text-white font-medium text-sm hover:bg-sovereignty-accent/90 transition-colors',
              },
              children: [
                { type: 'span', content: 'llms.txt', props: {} },
                { type: 'span', content: '\u2197', props: { className: 'text-xs' } },
              ],
            },
            {
              type: 'link',
              props: {
                href: '/llms-full.txt',
                target: '_blank',
                rel: 'noopener noreferrer',
                className:
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-sovereignty-gray-700 text-sovereignty-light font-medium text-sm hover:border-sovereignty-accent/50 hover:bg-sovereignty-accent/5 transition-colors',
              },
              children: [
                { type: 'span', content: 'llms-full.txt', props: {} },
                { type: 'span', content: '\u2197', props: { className: 'text-xs' } },
              ],
            },
          ],
        },
      ],
    },

    // ── What is llms.txt? ─────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.llmReference.whatIs.title',
          '$t:docs.llmReference.whatIs.description',
          'what-is-llms-txt'
        ),
        {
          type: 'paragraph',
          content: '$t:docs.llmReference.whatIs.body',
          props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed' },
        },
      ],
    },

    // ── Files ─────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.llmReference.files.title',
          '$t:docs.llmReference.files.description',
          'files'
        ),
        {
          type: 'div',
          props: { className: 'space-y-6' },
          children: [
            fileCard({
              anchor: 'llms-txt',
              name: 'llms.txt',
              description: '$t:docs.llmReference.files.quick.description',
              url: 'https://sovrium.com/llms.txt',
              sizeIcon: 'file-text',
              sizeText: '$t:docs.llmReference.files.quick.size',
              useCaseIcon: 'zap',
              useCaseText: '$t:docs.llmReference.files.quick.usecase',
            }),
            fileCard({
              anchor: 'llms-full-txt',
              name: 'llms-full.txt',
              description: '$t:docs.llmReference.files.full.description',
              url: 'https://sovrium.com/llms-full.txt',
              sizeIcon: 'file-text',
              sizeText: '$t:docs.llmReference.files.full.size',
              useCaseIcon: 'brain',
              useCaseText: '$t:docs.llmReference.files.full.usecase',
              topics: [
                'Getting Started guides',
                'Schema Overview & Root Properties',
                'All 41 Field Types',
                'All 62 Component Types',
                'Authentication configuration',
                'Theme & design tokens',
                'Pages & interactions',
                'Languages & i18n',
                'Analytics configuration',
                'API Reference (60+ endpoints)',
                'Complete YAML examples',
                'JSON Schema reference',
              ],
            }),
          ],
        },
        // Version note
        {
          type: 'div',
          props: { className: 'mt-4' },
          children: [
            calloutTip(
              '$t:docs.llmReference.contents.version.title',
              '$t:docs.llmReference.contents.version.body'
            ),
          ],
        },
      ],
    },

    // ── Usage with AI Tools ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.llmReference.usage.title',
          '$t:docs.llmReference.usage.description',
          'usage'
        ),
        {
          type: 'div',
          props: { className: 'space-y-4' },
          children: [
            {
              type: 'paragraph',
              content: '$t:docs.llmReference.usage.fetch',
              props: { className: 'text-sm text-sovereignty-gray-300 font-medium' },
            },
            codeBlock(
              [
                '# Quick reference (~40 lines)',
                'curl https://sovrium.com/llms.txt',
                '',
                '# Complete documentation (~2700 lines)',
                'curl https://sovrium.com/llms-full.txt',
              ].join('\n'),
              'bash'
            ),
            {
              type: 'paragraph',
              content: '$t:docs.llmReference.usage.chatPrompt',
              props: {
                className: 'text-sm text-sovereignty-gray-300 font-medium mt-4',
              },
            },
            codeBlock(
              [
                'Read the Sovrium documentation from https://sovrium.com/llms-full.txt',
                'and help me create an app.yaml configuration for a blog with:',
                '- A posts table with title, content, and published_at fields',
                '- Email/password authentication',
                '- A homepage with a list of recent posts',
              ].join('\n'),
              'text'
            ),
            calloutTip(
              '$t:docs.llmReference.usage.tip.title',
              '$t:docs.llmReference.usage.tip.body'
            ),
          ],
        },
      ],
    },
  ],
})
