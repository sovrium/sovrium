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
  "import type { AppConfig, SimpleServer } from 'sovrium'",
  '',
  '// All config types are available:',
  '// PageConfig, TableConfig, ThemeConfig, AuthConfig,',
  '// ComponentConfig, LanguageConfig, AnalyticsConfig, ...',
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
  "import type { AppConfig, PageConfig, TableConfig, ThemeConfig } from 'sovrium'",
  '',
  '// Compose config from typed sub-configs',
  'const theme: ThemeConfig = {',
  "  colors: { primary: process.env.BRAND_COLOR ?? '#3b82f6' },",
  '}',
  '',
  "const tables: TableConfig[] = ['users', 'posts'].map((name, i) => ({",
  '  id: i + 1,',
  '  name,',
  '  fields: [',
  "    { id: 1, name: 'title', type: 'single-line-text' as const, required: true },",
  "    { id: 2, name: 'created_at', type: 'datetime' as const },",
  '  ],',
  '}))',
  '',
  "const pages: PageConfig[] = [{ name: 'home', path: '/', sections: [] }]",
  '',
  'const app: AppConfig = {',
  "  name: 'dynamic-app',",
  '  tables,',
  '  pages,',
  '  theme,',
  '}',
  '',
  'await start(app)',
].join('\n')

const appConfigExample = [
  "import type { AppConfig } from 'sovrium'",
  '',
  'const config: AppConfig = {',
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

const generateStaticResultExample = [
  "import { build } from 'sovrium'",
  "import type { GenerateStaticResult } from 'sovrium'",
  '',
  "const result: GenerateStaticResult = await build({ name: 'my-site', pages: [/* ... */] })",
  'console.log(result.outputDir)     // "./static"',
  'console.log(result.files.length)  // number of generated files',
].join('\n')

const pageConfigExample = [
  'const page: PageConfig = {',
  "  name: 'home',",
  "  path: '/',",
  "  sections: [{ type: 'heading', content: 'Welcome' }],",
  '}',
].join('\n')

const tableConfigExample = [
  'const table: TableConfig = {',
  '  id: 1,',
  "  name: 'tasks',",
  "  fields: [{ id: 1, name: 'title', type: 'single-line-text' }],",
  '}',
].join('\n')

const componentConfigExample = [
  'const hero: ComponentConfig = {',
  "  name: 'hero',",
  "  type: 'section',",
  "  children: [{ type: 'heading', content: '$title' }],",
  '}',
].join('\n')

const themeConfigExample = [
  'const theme: ThemeConfig = {',
  "  colors: { primary: '#3b82f6' },",
  "  fonts: { sans: 'Inter, sans-serif' },",
  '}',
].join('\n')

const authConfigExample = [
  'const auth: AuthConfig = {',
  "  strategies: [{ type: 'email-password' }],",
  "  roles: ['admin', 'member'],",
  '}',
].join('\n')

const languageConfigExample = [
  'const languages: LanguageConfig = {',
  "  supported: ['en', 'fr'],",
  "  default: 'en',",
  '}',
].join('\n')

const analyticsConfigExample = [
  '// Simple: just enable defaults',
  'const analytics: AnalyticsConfig = true',
  '',
  '// Custom settings',
  "const custom: AnalyticsConfig = { retentionDays: 90, excludedPaths: ['/admin'] }",
].join('\n')

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsTypescript = docsPage({
  activeId: 'typescript',
  path: '/docs/typescript',
  metaTitle: '$t:docs.typescript.meta.title',
  metaDescription: '$t:docs.typescript.meta.description',
  keywords:
    'sovrium, TypeScript, type safety, app schema, type inference, configuration types, SDK',
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
    { label: '$t:docs.typescript.appType.title', anchor: 'app-config' },
    {
      label: '$t:docs.typescript.typeRef.title',
      anchor: 'type-reference',
      children: [
        { label: 'SimpleServer', anchor: 'type-simple-server' },
        { label: 'PageConfig', anchor: 'type-page-config' },
        { label: 'TableConfig', anchor: 'type-table-config' },
        { label: 'ComponentConfig', anchor: 'type-component-config' },
        { label: 'ThemeConfig', anchor: 'type-theme-config' },
        { label: 'AuthConfig', anchor: 'type-auth-config' },
        { label: 'LanguageConfig', anchor: 'type-language-config' },
        { label: 'AnalyticsConfig', anchor: 'type-analytics-config' },
        { label: 'GenerateStaticResult', anchor: 'type-generate-static-result' },
      ],
    },
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

    // ── AppConfig ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.typescript.appType.title',
          '$t:docs.typescript.appType.description',
          'app-config'
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
        codeBlock(appConfigExample, 'typescript'),
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

        // PageConfig
        subsectionHeader(
          'PageConfig',
          '$t:docs.typescript.typeRef.pageConfig.description',
          'type-page-config'
        ),
        codeBlock(pageConfigExample, 'typescript'),

        // TableConfig
        subsectionHeader(
          'TableConfig',
          '$t:docs.typescript.typeRef.tableConfig.description',
          'type-table-config'
        ),
        codeBlock(tableConfigExample, 'typescript'),

        // ComponentConfig
        subsectionHeader(
          'ComponentConfig',
          '$t:docs.typescript.typeRef.componentConfig.description',
          'type-component-config'
        ),
        codeBlock(componentConfigExample, 'typescript'),

        // ThemeConfig
        subsectionHeader(
          'ThemeConfig',
          '$t:docs.typescript.typeRef.themeConfig.description',
          'type-theme-config'
        ),
        codeBlock(themeConfigExample, 'typescript'),

        // AuthConfig
        subsectionHeader(
          'AuthConfig',
          '$t:docs.typescript.typeRef.authConfig.description',
          'type-auth-config'
        ),
        codeBlock(authConfigExample, 'typescript'),

        // LanguageConfig
        subsectionHeader(
          'LanguageConfig',
          '$t:docs.typescript.typeRef.languageConfig.description',
          'type-language-config'
        ),
        codeBlock(languageConfigExample, 'typescript'),

        // AnalyticsConfig
        subsectionHeader(
          'AnalyticsConfig',
          '$t:docs.typescript.typeRef.analyticsConfig.description',
          'type-analytics-config'
        ),
        codeBlock(analyticsConfigExample, 'typescript'),

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
