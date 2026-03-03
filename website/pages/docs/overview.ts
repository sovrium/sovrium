/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, step } from './shared'

export const docsOverview = docsPage({
  activeId: 'overview',
  path: '/docs',
  metaTitle: '$t:docs.meta.title',
  metaDescription: '$t:docs.meta.description',
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: { className: 'mb-12' },
      children: [
        {
          type: 'div',
          props: { className: 'flex items-center gap-3 mb-6' },
          children: [
            {
              type: 'link',
              content: '$t:docs.header.backLink',
              props: {
                href: '/',
                className:
                  'text-sm text-sovereignty-gray-400 hover:text-sovereignty-accent transition-colors',
              },
            },
            {
              type: 'span',
              content: 'v0.0.2',
              props: {
                className:
                  'text-xs font-mono px-2 py-0.5 bg-sovereignty-gray-800 rounded text-sovereignty-gray-400',
              },
            },
          ],
        },
        {
          type: 'h1',
          content: '$t:docs.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.header.description',
          props: {
            className: 'text-lg text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Overview ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.overview.title',
          props: {
            className: 'text-2xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.overview.description',
          props: { className: 'text-sovereignty-gray-400 mb-8' },
        },
        codeBlock(
          'name: my-app                  # App identifier (required)\nversion: 1.0.0               # SemVer version\ndescription: My application   # One-line description\ntables: [...]                 # Data models with 40 field types\ntheme: {...}                  # Design tokens (colors, fonts, etc.)\npages: [...]                  # Server-rendered pages (62 component types)\nauth: {...}                   # Authentication & authorization\nlanguages: {...}              # Multi-language support ($t: syntax)\ncomponents: [...]             # Reusable UI templates ($ref, $variable)\nanalytics: {...}              # Privacy-friendly, cookie-free analytics',
          'yaml'
        ),
        calloutTip('$t:docs.overview.tip.title', '$t:docs.overview.tip.body'),
      ],
    },

    // ── Quick Start ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.quickStart.title',
          props: {
            className: 'text-2xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.quickStart.description',
          props: { className: 'text-sovereignty-gray-400 mb-6' },
        },

        // Step 1
        step('1', '$t:docs.quickStart.step1.title', '$t:docs.quickStart.step1.description'),
        codeBlock('name: my-app', 'yaml'),

        // Step 2
        step('2', '$t:docs.quickStart.step2.title', '$t:docs.quickStart.step2.description'),
        codeBlock(
          'name: my-app\n\ntables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: status\n        type: single-select\n        options:\n          - label: To Do\n            color: gray\n          - label: In Progress\n            color: blue\n          - label: Done\n            color: green',
          'yaml'
        ),

        // Step 3
        step('3', '$t:docs.quickStart.step3.title', '$t:docs.quickStart.step3.description'),
        codeBlock('sovrium start app.yaml', 'bash'),

        calloutTip('$t:docs.quickStart.tip.title', '$t:docs.quickStart.tip.body'),
      ],
    },

    // ── Root Properties ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h2',
          content: '$t:docs.rootProps.title',
          props: {
            className: 'text-2xl font-bold mb-2 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.rootProps.description',
          props: { className: 'text-sovereignty-gray-400 mb-8' },
        },
        {
          type: 'div',
          props: { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
          children: [
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'name',
                type: 'string',
                requiredClass: '',
                description: '$t:docs.rootProps.name.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'version',
                type: 'string',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.version.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'description',
                type: 'string',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.description.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'tables',
                type: 'array',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.tables.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'theme',
                type: 'object',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.theme.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'pages',
                type: 'array',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.pages.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'auth',
                type: 'object',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.auth.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'languages',
                type: 'object',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.languages.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'components',
                type: 'array',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.components.description',
              },
            },
            {
              $ref: 'docs-property-card',
              vars: {
                name: 'analytics',
                type: 'object | boolean',
                requiredClass: 'hidden',
                description: '$t:docs.rootProps.analytics.description',
              },
            },
          ],
        },
      ],
    },
  ],
})
