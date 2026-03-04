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

const usageSyntax = [
  'sovrium [command] [config] [flags]',
  '',
  'sovrium start app.yaml          # Start dev server',
  'sovrium build app.yaml          # Build static site',
  'sovrium --help                  # Show help',
].join('\n')

const startExamples = [
  '# Start from a JSON file',
  'sovrium start app.json',
  '',
  '# Start from a YAML file',
  'sovrium start app.yaml',
  '',
  '# Implicit start (default command)',
  'sovrium app.yaml',
  '',
  '# Start with watch mode (hot reload)',
  'sovrium start app.yaml --watch',
  'sovrium start app.yaml -w',
  '',
  '# Start on a custom port',
  'PORT=8080 sovrium start app.yaml',
].join('\n')

const envExamples = [
  '# Inline JSON',
  'APP_SCHEMA=\'{"name":"my-app"}\' sovrium start',
  '',
  '# Inline YAML',
  "APP_SCHEMA='name: my-app' sovrium start",
  '',
  '# Remote URL',
  "APP_SCHEMA='https://example.com/app.yaml' sovrium start",
].join('\n')

const buildExamples = [
  '# Basic static build',
  'sovrium build app.yaml',
  '',
  '# Build for GitHub Pages',
  'SOVRIUM_DEPLOYMENT=github-pages sovrium build app.yaml',
  '',
  '# Build with sitemap and custom output',
  'SOVRIUM_OUTPUT_DIR=./public \\',
  '  SOVRIUM_BASE_URL=https://example.com \\',
  '  SOVRIUM_GENERATE_SITEMAP=true \\',
  '  SOVRIUM_GENERATE_ROBOTS=true \\',
  '  sovrium build app.yaml',
].join('\n')

const watchModeExample = [
  '# Start with file watching',
  'sovrium start app.yaml --watch',
  '',
  '# Edit app.yaml in another terminal...',
  '# Server reloads automatically',
].join('\n')

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsCli = docsPage({
  activeId: 'cli',
  path: '/docs/cli',
  metaTitle: '$t:docs.cli.meta.title',
  metaDescription: '$t:docs.cli.meta.description',
  toc: [
    { label: '$t:docs.cli.usage.title', anchor: 'usage' },
    {
      label: '$t:docs.cli.commands.title',
      anchor: 'commands',
      children: [
        { label: 'start', anchor: 'command-start' },
        { label: 'build', anchor: 'command-build' },
        { label: '--help', anchor: 'command-help' },
      ],
    },
    { label: '$t:docs.cli.flags.title', anchor: 'flags' },
    {
      label: '$t:docs.cli.configFormats.title',
      anchor: 'config-sources',
      children: [
        { label: '$t:docs.cli.configFormats.file.title', anchor: 'config-file' },
        { label: '$t:docs.cli.configFormats.env.title', anchor: 'config-env' },
      ],
    },
    { label: '$t:docs.cli.watchMode.title', anchor: 'watch-mode' },
    { label: '$t:docs.cli.examples.title', anchor: 'examples' },
    { label: '$t:docs.cli.exitCodes.title', anchor: 'exit-codes' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.cli.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.cli.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Usage ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.cli.usage.title', '$t:docs.cli.usage.description', 'usage'),
        codeBlock(usageSyntax, 'bash'),
      ],
    },

    // ── Commands ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.cli.commands.title', '$t:docs.cli.commands.description', 'commands'),

        // start
        subsectionHeader(
          '$t:docs.cli.commands.start.title',
          '$t:docs.cli.commands.start.description',
          'command-start'
        ),
        codeBlock('sovrium start app.yaml', 'bash'),

        // build
        subsectionHeader(
          '$t:docs.cli.commands.build.title',
          '$t:docs.cli.commands.build.description',
          'command-build'
        ),
        codeBlock('sovrium build app.yaml', 'bash'),

        // help
        subsectionHeader(
          '$t:docs.cli.commands.help.title',
          '$t:docs.cli.commands.help.description',
          'command-help'
        ),
        codeBlock('sovrium --help', 'bash'),
      ],
    },

    // ── Flags ────────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.cli.flags.title', '$t:docs.cli.flags.description', 'flags'),
        propertyTable([
          {
            name: '$t:docs.cli.flags.watch.name',
            description: '$t:docs.cli.flags.watch.description',
          },
          {
            name: '$t:docs.cli.flags.help.name',
            description: '$t:docs.cli.flags.help.description',
          },
        ]),
      ],
    },

    // ── Configuration Sources ────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.cli.configFormats.title',
          '$t:docs.cli.configFormats.description',
          'config-sources'
        ),

        // File path
        subsectionHeader(
          '$t:docs.cli.configFormats.file.title',
          '$t:docs.cli.configFormats.file.description',
          'config-file'
        ),
        codeBlock('sovrium start app.yaml\nsovrium build config.json', 'bash'),

        // Environment variable
        subsectionHeader(
          '$t:docs.cli.configFormats.env.title',
          '$t:docs.cli.configFormats.env.description',
          'config-env'
        ),
        codeBlock(envExamples, 'bash'),
        calloutTip('$t:docs.installation.config.tip.title', '$t:docs.installation.config.tip.body'),
      ],
    },

    // ── Watch Mode ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.cli.watchMode.title',
          '$t:docs.cli.watchMode.description',
          'watch-mode'
        ),
        codeBlock(watchModeExample, 'bash'),
        calloutTip('$t:docs.cli.watchMode.tip.title', '$t:docs.cli.watchMode.tip.body'),
      ],
    },

    // ── Examples ─────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.cli.examples.title', '$t:docs.cli.examples.description', 'examples'),
        subsectionHeader('$t:docs.cli.commands.start.title', '', 'examples-start'),
        codeBlock(startExamples, 'bash'),
        subsectionHeader('$t:docs.cli.commands.build.title', '', 'examples-build'),
        codeBlock(buildExamples, 'bash'),
      ],
    },

    // ── Exit Codes ───────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.cli.exitCodes.title',
          '$t:docs.cli.exitCodes.description',
          'exit-codes'
        ),
        propertyTable([
          { name: '$t:docs.cli.exitCodes.zero', description: '' },
          { name: '$t:docs.cli.exitCodes.one', description: '' },
        ]),
      ],
    },
  ],
})
