/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import accessibilityBody from '@/docs/guides/accessibility.md' with { type: 'file' }
import buildACrmBody from '@/docs/guides/build-a-crm.md' with { type: 'file' }
import guidesBody from '@/docs/guides/guides.md' with { type: 'file' }
import migrateFromAirtableBody from '@/docs/guides/migrate-from-airtable.md' with { type: 'file' }
import migrateFromMakeBody from '@/docs/guides/migrate-from-make.md' with { type: 'file' }
import migrateFromN8nBody from '@/docs/guides/migrate-from-n8n.md' with { type: 'file' }
import migrateFromNotionBody from '@/docs/guides/migrate-from-notion.md' with { type: 'file' }
import migrateFromTypeformBody from '@/docs/guides/migrate-from-typeform.md' with { type: 'file' }
import migrateFromZapierBody from '@/docs/guides/migrate-from-zapier.md' with { type: 'file' }
import templatesExamplesBody from '@/docs/guides/templates-examples.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Guides: build — the section manifest.
 *
 * Task-based walkthroughs, each answering one question with a complete,
 * runnable config. A guide spans several features at once, which is the whole
 * reason it cannot sit beside any one of them.
 *
 * The four guide sections share ONE directory, `src/docs/guides/`. The
 * directory is the placement — decided by the placement rule — and the section
 * is the reading order, which follows the published corpus so a reader who
 * knows the site finds the same grouping in the terminal.
 *
 * None of them carries a directive. Where a guide restated an option's values
 * it names the feature article instead, so the option is documented once.
 */
export const section = defineSection({
  slug: 'guides-build',
  title: 'Guides: Build',
  order: 10_000,
  tab: 'guides',
  articles: [
    defineArticle({
      slug: 'guides',
      title: 'Guides',
      description:
        'Task-based guides for building with Sovrium — each answers one question with a complete, runnable config.',
      keywords: [
        'sovrium',
        'guides',
        'tutorials',
        'recipes',
        'how-to',
        'migrate',
        'templates',
        'self-hosted',
      ],
      order: 10_000,
      sidebarLabel: 'Overview',
      body: guidesBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'templates-examples',
      title: 'Templates & Examples',
      description:
        'Every example configuration shipped with Sovrium, and the sovrium init templates that scaffold them.',
      keywords: [
        'sovrium',
        'templates',
        'examples',
        'sovrium init',
        'scaffold',
        'starter',
        'hello-world',
        'landing-page',
        'blog',
        'docs-site',
        'api-only',
        'mcp-server',
        'app-starter',
        'marketing-site',
        'crm',
        'projects',
        'helpdesk',
        'content-calendar',
        'people',
        'events',
        'assets',
        'inventory',
        'expenses',
        'intranet',
        'knowledge-base',
        'automation-recipes',
        'company-os',
        '$ref',
      ],
      order: 10_010,
      sidebarLabel: 'Start from a template',
      body: templatesExamplesBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'build-a-crm',
      title: 'Build a CRM with Sovrium',
      description:
        'Stand up a working CRM in minutes — from the crm template, or a minimal two-table config you grow.',
      keywords: [
        'sovrium',
        'build a crm',
        'crm template',
        'sovrium init',
        'contacts',
        'deals',
        'self-hosted crm',
      ],
      order: 10_020,
      sidebarLabel: 'Build a CRM',
      body: buildACrmBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-airtable',
      title: 'Migrate from Airtable to Sovrium',
      description:
        'Move an Airtable base with sovrium import: fetch it read-only, preview, read the report, then write and seed its tables, links and files.',
      keywords: [
        'sovrium',
        'migrate from airtable',
        'airtable alternative',
        'self-hosted airtable',
        'sovrium import',
        'airtable migration',
      ],
      order: 10_030,
      sidebarLabel: 'From Airtable',
      body: migrateFromAirtableBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-notion',
      title: 'Migrate from Notion to Sovrium',
      description:
        'Move a Notion database with sovrium import: fetch it read-only, preview, read the report, then write and seed its tables, relations and people.',
      keywords: [
        'sovrium',
        'migrate from notion',
        'notion alternative',
        'self-hosted notion',
        'sovrium import',
        'notion database',
      ],
      order: 10_032,
      sidebarLabel: 'From Notion',
      body: migrateFromNotionBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-zapier',
      title: 'Migrate from Zapier to Sovrium',
      description:
        'Import your Zapier Tables and your Zaps with sovrium import, finish what the report lists, and switch the automations on one at a time.',
      keywords: [
        'sovrium',
        'migrate from zapier',
        'zapier alternative',
        'self-hosted automation',
        'zapier tables',
        'trigger action mapping',
      ],
      order: 10_040,
      sidebarLabel: 'From Zapier',
      body: migrateFromZapierBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-make',
      title: 'Migrate from Make to Sovrium',
      description:
        'Convert Make scenarios into disabled Sovrium automations with sovrium import, finish the TODO list, then switch them on one at a time.',
      keywords: [
        'sovrium',
        'migrate from make',
        'make alternative',
        'integromat',
        'self-hosted automation',
        'sovrium import',
      ],
      order: 10_042,
      sidebarLabel: 'From Make',
      body: migrateFromMakeBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-n8n',
      title: 'Migrate from n8n to Sovrium',
      description:
        'Convert n8n workflows into disabled Sovrium automations with sovrium import, rewrite the code steps, then switch them on one at a time.',
      keywords: [
        'sovrium',
        'migrate from n8n',
        'n8n alternative',
        'self-hosted automation',
        'workflows',
        'sovrium import',
      ],
      order: 10_044,
      sidebarLabel: 'From n8n',
      body: migrateFromN8nBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-typeform',
      title: 'Migrate from Typeform to Sovrium',
      description:
        'Move a Typeform form and its responses with sovrium import: fetch it read-only, preview, read the report, then write and seed the form.',
      keywords: [
        'sovrium',
        'migrate from typeform',
        'typeform alternative',
        'self-hosted forms',
        'form responses',
        'sovrium import',
      ],
      order: 10_046,
      sidebarLabel: 'From Typeform',
      body: migrateFromTypeformBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'accessibility',
      title: 'Build an accessible app',
      description:
        'What Sovrium guarantees for accessibility on every page, what stays yours, and how to check your app against WCAG 2.1 AA and RGAA 4.1.',
      keywords: [
        'sovrium',
        'accessibility',
        'a11y',
        'rgaa',
        'wcag',
        'screen reader',
        'keyboard',
        'contrast',
        'axe',
      ],
      order: 10_050,
      sidebarLabel: 'Accessibility',
      body: accessibilityBody,
      documents: [],
      stories: ['US-ACCESSIBILITY-RGAA-CRITERIA'],
    }),
  ],
})
