/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import buildACrmBody from '@/docs/guides/build-a-crm.md' with { type: 'file' }
import guidesBody from '@/docs/guides/guides.md' with { type: 'file' }
import migrateFromAirtableBody from '@/docs/guides/migrate-from-airtable.md' with { type: 'file' }
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
        'The nineteen example configurations shipped with Sovrium, and the sovrium init templates that scaffold them.',
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
        'Map each Airtable field type to a Sovrium field, define the table in config, and import your CSV export.',
      keywords: [
        'sovrium',
        'migrate from airtable',
        'airtable alternative',
        'self-hosted airtable',
        'import csv',
        'field type mapping',
      ],
      order: 10_030,
      sidebarLabel: 'From Airtable',
      body: migrateFromAirtableBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'migrate-from-zapier',
      title: 'Migrate from Zapier to Sovrium',
      description:
        'Replace a Zap with a self-hosted automation — map the trigger and action steps and run the workflow on your own server.',
      keywords: [
        'sovrium',
        'migrate from zapier',
        'zapier alternative',
        'self-hosted automation',
        'workflow',
        'trigger action mapping',
      ],
      order: 10_040,
      sidebarLabel: 'From Zapier',
      body: migrateFromZapierBody,
      documents: [],
      stories: [],
    }),
  ],
})
