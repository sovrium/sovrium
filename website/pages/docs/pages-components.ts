/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { badgeGroup, docsPage } from './shared'

export const docsPages = docsPage({
  activeId: 'pages',
  path: '/docs/pages',
  metaTitle: '$t:docs.pages.meta.title',
  metaDescription: '$t:docs.pages.meta.description',
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.pages.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.pages.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },
      ],
    },

    // ── Page Structure ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.pages.structure.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          $ref: 'docs-code-block',
          vars: {
            code: 'pages:\n  - name: home\n    path: /\n    meta:\n      title: "My App - Home"\n      description: "Welcome to my application"\n      openGraph:\n        title: "My App"\n        description: "A Sovrium-powered application"\n        image: "/og-image.png"\n    sections:\n      - type: section\n        props:\n          className: "py-20 bg-gray-900"\n        children:\n          - type: h1\n            content: "Welcome"\n          - type: paragraph\n            content: "Built with Sovrium"',
          },
        },
      ],
    },

    // ── Component Types ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.pages.componentTypes.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.pages.componentTypes.description',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mb-4',
          },
        },
        badgeGroup('$t:docs.pages.componentTypes.layout', [
          'section',
          'container',
          'flex',
          'grid',
          'div',
          'span',
          'header',
          'footer',
          'nav',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.typography', [
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'paragraph',
          'blockquote',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.navActions', [
          'link',
          'button',
          'breadcrumb',
          'pagination',
          'dropdown',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.media', [
          'image',
          'video',
          'audio',
          'icon',
          'iframe',
          'embed',
          'figure',
          'figcaption',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.formElements', [
          'form',
          'input',
          'textarea',
          'select',
          'option',
          'label',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.dataDisplay', [
          'table',
          'thead',
          'tbody',
          'tfoot',
          'tr',
          'th',
          'td',
          'ul',
          'ol',
          'li',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.interactive', [
          'accordion',
          'tabs',
          'tab',
          'modal',
          'tooltip',
          'progress',
          'rating',
        ]),
        badgeGroup('$t:docs.pages.componentTypes.display', [
          'card',
          'badge',
          'separator',
          'banner',
          'hero',
          'marquee',
          'avatar',
          'hr',
        ]),
      ],
    },

    // ── Interactions ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.pages.interactions.title',
          props: {
            className: 'text-xl font-semibold mb-3 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.pages.interactions.description',
          props: {
            className: 'text-sm text-sovereignty-gray-400 mb-4',
          },
        },
      ],
    },
  ],
})
