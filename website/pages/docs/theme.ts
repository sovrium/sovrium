/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { docsPage } from './shared'

export const docsTheme = docsPage({
  activeId: 'theme',
  path: '/docs/theme',
  metaTitle: '$t:docs.theme.meta.title',
  metaDescription: '$t:docs.theme.meta.description',
  content: [
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.theme.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.theme.description',
          props: { className: 'text-sovereignty-gray-400 mb-8' },
        },
        {
          type: 'grid',
          props: {
            className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8',
          },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.colors.title',
                description: '$t:docs.theme.colors.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.fonts.title',
                description: '$t:docs.theme.fonts.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.spacing.title',
                description: '$t:docs.theme.spacing.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.shadows.title',
                description: '$t:docs.theme.shadows.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.animations.title',
                description: '$t:docs.theme.animations.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.breakpoints.title',
                description: '$t:docs.theme.breakpoints.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.theme.borderRadius.title',
                description: '$t:docs.theme.borderRadius.description',
              },
            },
          ],
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'theme:\n  colors:\n    primary: "#3b82f6"\n    secondary: "#8b5cf6"\n    background: "#0a0e1a"\n    text: "#e8ecf4"\n  fonts:\n    heading:\n      family: Inter\n      weights: [600, 700]\n      lineHeight: "1.2"\n    body:\n      family: Inter\n      size: "16px"\n  spacing:\n    container: "max-w-7xl mx-auto px-4"\n    section: "py-16 sm:py-20"\n  shadows:\n    card: "0 4px 6px rgba(0, 0, 0, 0.1)"',
          },
        },
      ],
    },
  ],
})
