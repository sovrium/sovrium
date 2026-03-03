/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { badgeGroup, codeBlock, docsPage, sectionHeader } from './shared'

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
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.pages.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Page Structure ───────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.structure.title',
          '$t:docs.pages.structure.description',
          'page-structure'
        ),
        codeBlock(
          'pages:\n  - name: home\n    path: /\n    meta:\n      title: "My App - Home"\n      description: "Welcome to my application"\n      openGraph:\n        title: "My App"\n        description: "A Sovrium-powered application"\n        image: "/og-image.png"\n    sections:\n      - type: section\n        props:\n          className: "py-20 bg-gray-900"\n        children:\n          - type: h1\n            content: "Welcome"\n          - type: paragraph\n            content: "Built with Sovrium"',
          'yaml'
        ),
      ],
    },

    // ── Screenshot: Page Output Example ────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          $ref: 'docs-screenshot',
          vars: {
            src: '/docs/screenshots/app-hero-section.png',
            alt: '$t:docs.pages.screenshot.hero.alt',
            caption: '$t:docs.pages.screenshot.hero.caption',
          },
        },
        {
          $ref: 'docs-screenshot',
          vars: {
            src: '/docs/screenshots/app-features-section.png',
            alt: '$t:docs.pages.screenshot.features.alt',
            caption: '$t:docs.pages.screenshot.features.caption',
          },
        },
      ],
    },

    // ── Component Types ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.componentTypes.title',
          '$t:docs.pages.componentTypes.description',
          'component-types'
        ),

        // Layout
        {
          type: 'paragraph',
          content: '$t:docs.pages.componentTypes.layout.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
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
        codeBlock(
          'sections:\n  - type: section\n    props:\n      className: "py-20 bg-gray-900"\n    children:\n      - type: container\n        props:\n          className: "max-w-4xl mx-auto px-4"\n        children:\n          - type: grid\n            props:\n              className: "grid grid-cols-3 gap-8"',
          'yaml'
        ),

        // Typography
        {
          type: 'paragraph',
          content: '$t:docs.pages.componentTypes.typography.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
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

        // Media
        {
          type: 'paragraph',
          content: '$t:docs.pages.componentTypes.media.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
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
        codeBlock(
          'children:\n  - type: image\n    props:\n      src: "/hero.jpg"\n      alt: "Hero image"\n      className: "w-full rounded-lg"',
          'yaml'
        ),

        // Interactive
        {
          type: 'paragraph',
          content: '$t:docs.pages.componentTypes.interactive.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2 mt-6' },
        },
        badgeGroup('$t:docs.pages.componentTypes.interactive', [
          'accordion',
          'tabs',
          'tab',
          'modal',
          'tooltip',
          'progress',
          'rating',
        ]),

        // Remaining categories
        badgeGroup('$t:docs.pages.componentTypes.navActions', [
          'link',
          'button',
          'breadcrumb',
          'pagination',
          'dropdown',
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
        sectionHeader(
          '$t:docs.pages.interactions.title',
          '$t:docs.pages.interactions.description',
          'interactions'
        ),
        codeBlock(
          'children:\n  - type: button\n    content: "Get Started"\n    props:\n      className: "bg-blue-600 text-white px-6 py-3 rounded-lg"\n    interactions:\n      hover:\n        scale: 1.05\n        shadow: "0 10px 30px rgba(59, 130, 246, 0.3)"\n      click:\n        action: navigate\n        target: "/signup"',
          'yaml'
        ),
        {
          type: 'grid',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6' },
          children: [
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.hover.title',
                description: '$t:docs.pages.interactions.hover.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.click.title',
                description: '$t:docs.pages.interactions.click.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.scroll.title',
                description: '$t:docs.pages.interactions.scroll.description',
              },
            },
            {
              $ref: 'docs-info-card',
              vars: {
                title: '$t:docs.pages.interactions.entrance.title',
                description: '$t:docs.pages.interactions.entrance.description',
              },
            },
          ],
        },
      ],
    },

    // ── Component Templates ──────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.pages.templates.title',
          '$t:docs.pages.templates.description',
          'templates'
        ),
        codeBlock(
          '# Define reusable templates\ncomponents:\n  - name: feature-card\n    type: div\n    props:\n      className: "p-6 rounded-lg border"\n    children:\n      - type: h3\n        content: "$title"\n      - type: paragraph\n        content: "$description"\n\n# Use with $ref\npages:\n  - name: home\n    path: /\n    sections:\n      - type: section\n        children:\n          - $ref: feature-card\n            vars:\n              title: "Fast"\n              description: "Built for speed"',
          'yaml'
        ),
      ],
    },
  ],
})
