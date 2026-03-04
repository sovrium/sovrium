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
  "import { start, build, AppSchema, PageSchema } from 'sovrium'",
  'import type {',
  '  App, AppEncoded,',
  '  Page, PageEncoded,',
  '  ComponentTemplate,',
  '  SimpleServer,',
  '  StartOptions,',
  '  GenerateStaticOptions, GenerateStaticResult,',
  "} from 'sovrium'",
].join('\n')

const minimalStart = [
  "import { start } from 'sovrium'",
  '',
  'const server = await start({',
  "  name: 'my-app',",
  '})',
  '',
  'console.log(`Server running at ${server.url}`)',
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
  '  components: [/* ... */],',
  '  analytics: true,',
  '}',
].join('\n')

const simpleServerExample = [
  "import { start } from 'sovrium'",
  "import type { SimpleServer } from 'sovrium'",
  '',
  "const server: SimpleServer = await start({ name: 'my-app' })",
  'console.log(server.url) // "http://localhost:3000"',
  'await server.stop()     // graceful shutdown',
].join('\n')

const appEncodedExample = [
  "import type { AppEncoded } from 'sovrium'",
  '',
  '// AppEncoded accepts raw input before validation',
  '// (same shape as App but without Effect Schema transformations)',
  "const raw: AppEncoded = { name: 'my-app', tables: [/* ... */] }",
].join('\n')

const pageTypeExample = [
  "import type { Page } from 'sovrium'",
  '',
  'const page: Page = {',
  "  name: 'home',",
  "  path: '/',",
  '  meta: {',
  "    lang: 'en-US',",
  "    title: 'Welcome',",
  "    description: 'Welcome to our platform',",
  '  },',
  '  sections: [',
  "    { type: 'heading', content: 'Hello World' },",
  '    {',
  "      $ref: '#/components/hero',",
  "      $vars: { title: 'Welcome', ctaLabel: 'Get Started' },",
  '    },',
  '  ],',
  '  scripts: { features: { analytics: true } },',
  "  vars: { siteName: 'Sovrium' },",
  '}',
].join('\n')

const componentTemplateExample = [
  "import type { ComponentTemplate } from 'sovrium'",
  '',
  'const heroCard: ComponentTemplate = {',
  "  name: 'hero-card',",
  "  type: 'card',",
  "  props: { className: 'bg-$color' },",
  '  children: [',
  "    { type: 'icon', props: { name: '$icon', size: 4 } },",
  "    { type: 'text', props: { level: 'span' }, content: '$label' },",
  '  ],',
  '}',
].join('\n')

const generateStaticResultExample = [
  "import { build } from 'sovrium'",
  "import type { GenerateStaticResult } from 'sovrium'",
  '',
  "const result: GenerateStaticResult = await build({ name: 'my-site', pages: [/* ... */] })",
  'console.log(result.outputDir)     // "./static"',
  'console.log(result.files.length)  // number of generated files',
].join('\n')

const runtimeSchemaExample = [
  "import { AppSchema, PageSchema } from 'sovrium'",
  "import { Schema } from 'effect'",
  '',
  '// Validate unknown input at runtime',
  'const app = Schema.decodeUnknownSync(AppSchema)({',
  "  name: 'my-app',",
  '  tables: [/* ... */],',
  '})',
  '',
  '// Validate a page configuration',
  'const page = Schema.decodeUnknownSync(PageSchema)({',
  "  name: 'home',",
  "  path: '/',",
  '  sections: [],',
  '})',
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
    {
      label: '$t:docs.typescript.typeRef.title',
      anchor: 'type-reference',
      children: [
        { label: 'SimpleServer', anchor: 'type-simple-server' },
        { label: 'AppEncoded', anchor: 'type-app-encoded' },
        { label: 'Page', anchor: 'type-page' },
        { label: 'PageEncoded', anchor: 'type-page-encoded' },
        { label: 'ComponentTemplate', anchor: 'type-component-template' },
        { label: 'GenerateStaticResult', anchor: 'type-generate-static-result' },
      ],
    },
    { label: '$t:docs.typescript.runtimeSchemas.title', anchor: 'runtime-schemas' },
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
        propertyTable([
          { name: 'name', description: '$t:docs.typescript.appType.props.name' },
          { name: 'version?', description: '$t:docs.typescript.appType.props.version' },
          { name: 'description?', description: '$t:docs.typescript.appType.props.description' },
          { name: 'tables?', description: '$t:docs.typescript.appType.props.tables' },
          { name: 'theme?', description: '$t:docs.typescript.appType.props.theme' },
          { name: 'pages?', description: '$t:docs.typescript.appType.props.pages' },
          { name: 'auth?', description: '$t:docs.typescript.appType.props.auth' },
          { name: 'languages?', description: '$t:docs.typescript.appType.props.languages' },
          { name: 'components?', description: '$t:docs.typescript.appType.props.components' },
          { name: 'analytics?', description: '$t:docs.typescript.appType.props.analytics' },
        ]),
        codeBlock(appTypeExample, 'typescript'),
        calloutTip('$t:docs.typescript.appType.tip.title', '$t:docs.typescript.appType.tip.body'),
      ],
    },

    // ── Type Reference ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.typeRef.title',
          '$t:docs.typescript.typeRef.description',
          'type-reference'
        ),

        // SimpleServer
        subsectionHeader(
          'SimpleServer',
          '$t:docs.typescript.typeRef.simpleServer.description',
          'type-simple-server'
        ),
        propertyTable([
          { name: 'url', description: '$t:docs.typescript.typeRef.simpleServer.url' },
          { name: 'stop()', description: '$t:docs.typescript.typeRef.simpleServer.stop' },
        ]),
        codeBlock(simpleServerExample, 'typescript'),

        // AppEncoded
        subsectionHeader(
          'AppEncoded',
          '$t:docs.typescript.typeRef.appEncoded.description',
          'type-app-encoded'
        ),
        codeBlock(appEncodedExample, 'typescript'),
        calloutTip(
          '$t:docs.typescript.typeRef.appEncoded.tip.title',
          '$t:docs.typescript.typeRef.appEncoded.tip.body'
        ),

        // Page
        subsectionHeader('Page', '$t:docs.typescript.typeRef.page.description', 'type-page'),
        propertyTable([
          { name: 'id?', description: '$t:docs.typescript.typeRef.page.id' },
          { name: 'name', description: '$t:docs.typescript.typeRef.page.name' },
          { name: 'path', description: '$t:docs.typescript.typeRef.page.path' },
          { name: 'meta?', description: '$t:docs.typescript.typeRef.page.meta' },
          { name: 'sections', description: '$t:docs.typescript.typeRef.page.sections' },
          { name: 'scripts?', description: '$t:docs.typescript.typeRef.page.scripts' },
          { name: 'vars?', description: '$t:docs.typescript.typeRef.page.vars' },
        ]),
        codeBlock(pageTypeExample, 'typescript'),

        // PageEncoded
        subsectionHeader(
          'PageEncoded',
          '$t:docs.typescript.typeRef.pageEncoded.description',
          'type-page-encoded'
        ),

        // ComponentTemplate
        subsectionHeader(
          'ComponentTemplate',
          '$t:docs.typescript.typeRef.componentTemplate.description',
          'type-component-template'
        ),
        propertyTable([
          { name: 'name', description: '$t:docs.typescript.typeRef.componentTemplate.name' },
          { name: 'type', description: '$t:docs.typescript.typeRef.componentTemplate.type' },
          { name: 'props?', description: '$t:docs.typescript.typeRef.componentTemplate.props' },
          {
            name: 'children?',
            description: '$t:docs.typescript.typeRef.componentTemplate.children',
          },
          {
            name: 'content?',
            description: '$t:docs.typescript.typeRef.componentTemplate.content',
          },
        ]),
        codeBlock(componentTemplateExample, 'typescript'),

        // GenerateStaticResult
        subsectionHeader(
          'GenerateStaticResult',
          '$t:docs.typescript.typeRef.generateStaticResult.description',
          'type-generate-static-result'
        ),
        propertyTable([
          {
            name: 'outputDir',
            description: '$t:docs.typescript.typeRef.generateStaticResult.outputDir',
          },
          { name: 'files', description: '$t:docs.typescript.typeRef.generateStaticResult.files' },
        ]),
        codeBlock(generateStaticResultExample, 'typescript'),
      ],
    },

    // ── Runtime Schemas ─────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.runtimeSchemas.title',
          '$t:docs.typescript.runtimeSchemas.description',
          'runtime-schemas'
        ),
        propertyTable([
          { name: 'AppSchema', description: '$t:docs.typescript.runtimeSchemas.appSchema' },
          { name: 'PageSchema', description: '$t:docs.typescript.runtimeSchemas.pageSchema' },
        ]),
        codeBlock(runtimeSchemaExample, 'typescript'),
        calloutTip(
          '$t:docs.typescript.runtimeSchemas.tip.title',
          '$t:docs.typescript.runtimeSchemas.tip.body'
        ),
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
