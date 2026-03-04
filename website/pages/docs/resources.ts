/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawVersion } from '../navbar'
import { docsPage } from './shared'

export const docsResources = docsPage({
  activeId: 'resources',
  path: '/docs/resources',
  metaTitle: '$t:docs.resources.meta.title',
  metaDescription: '$t:docs.resources.meta.description',
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.resources.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.resources.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Resource Cards ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'grid',
          props: {
            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
          },
          children: [
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.llmQuick.label',
                href: '/llms.txt',
                description: '$t:docs.resources.llmQuick.description',
              },
            },
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.llmFull.label',
                href: '/llms-full.txt',
                description: '$t:docs.resources.llmFull.description',
              },
            },
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.jsonSchema.label',
                href: `/schemas/${rawVersion}/app.schema.json`,
                description: '$t:docs.resources.jsonSchema.description',
              },
            },
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.schemaExplorer.label',
                href: `https://json-schema.app/view/%23?url=https%3A%2F%2Fsovrium.com%2Fschemas%2F${rawVersion}%2Fapp.schema.json`,
                description: '$t:docs.resources.schemaExplorer.description',
              },
            },
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.apiReference.label',
                href: '$t:docs.sidebar.apiReference.href',
                description: '$t:docs.resources.apiReference.description',
              },
            },
            {
              $ref: 'docs-resource-link',
              vars: {
                label: '$t:docs.resources.github.label',
                href: 'https://github.com/sovrium/sovrium',
                description: '$t:docs.resources.github.description',
              },
            },
          ],
        },
      ],
    },

    // ── Getting Help ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'div',
          props: {
            className: 'rounded-lg p-6 border border-sovereignty-gray-800 bg-sovereignty-gray-900',
          },
          children: [
            {
              type: 'h3',
              content: '$t:docs.resources.help.title',
              props: { className: 'text-lg font-semibold text-sovereignty-light mb-2' },
            },
            {
              type: 'paragraph',
              content: '$t:docs.resources.help.description',
              props: { className: 'text-sm text-sovereignty-gray-400 mb-4' },
            },
            {
              type: 'link',
              content: '$t:docs.resources.help.link',
              props: {
                href: 'https://github.com/sovrium/sovrium/issues',
                className: 'text-sm text-sovereignty-accent hover:underline font-medium',
              },
            },
          ],
        },
      ],
    },
  ],
})
