/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { calloutTip, codeBlock, docsPage, propertyTable, sectionHeader } from './shared'

export const docsOverview = docsPage({
  activeId: 'overview',
  path: '/docs/overview',
  metaTitle: '$t:docs.overview.meta.title',
  metaDescription: '$t:docs.overview.meta.description',
  toc: [
    { label: '$t:docs.overview.details.title', anchor: 'property-details' },
    { label: '$t:docs.overview.formats.title', anchor: 'config-formats' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.overview.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.overview.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Schema Structure ────────────────────────────────────────────────
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
          'name: my-app                  # App identifier (required)\nversion: 1.0.0               # SemVer version\ndescription: My application   # One-line description\ntables: [...]                 # Data models with 41 field types\ntheme: {...}                  # Design tokens (colors, fonts, etc.)\npages: [...]                  # Server-rendered pages (62 component types)\nauth: {...}                   # Authentication & authorization\nlanguages: {...}              # Multi-language support ($t: syntax)\ncomponents: [...]             # Reusable UI templates ($ref, $variable)\nanalytics: {...}              # Privacy-friendly, cookie-free analytics',
          'yaml'
        ),
        calloutTip('$t:docs.overview.tip.title', '$t:docs.overview.tip.body'),
      ],
    },

    // ── Root Properties ─────────────────────────────────────────────────
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

    // ── Property Details ──────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.overview.details.title',
          '$t:docs.overview.details.description',
          'property-details'
        ),

        // name
        {
          type: 'h4',
          content: 'name',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-2 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.overview.details.name.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          { name: 'Pattern', description: '$t:docs.overview.details.name.pattern' },
          { name: 'Max length', description: '$t:docs.overview.details.name.maxLength' },
          { name: 'Scoped', description: '$t:docs.overview.details.name.scoped' },
        ]),
        codeBlock(
          '# Valid names\nname: my-app\nname: task-tracker-v2\nname: "@acme/dashboard"',
          'yaml'
        ),

        // version
        {
          type: 'h4',
          content: 'version',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.overview.details.version.description',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        codeBlock(
          'version: 1.0.0           # Stable release\nversion: 2.0.0-beta.1    # Pre-release\nversion: 1.0.0+build.42  # Build metadata',
          'yaml'
        ),

        // description
        {
          type: 'h4',
          content: 'description',
          props: {
            className: 'text-base font-semibold text-sovereignty-light mt-6 mb-2 font-mono',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.overview.details.description.body',
          props: { className: 'text-sm text-sovereignty-gray-400 mb-2' },
        },
        propertyTable([
          { name: 'Format', description: '$t:docs.overview.details.description.format' },
          { name: 'Max length', description: '$t:docs.overview.details.description.maxLength' },
          { name: 'Unicode', description: '$t:docs.overview.details.description.unicode' },
        ]),
      ],
    },

    // ── Configuration Formats ─────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.overview.formats.title',
          '$t:docs.overview.formats.description',
          'config-formats'
        ),
        codeBlock(
          '# YAML format (recommended)\nname: my-app\nversion: 1.0.0\ntables:\n  - id: 1\n    name: tasks\n    fields:\n      - { id: 1, name: title, type: single-line-text }',
          'yaml'
        ),
        codeBlock(
          '// JSON format\n{\n  "name": "my-app",\n  "version": "1.0.0",\n  "tables": [\n    {\n      "id": 1,\n      "name": "tasks",\n      "fields": [\n        { "id": 1, "name": "title", "type": "single-line-text" }\n      ]\n    }\n  ]\n}',
          'json'
        ),
        calloutTip('$t:docs.overview.formats.tip.title', '$t:docs.overview.formats.tip.body'),
      ],
    },
  ],
})
