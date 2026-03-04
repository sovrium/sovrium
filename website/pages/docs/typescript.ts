/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  calloutTip,
  codeBlock,
  docsPage,
  propertyTable,
  sectionHeader,
  subsectionHeader,
} from './shared'

// ─── Code Snippets ──────────────────────────────────────────────────────────

const importExample = [
  "import { start, build } from 'sovrium'",
  "import type { App } from 'sovrium'",
].join('\n')

const minimalStart = [
  "import { start } from 'sovrium'",
  '',
  'const server = await start({',
  "  name: 'my-app',",
  '})',
  '',
  'console.log(`Server running on port ${server.port}`)',
].join('\n')

const startWithOptions = [
  "import { start } from 'sovrium'",
  '',
  'const server = await start(',
  '  {',
  "    name: 'my-app',",
  '    tables: [',
  '      {',
  '        id: 1,',
  "        name: 'tasks',",
  '        fields: [',
  "          { id: 1, name: 'title', type: 'single-line-text', required: true },",
  "          { id: 2, name: 'done', type: 'checkbox' },",
  '        ],',
  '      },',
  '    ],',
  '  },',
  '  {',
  '    port: 8080,',
  "    hostname: '0.0.0.0',",
  "    publicDir: './public',",
  '  }',
  ')',
].join('\n')

const buildExample = [
  "import { build } from 'sovrium'",
  '',
  'await build(',
  '  {',
  "    name: 'my-site',",
  '    pages: [',
  '      {',
  "        name: 'home',",
  "        path: '/',",
  '        sections: [',
  "          { type: 'heading', content: 'Welcome' },",
  "          { type: 'paragraph', content: 'Built with Sovrium.' },",
  '        ],',
  '      },',
  '    ],',
  '  },',
  '  {',
  "    outputDir: './dist',",
  "    baseUrl: 'https://example.com',",
  "    deployment: 'github-pages',",
  '    generateSitemap: true,',
  '    generateRobotsTxt: true,',
  '  }',
  ')',
].join('\n')

const watchExample = 'bun --watch index.ts'

const dynamicConfigExample = [
  "import { start } from 'sovrium'",
  "import type { App } from 'sovrium'",
  '',
  '// Build configuration dynamically',
  "const tables = ['users', 'posts', 'comments'].map((name, i) => ({",
  '  id: i + 1,',
  '  name,',
  '  fields: [',
  "    { id: 1, name: 'title', type: 'single-line-text' as const, required: true },",
  "    { id: 2, name: 'created_at', type: 'datetime' as const },",
  '  ],',
  '}))',
  '',
  'const app: App = {',
  "  name: 'dynamic-app',",
  '  tables,',
  '  theme: {',
  '    colors: {',
  "      primary: process.env.BRAND_COLOR ?? '#3b82f6',",
  '    },',
  '  },',
  '}',
  '',
  'await start(app)',
].join('\n')

const appTypeExample = [
  "import type { App } from 'sovrium'",
  '',
  'const config: App = {',
  "  name: 'my-app',",
  "  version: '1.0.0',",
  "  description: 'My application',",
  '  tables: [/* ... */],',
  '  theme: {/* ... */},',
  '  pages: [/* ... */],',
  '  auth: {/* ... */},',
  '  languages: {/* ... */},',
  '  components: {/* ... */},',
  '  analytics: true,',
  '}',
].join('\n')

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsTypescript = docsPage({
  activeId: 'typescript',
  path: '/docs/typescript',
  metaTitle: '$t:docs.typescript.meta.title',
  metaDescription: '$t:docs.typescript.meta.description',
  toc: [
    { label: '$t:docs.typescript.why.title', anchor: 'why-typescript' },
    {
      label: '$t:docs.typescript.start.title',
      anchor: 'start-function',
      children: [{ label: '$t:docs.typescript.start.options.title', anchor: 'start-options' }],
    },
    {
      label: '$t:docs.typescript.build.title',
      anchor: 'build-function',
      children: [{ label: '$t:docs.typescript.build.options.title', anchor: 'build-options' }],
    },
    { label: '$t:docs.typescript.appType.title', anchor: 'app-type' },
    { label: '$t:docs.typescript.watchMode.title', anchor: 'watch-mode' },
    { label: '$t:docs.typescript.examples.title', anchor: 'examples' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.typescript.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.typescript.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Import ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [codeBlock(importExample, 'typescript')],
    },

    // ── Why TypeScript? ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.why.title',
          '$t:docs.typescript.why.description',
          'why-typescript'
        ),
        {
          type: 'div',
          props: { className: 'grid grid-cols-1 gap-4 mt-4' },
          children: [
            {
              type: 'div',
              props: {
                className:
                  'border border-sovereignty-gray-800 rounded-lg p-5 bg-sovereignty-gray-900/30',
              },
              children: [
                {
                  type: 'h4',
                  content: '$t:docs.typescript.why.point1.title',
                  props: { className: 'text-sm font-semibold text-sovereignty-light mb-1' },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.typescript.why.point1.description',
                  props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
                },
              ],
            },
            {
              type: 'div',
              props: {
                className:
                  'border border-sovereignty-gray-800 rounded-lg p-5 bg-sovereignty-gray-900/30',
              },
              children: [
                {
                  type: 'h4',
                  content: '$t:docs.typescript.why.point2.title',
                  props: { className: 'text-sm font-semibold text-sovereignty-light mb-1' },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.typescript.why.point2.description',
                  props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
                },
              ],
            },
            {
              type: 'div',
              props: {
                className:
                  'border border-sovereignty-gray-800 rounded-lg p-5 bg-sovereignty-gray-900/30',
              },
              children: [
                {
                  type: 'h4',
                  content: '$t:docs.typescript.why.point3.title',
                  props: { className: 'text-sm font-semibold text-sovereignty-light mb-1' },
                },
                {
                  type: 'paragraph',
                  content: '$t:docs.typescript.why.point3.description',
                  props: { className: 'text-sm text-sovereignty-gray-400 leading-relaxed' },
                },
              ],
            },
          ],
        },
      ],
    },

    // ── start() ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.start.title',
          '$t:docs.typescript.start.description',
          'start-function'
        ),
        codeBlock(minimalStart, 'typescript'),

        // StartOptions
        subsectionHeader(
          '$t:docs.typescript.start.options.title',
          '$t:docs.typescript.start.options.description',
          'start-options'
        ),
        propertyTable([
          { name: 'port', description: '$t:docs.typescript.start.options.port' },
          { name: 'hostname', description: '$t:docs.typescript.start.options.hostname' },
          { name: 'publicDir', description: '$t:docs.typescript.start.options.publicDir' },
        ]),
        codeBlock(startWithOptions, 'typescript'),
      ],
    },

    // ── build() ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.build.title',
          '$t:docs.typescript.build.description',
          'build-function'
        ),

        // GenerateStaticOptions
        subsectionHeader(
          '$t:docs.typescript.build.options.title',
          '$t:docs.typescript.build.options.description',
          'build-options'
        ),
        propertyTable([
          { name: 'outputDir', description: '$t:docs.typescript.build.options.outputDir' },
          { name: 'baseUrl', description: '$t:docs.typescript.build.options.baseUrl' },
          { name: 'basePath', description: '$t:docs.typescript.build.options.basePath' },
          { name: 'deployment', description: '$t:docs.typescript.build.options.deployment' },
          { name: 'languages', description: '$t:docs.typescript.build.options.languages' },
          {
            name: 'defaultLanguage',
            description: '$t:docs.typescript.build.options.defaultLanguage',
          },
          {
            name: 'generateSitemap',
            description: '$t:docs.typescript.build.options.generateSitemap',
          },
          {
            name: 'generateRobotsTxt',
            description: '$t:docs.typescript.build.options.generateRobotsTxt',
          },
          { name: 'hydration', description: '$t:docs.typescript.build.options.hydration' },
          {
            name: 'generateManifest',
            description: '$t:docs.typescript.build.options.generateManifest',
          },
          {
            name: 'bundleOptimization',
            description: '$t:docs.typescript.build.options.bundleOptimization',
          },
          { name: 'publicDir', description: '$t:docs.typescript.build.options.publicDir' },
        ]),
        codeBlock(buildExample, 'typescript'),
      ],
    },

    // ── App Type ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.appType.title',
          '$t:docs.typescript.appType.description',
          'app-type'
        ),
        codeBlock(appTypeExample, 'typescript'),
        calloutTip('$t:docs.typescript.appType.tip.title', '$t:docs.typescript.appType.tip.body'),
      ],
    },

    // ── Watch Mode ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.watchMode.title',
          '$t:docs.typescript.watchMode.description',
          'watch-mode'
        ),
        codeBlock(watchExample, 'bash'),
        calloutTip(
          '$t:docs.typescript.watchMode.tip.title',
          '$t:docs.typescript.watchMode.tip.body'
        ),
      ],
    },

    // ── Examples ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.examples.title',
          '$t:docs.typescript.examples.description',
          'examples'
        ),

        // Minimal server
        subsectionHeader('$t:docs.typescript.examples.minimal.title', '', 'example-minimal'),
        codeBlock(minimalStart, 'typescript'),

        // With tables
        subsectionHeader('$t:docs.typescript.examples.tables.title', '', 'example-tables'),
        codeBlock(startWithOptions, 'typescript'),

        // Static build
        subsectionHeader('$t:docs.typescript.examples.build.title', '', 'example-build'),
        codeBlock(buildExample, 'typescript'),

        // Dynamic config
        subsectionHeader('$t:docs.typescript.examples.dynamic.title', '', 'example-dynamic'),
        codeBlock(dynamicConfigExample, 'typescript'),
      ],
    },
  ],
})
