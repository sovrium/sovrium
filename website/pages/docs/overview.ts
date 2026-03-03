/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, step, stepCodeBlock } from './shared'

export const docsOverview = docsPage({
  activeId: 'overview',
  path: '/docs',
  metaTitle: '$t:docs.meta.title',
  metaDescription: '$t:docs.meta.description',
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
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
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
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
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
        },

        // Step 1
        step('1', '$t:docs.quickStart.step1.title', '$t:docs.quickStart.step1.description'),
        stepCodeBlock('name: my-app', 'yaml'),

        // Step 2
        step('2', '$t:docs.quickStart.step2.title', '$t:docs.quickStart.step2.description'),
        stepCodeBlock(
          'name: my-app\n\ntables:\n  - id: 1\n    name: tasks\n    fields:\n      - id: 1\n        name: title\n        type: single-line-text\n        required: true\n      - id: 2\n        name: status\n        type: single-select\n        options:\n          - label: To Do\n            color: gray\n          - label: In Progress\n            color: blue\n          - label: Done\n            color: green',
          'yaml'
        ),

        // Step 3
        step('3', '$t:docs.quickStart.step3.title', '$t:docs.quickStart.step3.description'),
        stepCodeBlock('sovrium start app.yaml', 'bash'),

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
          props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed mb-6' },
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
