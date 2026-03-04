/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawVersion } from '../navbar'
import { calloutTip, codeBlock, docsPage, sectionHeader, subsectionHeader } from './shared'

// ─── Schema Explorer URL ────────────────────────────────────────────────────
// Use the `latest` alias for the explorer link so it always resolves to an existing
// schema file. The versioned URL (e.g., /schemas/0.1.1/) may not exist yet if the
// website is built after a version bump but before the sync-docs workflow deploys the
// new schema. The `latest` symlink is always kept in sync during deployment.

const explorerSchemaUrl = 'https://sovrium.com/schemas/latest/app.schema.json'
const encodedExplorerSchemaUrl = encodeURIComponent(explorerSchemaUrl)
const explorerUrl = `https://json-schema.app/view/%23?url=${encodedExplorerSchemaUrl}`

// ─── Schema Root Properties Preview ─────────────────────────────────────────

const schemaProperties = [
  { name: 'name', type: 'string', icon: 'tag' },
  { name: 'version', type: 'string', icon: 'git-branch' },
  { name: 'description', type: 'string', icon: 'file-text' },
  { name: 'tables', type: 'object[]', icon: 'table' },
  { name: 'theme', type: 'object', icon: 'palette' },
  { name: 'pages', type: 'object[]', icon: 'layout' },
  { name: 'auth', type: 'object', icon: 'shield' },
  { name: 'languages', type: 'object', icon: 'globe' },
  { name: 'components', type: 'object[]', icon: 'puzzle' },
  { name: 'analytics', type: 'object', icon: 'bar-chart-3' },
] as const

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsJsonSchema = docsPage({
  activeId: 'json-schema',
  path: '/docs/json-schema',
  metaTitle: '$t:docs.jsonSchema.meta.title',
  metaDescription: '$t:docs.jsonSchema.meta.description',
  toc: [
    { label: '$t:docs.jsonSchema.explorer.title', anchor: 'schema-explorer' },
    { label: '$t:docs.jsonSchema.urls.title', anchor: 'schema-urls' },
    {
      label: '$t:docs.jsonSchema.editor.title',
      anchor: 'editor-integration',
      children: [
        { label: 'VS Code', anchor: 'vscode' },
        { label: 'JetBrains', anchor: 'jetbrains' },
      ],
    },
    { label: '$t:docs.jsonSchema.versioning.title', anchor: 'versioning' },
    { label: '$t:docs.jsonSchema.validation.title', anchor: 'programmatic-validation' },
  ],
  content: [
    // ── Title ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.jsonSchema.title',
          props: {
            className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light',
          },
        },
        {
          type: 'paragraph',
          content: '$t:docs.jsonSchema.description',
          props: { className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed' },
        },
      ],
    },

    // ── Interactive Explorer CTA ─────────────────────────────────────────
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
              content: '$t:docs.jsonSchema.cta.title',
              props: { className: 'text-base font-semibold text-sovereignty-light mb-1' },
            },
            {
              type: 'paragraph',
              content: '$t:docs.jsonSchema.cta.description',
              props: { className: 'text-sm text-sovereignty-gray-400' },
            },
          ],
        },
        {
          type: 'link',
          props: {
            href: explorerUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sovereignty-accent text-white font-medium text-sm hover:bg-sovereignty-accent/90 transition-colors shrink-0',
          },
          children: [
            { type: 'span', content: '$t:docs.jsonSchema.cta.button', props: {} },
            {
              type: 'span',
              content: '\u2197',
              props: { className: 'text-xs' },
            },
          ],
        },
      ],
    },

    // ── Schema Explorer ─────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.jsonSchema.explorer.title',
          '$t:docs.jsonSchema.explorer.description',
          'schema-explorer'
        ),
        // Explorer preview card with schema structure + CTA
        {
          type: 'link',
          props: {
            href: explorerUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
            className:
              'group block rounded-lg border border-sovereignty-gray-800 hover:border-sovereignty-accent/50 bg-sovereignty-gray-900/50 overflow-hidden transition-all duration-300',
          },
          children: [
            // Top bar mimicking an app chrome
            {
              type: 'div',
              props: {
                className:
                  'flex items-center gap-2 px-4 py-2.5 bg-sovereignty-gray-900 border-b border-sovereignty-gray-800',
              },
              children: [
                {
                  type: 'icon',
                  props: {
                    name: 'braces',
                    size: 14,
                    className: 'text-sovereignty-accent',
                  },
                },
                {
                  type: 'span',
                  content: `app.schema.json v${rawVersion}`,
                  props: {
                    className: 'text-xs font-mono text-sovereignty-gray-400',
                  },
                },
                {
                  type: 'div',
                  props: { className: 'ml-auto' },
                  children: [
                    {
                      type: 'span',
                      props: {
                        className:
                          'inline-flex items-center gap-1.5 text-xs text-sovereignty-gray-400 group-hover:text-sovereignty-accent transition-colors',
                      },
                      children: [
                        {
                          type: 'span',
                          content: '$t:docs.jsonSchema.explorer.openFull',
                          props: {},
                        },
                        {
                          type: 'icon',
                          props: {
                            name: 'external-link',
                            size: 12,
                            className: 'opacity-70',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            // Schema structure preview
            {
              type: 'div',
              props: { className: 'p-5' },
              children: [
                // Root schema hint
                {
                  type: 'div',
                  props: { className: 'mb-4' },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.jsonSchema.explorer.rootTitle',
                      props: {
                        className:
                          'text-xs font-semibold uppercase tracking-wider text-sovereignty-gray-500',
                      },
                    },
                  ],
                },
                // Properties grid
                {
                  type: 'div',
                  props: { className: 'grid grid-cols-2 sm:grid-cols-5 gap-3' },
                  children: [
                    ...schemaProperties.map((prop) => ({
                      type: 'div' as const,
                      props: {
                        className:
                          'p-3 rounded-md border border-sovereignty-gray-800 bg-sovereignty-darker/50 group-hover:border-sovereignty-gray-700 transition-colors',
                      },
                      children: [
                        {
                          type: 'div' as const,
                          props: { className: 'flex items-center gap-1.5 mb-1' },
                          children: [
                            {
                              type: 'icon' as const,
                              props: {
                                name: prop.icon,
                                size: 12,
                                className: 'text-sovereignty-accent',
                              },
                            },
                            {
                              type: 'span' as const,
                              content: prop.name,
                              props: {
                                className: 'text-xs font-mono font-medium text-sovereignty-light',
                              },
                            },
                          ],
                        },
                        {
                          type: 'span' as const,
                          content: prop.type,
                          props: {
                            className: 'text-[10px] text-sovereignty-gray-500',
                          },
                        },
                      ],
                    })),
                  ],
                },
                // Bottom CTA hint
                {
                  type: 'div',
                  props: { className: 'mt-5 text-center' },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.jsonSchema.explorer.expandHint',
                      props: {
                        className:
                          'text-sm text-sovereignty-gray-400 group-hover:text-sovereignty-accent transition-colors',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Schema URLs ──────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.jsonSchema.urls.title',
          '$t:docs.jsonSchema.urls.description',
          'schema-urls'
        ),
        {
          type: 'div',
          props: {
            className: 'space-y-4',
          },
          children: [
            // Versioned URL
            {
              type: 'div',
              props: {},
              children: [
                {
                  type: 'h4',
                  content: '$t:docs.jsonSchema.urls.versioned.title',
                  props: {
                    className: 'text-sm font-semibold text-sovereignty-light mb-2',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.jsonSchema.urls.versioned.description',
                  props: {
                    className: 'text-sm text-sovereignty-gray-400 mb-2',
                  },
                },
                codeBlock(`https://sovrium.com/schemas/${rawVersion}/app.schema.json`, 'text'),
              ],
            },
            // Latest URL
            {
              type: 'div',
              props: {},
              children: [
                {
                  type: 'h4',
                  content: '$t:docs.jsonSchema.urls.latest.title',
                  props: {
                    className: 'text-sm font-semibold text-sovereignty-light mb-2',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.jsonSchema.urls.latest.description',
                  props: {
                    className: 'text-sm text-sovereignty-gray-400 mb-2',
                  },
                },
                codeBlock('https://sovrium.com/schemas/latest/app.schema.json', 'text'),
              ],
            },
            // Download link
            {
              type: 'div',
              props: { className: 'flex flex-wrap gap-4' },
              children: [
                {
                  type: 'link',
                  props: {
                    href: `/schemas/${rawVersion}/app.schema.json`,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'inline-flex items-center gap-2 text-sm text-sovereignty-accent hover:text-sovereignty-accent/80 transition-colors',
                  },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.jsonSchema.urls.download.versioned',
                      props: {},
                    },
                    { type: 'span', content: '\u2197', props: { className: 'text-xs' } },
                  ],
                },
                {
                  type: 'link',
                  props: {
                    href: '/schemas/latest/app.schema.json',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className:
                      'inline-flex items-center gap-2 text-sm text-sovereignty-accent hover:text-sovereignty-accent/80 transition-colors',
                  },
                  children: [
                    {
                      type: 'span',
                      content: '$t:docs.jsonSchema.urls.download.latest',
                      props: {},
                    },
                    { type: 'span', content: '\u2197', props: { className: 'text-xs' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Editor Integration ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.jsonSchema.editor.title',
          '$t:docs.jsonSchema.editor.description',
          'editor-integration'
        ),

        // VS Code
        subsectionHeader('VS Code', '$t:docs.jsonSchema.editor.vscode.description', 'vscode'),
        {
          type: 'div',
          props: { className: 'space-y-4' },
          children: [
            {
              type: 'paragraph',
              content: '$t:docs.jsonSchema.editor.vscode.inline',
              props: {
                className: 'text-sm text-sovereignty-gray-300 font-medium',
              },
            },
            codeBlock(
              [
                '{',
                `  "$schema": "https://sovrium.com/schemas/${rawVersion}/app.schema.json",`,
                '  "name": "my-app",',
                '  "version": "1.0.0"',
                '}',
              ].join('\n'),
              'json'
            ),
            {
              type: 'paragraph',
              content: '$t:docs.jsonSchema.editor.vscode.settings',
              props: {
                className: 'text-sm text-sovereignty-gray-300 font-medium mt-4',
              },
            },
            codeBlock(
              [
                '{',
                '  "yaml.schemas": {',
                `    "https://sovrium.com/schemas/${rawVersion}/app.schema.json": "app.yaml"`,
                '  },',
                '  "json.schemas": [',
                '    {',
                `      "url": "https://sovrium.com/schemas/${rawVersion}/app.schema.json",`,
                '      "fileMatch": ["app.json"]',
                '    }',
                '  ]',
                '}',
              ].join('\n'),
              'json'
            ),
          ],
        },

        // JetBrains
        subsectionHeader(
          'JetBrains',
          '$t:docs.jsonSchema.editor.jetbrains.description',
          'jetbrains'
        ),
        {
          type: 'div',
          props: { className: 'space-y-3' },
          children: [
            {
              type: 'paragraph',
              content: '$t:docs.jsonSchema.editor.jetbrains.steps',
              props: {
                className: 'text-sm text-sovereignty-gray-300 leading-relaxed',
              },
            },
            codeBlock(`https://sovrium.com/schemas/${rawVersion}/app.schema.json`, 'text'),
          ],
        },
      ],
    },

    // ── Versioning ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.jsonSchema.versioning.title',
          '$t:docs.jsonSchema.versioning.description',
          'versioning'
        ),
        {
          type: 'div',
          props: {
            className:
              'space-y-3 p-4 rounded-lg border border-sovereignty-gray-800 bg-sovereignty-gray-900/30',
          },
          children: [
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'icon',
                  props: {
                    name: 'git-branch',
                    size: 16,
                    className: 'text-sovereignty-accent mt-0.5 flex-shrink-0',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.jsonSchema.versioning.semver',
                  props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed' },
                },
              ],
            },
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'icon',
                  props: {
                    name: 'link',
                    size: 16,
                    className: 'text-sovereignty-accent mt-0.5 flex-shrink-0',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.jsonSchema.versioning.latest',
                  props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed' },
                },
              ],
            },
            {
              type: 'div',
              props: { className: 'flex items-start gap-3' },
              children: [
                {
                  type: 'icon',
                  props: {
                    name: 'shield',
                    size: 16,
                    className: 'text-sovereignty-accent mt-0.5 flex-shrink-0',
                  },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.jsonSchema.versioning.pin',
                  props: { className: 'text-sm text-sovereignty-gray-300 leading-relaxed' },
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Programmatic Validation ──────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.jsonSchema.validation.title',
          '$t:docs.jsonSchema.validation.description',
          'programmatic-validation'
        ),
        {
          type: 'paragraph',
          content: '$t:docs.jsonSchema.validation.intro',
          props: { className: 'text-sm text-sovereignty-gray-300 mb-4 leading-relaxed' },
        },
        codeBlock(
          [
            'import Ajv from "ajv"',
            'import schema from "./app.schema.json"',
            'import config from "./app.json"',
            '',
            'const ajv = new Ajv({ allErrors: true })',
            'const validate = ajv.compile(schema)',
            '',
            'if (validate(config)) {',
            '  console.log("Configuration is valid")',
            '} else {',
            '  console.error("Validation errors:", validate.errors)',
            '}',
          ].join('\n'),
          'typescript'
        ),
        calloutTip(
          '$t:docs.jsonSchema.validation.tip.title',
          '$t:docs.jsonSchema.validation.tip.body'
        ),
      ],
    },
  ],
})
