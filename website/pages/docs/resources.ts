/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { docsPage } from './shared'

export const docsResources = docsPage({
  activeId: 'resources',
  path: '/docs/resources',
  metaTitle: '$t:docs.resources.meta.title',
  metaDescription: '$t:docs.resources.meta.description',
  content: [
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.resources.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.resources.description',
          props: { className: 'text-sovereignty-gray-400 mb-8' },
        },
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
                href: '/schemas/0.0.2/app.schema.json',
                description: '$t:docs.resources.jsonSchema.description',
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
  ],
})
