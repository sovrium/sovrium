/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { docsPage } from './shared'

export const docsLanguages = docsPage({
  activeId: 'languages',
  path: '/docs/languages',
  metaTitle: '$t:docs.languages.meta.title',
  metaDescription: '$t:docs.languages.meta.description',
  content: [
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.languages.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.languages.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'languages:\n  default: en\n  supported:\n    - code: en\n      locale: en-US\n      label: English\n      direction: ltr\n    - code: fr\n      locale: fr-FR\n      label: "Fran\u00E7ais"\n      direction: ltr\n  translations:\n    en:\n      hero.title: "Welcome"\n      hero.description: "Build faster"\n    fr:\n      hero.title: "Bienvenue"\n      hero.description: "Construisez plus vite"',
          },
        },
        {
          type: 'div',
          props: {
            className:
              'bg-sovereignty-gray-900 border border-sovereignty-accent/30 p-4 rounded-lg mt-4',
          },
          children: [
            {
              type: 'h4',
              content: '$t:docs.languages.syntax.title',
              props: {
                className: 'text-sm font-semibold text-sovereignty-accent mb-2',
              },
            },
            {
              type: 'paragraph',
              content: '$t:docs.languages.syntax.description',
              props: {
                className: 'text-sm text-sovereignty-gray-300',
              },
            },
          ],
        },
      ],
    },
  ],
})
