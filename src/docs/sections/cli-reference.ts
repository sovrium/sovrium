/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import changelogBody from '@/cli/commands/changelog.docs.md' with { type: 'file' }
import cliValidateBody from '@/cli/commands/cli-validate.docs.md' with { type: 'file' }
import clientBody from '@/cli/commands/client.docs.md' with { type: 'file' }
import docsBody from '@/cli/commands/docs.docs.md' with { type: 'file' }
import libraryBody from '@/cli/commands/library.docs.md' with { type: 'file' }
import renderBody from '@/cli/commands/render.docs.md' with { type: 'file' }
import reportBody from '@/cli/commands/report.docs.md' with { type: 'file' }
import skillsBody from '@/cli/commands/skills.docs.md' with { type: 'file' }
import templatesBody from '@/cli/commands/templates.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * The Developer Tools section: the verbs that check, read or print something
 * rather than run the app (validation, this manual, the Agent Skills, a
 * template preview, the release notes, a problem report, the templates, the
 * library, and the typed API client). Its own rail group so the CLI groups
 * stay short enough to scan; article slugs are unchanged.
 */
export const cliTools = defineSection({
  slug: 'cli-tools',
  title: 'Developer Tools',
  order: 1403,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'cli-render',
      title: 'Previewing a Template',
      description:
        'Render one template asset the way an automation would, with its sample data or yours, and print it or write it to a file, offline with no server or database.',
      keywords: [
        'sovrium render',
        'preview',
        'template',
        'sampleData',
        '--data',
        '--out',
        '--email',
        '--locale',
      ],
      order: 1496,
      sidebarLabel: 'Previewing a Template',
      body: renderBody,
      documents: [],
      stories: ['US-CLI-RENDER-COMMAND'],
    }),
    defineArticle({
      slug: 'cli-changelog',
      title: 'Release Notes',
      description:
        'Read what changed in the version you run, an earlier one, or since the version you upgraded from, breaking changes first, from the binary with no network.',
      keywords: [
        'sovrium changelog',
        'release notes',
        'changelog',
        'what changed',
        'breaking changes',
        'upgrade',
        '--since',
        '--list',
      ],
      order: 1497,
      sidebarLabel: 'Release Notes',
      body: changelogBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-CHANGELOG'],
    }),
    defineArticle({
      slug: 'cli-templates',
      title: 'Templates',
      description:
        'List the templates your binary carries, by category or as one JSON document, and pick one for sovrium init --template without guessing a name.',
      keywords: [
        'sovrium templates',
        'templates',
        'template gallery',
        'sovrium init --template',
        'headless',
        '--json',
      ],
      order: 1499,
      sidebarLabel: 'Templates',
      body: templatesBody,
      documents: [],
      stories: ['US-CLI-TEMPLATES-COMMAND'],
    }),
    defineArticle({
      slug: 'cli-validate',
      title: 'Validation & Schema Generation',
      description:
        'Check a config without starting anything, read its --json report, emit the JSON Schema that describes every config, and export the design system for an agent.',
      keywords: [
        'sovrium validate',
        'sovrium validate --json',
        'machine-readable validation',
        'sovrium schema',
        'sovrium design-system',
        'validateConfig',
        'JSON Schema',
        'config validation',
        'DTCG',
      ],
      order: 1480,
      sidebarLabel: 'Validation & Schema',
      body: cliValidateBody,
      documents: [],
      stories: [
        'US-CLI-CONFIG-VALIDATION',
        'US-CLI-CONFIG-VALIDATION-REPORT',
        'US-CLI-DESIGN-SYSTEM',
        'US-CLI-STARTING-SERVER-CONFIG-SOURCES',
      ],
    }),
    defineArticle({
      slug: 'docs',
      title: 'Reading the Manual Offline',
      description:
        '`sovrium docs` prints this manual from the binary, offline, with no config, database or network, so what you read describes the engine you run.',
      keywords: [
        'sovrium docs',
        'offline documentation',
        'llms.txt',
        'llms-full.txt',
        'AI agent',
        'machine-readable documentation',
        'determinism',
      ],
      order: 1490,
      sidebarLabel: 'Reading the Manual',
      body: docsBody,
      documents: [],
      stories: ['US-CLI-DOCS-COMMAND'],
    }),
    defineArticle({
      slug: 'cli-skills',
      title: 'Agent Skills',
      description:
        'Write the agent skills that match your Sovrium version into a project, refresh them after an upgrade without touching what you edited, and check them in CI.',
      keywords: [
        'sovrium skills',
        'agent skills',
        'SKILL.md',
        '.claude/skills',
        '.agents/skills',
        '.sovrium-skills.json',
        'Claude Code',
        'Cursor',
        'Codex',
        'MCP prompts',
      ],
      order: 1495,
      sidebarLabel: 'Agent Skills',
      body: skillsBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-SKILLS'],
    }),
    defineArticle({
      slug: 'cli-report',
      title: 'Reporting a Problem',
      description:
        '`sovrium report` prints a new-issue address prefilled with the facts maintainers need and no secret, or the private vulnerability form. It sends nothing.',
      keywords: [
        'sovrium report',
        'bug report',
        'issue',
        'vulnerability',
        'security advisory',
        'request id',
        '--last-error',
      ],
      order: 1498,
      sidebarLabel: 'Reporting a Problem',
      body: reportBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-REPORT'],
    }),
    defineArticle({
      slug: 'cli-library',
      title: 'The Library of Ready-Made Pieces',
      description:
        '`sovrium library` ships blocks, connections and automation recipes inside the binary, and copies the one you pick into your config as a file you own.',
      keywords: [
        'sovrium library',
        'library add',
        'ready-made blocks',
        'connection presets',
        'automation recipes',
        'copy-in',
        '$ref',
      ],
      order: 1500,
      sidebarLabel: 'Library',
      body: libraryBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-LIBRARY', 'US-CLI-LIBRARY-CATALOGUE'],
    }),
    defineArticle({
      slug: 'cli-client',
      title: 'Call the API from Your Own Front-End',
      description:
        'Write one typed, dependency-free TypeScript client for the records API with sovrium client, and call your app from a React site, a mobile app or a script.',
      keywords: [
        'sovrium client',
        'typed client',
        'front-end',
        'fetch',
        'SDK',
        'records API',
        'SOVRIUM_CORS_ORIGINS',
        'x-api-key',
        '--check',
      ],
      order: 1423,
      sidebarLabel: 'Typed API Client',
      body: clientBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-CLIENT'],
    }),
  ],
})
