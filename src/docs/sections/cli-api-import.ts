/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import cliImportAirtableNotionBody from '@/cli/commands/cli-import-airtable-notion.docs.md' with { type: 'file' }
import cliImportAutomationsBody from '@/cli/commands/cli-import-automations.docs.md' with { type: 'file' }
import cliImportDatabasesBody from '@/cli/commands/cli-import-databases.docs.md' with { type: 'file' }
import cliImportFormsMoreBody from '@/cli/commands/cli-import-forms-more.docs.md' with { type: 'file' }
import cliImportFormsBody from '@/cli/commands/cli-import-forms.docs.md' with { type: 'file' }
import cliImportPagesBody from '@/cli/commands/cli-import-pages.docs.md' with { type: 'file' }
import cliImportTablesBody from '@/cli/commands/cli-import-tables.docs.md' with { type: 'file' }
import cliImportBody from '@/cli/commands/cli-import.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The migration articles, as articles of the CLI section.
 *
 * `sovrium import` and its pages per source family live in their own module
 * rather than in `cli-api.ts` because that file reached its line ceiling. They
 * stay part of the CLI section and the section assembles them by spread, as it
 * does the operating commands.
 *
 * Their orders are one contiguous block (1450–1457), after the operating
 * commands (1430–1441) and before `cli-validate` (1480), so the sidebar shows
 * the migration pages together: the overview first, then tables, automations
 * and forms, then pages.
 */
export const importCliArticles: readonly DocArticle[] = [
  defineArticle({
    slug: 'cli-import',
    title: 'Migrating From Another Tool',
    description:
      'Move tables, records, automations and forms out of another tool, with one read-only fetch and one offline conversion you can preview and repeat.',
    keywords: [
      'sovrium import',
      'migration',
      'import',
      'snapshot',
      'seed/import',
      'dry run',
      'import report',
    ],
    order: 1450,
    sidebarLabel: 'Migrating From Another Tool',
    body: cliImportBody,
    documents: [],
    stories: ['US-CLI-IMPORT-DATA', 'US-CLI-IMPORT-FETCH'],
  }),
  defineArticle({
    slug: 'cli-import-tables',
    title: 'Migrating Tables and Records',
    description:
      'What each table source maps, degrades and reports, and how CSV, XLSX, Google Sheets and Zapier Tables are typed from their values.',
    keywords: [
      'sovrium import',
      'CSV',
      'XLSX',
      'Google Sheets',
      'Zapier Tables',
      'GOOGLE_TOKEN',
      'spreadsheet',
      'type inference',
    ],
    order: 1451,
    sidebarLabel: 'Import: Tables and Records',
    body: cliImportTablesBody,
    documents: [],
    stories: ['US-CLI-IMPORT-TABLES'],
  }),
  defineArticle({
    slug: 'cli-import-airtable-notion',
    title: 'Migrating From Airtable and Notion',
    description:
      'Fetch an Airtable base or a Notion database read-only, then convert it into typed tables, links, formulas and seed files.',
    keywords: [
      'sovrium import',
      'Airtable',
      'Notion',
      'AIRTABLE_TOKEN',
      'NOTION_TOKEN',
      'formulas',
      'linked records',
    ],
    order: 1452,
    sidebarLabel: 'Import: Airtable and Notion',
    body: cliImportAirtableNotionBody,
    documents: [],
    stories: [],
  }),
  defineArticle({
    slug: 'cli-import-databases',
    title: 'Migrating From Baserow, Retool Database, Webflow CMS and Zite',
    description:
      "Bring a Baserow workspace or database, a Retool Database, a Webflow site's CMS collections or a Zite database across.",
    keywords: [
      'sovrium import',
      'Baserow',
      'Retool Database',
      'Webflow CMS',
      'Zite',
      'BASEROW_TOKEN',
      'RETOOL_DB_URL',
      'WEBFLOW_TOKEN',
      'ZITE_TOKEN',
    ],
    order: 1453,
    sidebarLabel: 'Import: Baserow, Retool, Webflow, Zite',
    body: cliImportDatabasesBody,
    documents: [],
    stories: [],
  }),
  defineArticle({
    slug: 'cli-import-automations',
    title: 'Migrating Automations',
    description:
      'Turn n8n workflows, Make scenarios, Baserow workflows and Webflow form webhooks into disabled Sovrium automations.',
    keywords: [
      'sovrium import',
      'n8n',
      'Make',
      'Zapier',
      'Baserow',
      'Webflow',
      'webhook',
      'N8N_API_KEY',
      'MAKE_TOKEN',
      'automations',
    ],
    order: 1454,
    sidebarLabel: 'Import: Automations',
    body: cliImportAutomationsBody,
    documents: [],
    stories: ['US-CLI-IMPORT-AUTOMATIONS', 'US-CLI-IMPORT-N8N-WEBFLOW'],
  }),
  defineArticle({
    slug: 'cli-import-forms',
    title: 'Migrating Forms',
    description:
      'Bring a Typeform, Tally, Fillout or Webflow form across with its past responses, and see what every form source maps.',
    keywords: [
      'sovrium import',
      'forms migration',
      'Typeform',
      'Tally',
      'Fillout',
      'Webflow forms',
      'responses',
    ],
    order: 1455,
    sidebarLabel: 'Import: Forms',
    body: cliImportFormsBody,
    documents: [],
    stories: ['US-CLI-IMPORT-FORMS'],
  }),
  defineArticle({
    slug: 'cli-import-forms-more',
    title: 'Migrating Forms From Jotform, Google Forms and Microsoft Forms',
    description:
      'Bring a Jotform or Google Forms form and its responses across with one read-only fetch, or a Microsoft Forms form from its responses workbook.',
    keywords: [
      'sovrium import',
      'forms migration',
      'Jotform',
      'Google Forms',
      'Microsoft Forms',
      'responses',
      'form responses',
    ],
    order: 1456,
    sidebarLabel: 'Import: Jotform, Google, Microsoft Forms',
    body: cliImportFormsMoreBody,
    documents: [],
    stories: [],
  }),
  defineArticle({
    slug: 'cli-import-pages',
    title: 'Migrating Pages From Notion',
    description:
      'Turn the pages of a Notion export into new Sovrium pages offline, with every block it could not carry listed in the report.',
    keywords: [
      'sovrium import',
      'Notion',
      'pages migration',
      'Notion export',
      'HTML export',
      'sub-pages',
    ],
    order: 1457,
    sidebarLabel: 'Import: Notion Pages',
    body: cliImportPagesBody,
    documents: [],
    stories: ['US-CLI-IMPORT-PAGES'],
  }),
]
