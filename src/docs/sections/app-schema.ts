/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AppSchema } from '@/domain/models/app'
import appMetadataBody from '@/domain/models/app/app-metadata.docs.md' with { type: 'file' }
import { DecisionSchema } from '@/domain/models/app/decisions'
import decisionsBody from '@/domain/models/app/decisions/decisions.docs.md' with { type: 'file' }
import { LanguagesSchema } from '@/domain/models/app/languages'
import languagesBody from '@/domain/models/app/languages/languages.docs.md' with { type: 'file' }
import { LinkLifecycleSchema, LinkSchema } from '@/domain/models/app/links'
import shortLinksBody from '@/domain/models/app/links/links.docs.md' with { type: 'file' }
import { LlmsSchema } from '@/domain/models/app/llms'
import llmsTxtBody from '@/domain/models/app/llms/llms.docs.md' with { type: 'file' }
import { RedirectSchema } from '@/domain/models/app/redirects'
import redirectsBody from '@/domain/models/app/redirects/redirects.docs.md' with { type: 'file' }
import schemaOverviewBody from '@/domain/models/app/schema-overview.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * App Schema — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it. Every entry of
 * `documents` is a VALUE import, so deleting the schema fails `tsc` here
 * rather than at the moment a reader asks for the article.
 */
export const section = defineSection({
  slug: 'app-schema',
  title: 'App Schema',
  order: 9000,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'schema-overview',
      title: 'Schema Overview',
      description:
        'The root properties of a Sovrium app config — what each one declares, how they are validated together, and the three formats you can write them in.',
      keywords: [
        'sovrium',
        'app schema',
        'overview',
        'configuration',
        'JSON',
        'YAML',
        'root properties',
        'schema structure',
        'tables',
        'pages',
        'forms',
        'auth',
        'automations',
        'agents',
      ],
      order: 9000,
      sidebarLabel: 'Overview',
      body: schemaOverviewBody,
      documents: [AppSchema],
      stories: [
        'US-AUTOMATIONS-ENVIRONMENT-VARIABLES',
        'US-PAGES-COMMAND-PALETTE',
        'US-PAGES-PAGE-COMPONENTS-002',
        'US-PAGES-PAGE-COMPONENTS-003',
      ],
    }),
    defineArticle({
      slug: 'app-metadata',
      title: 'App Metadata',
      description:
        'The `name`, `version`, `description` and `badge` root properties — naming rules, Semantic Versioning, and the "Built with Sovrium" badge with its one-line removal.',
      keywords: [
        'sovrium',
        'app metadata',
        'name',
        'version',
        'description',
        'badge',
        'built with sovrium',
        'remove badge',
        'semver',
        'version history',
        'migration history',
        'reload',
        'configuration as code',
      ],
      order: 9010,
      sidebarLabel: 'App Metadata',
      body: appMetadataBody,
      documents: [],
      stories: [
        'US-APP-SCHEMA-APP-METADATA-001',
        'US-APP-SCHEMA-APP-METADATA-002',
        'US-APP-SCHEMA-APP-METADATA-003',
        'US-APP-SCHEMA-APP-METADATA-004',
        'US-LINKS-CLICK-EVENTS',
        'US-LINKS-ON-PAGE-CLICK-TRACKING',
      ],
    }),
    defineArticle({
      slug: 'languages',
      title: 'Languages',
      description:
        "Serve one app in several languages: declare the supported set, route them under `/{lang}/`, remember a reader's choice, and translate strings with `$t:` keys.",
      keywords: [
        'sovrium',
        'languages',
        'internationalization',
        'i18n',
        'translations',
        'multilingual',
        'localization',
      ],
      order: 9020,
      sidebarLabel: 'Languages',
      body: languagesBody,
      documents: [LanguagesSchema],
      stories: [
        'US-FORMS-I18N',
        'US-I18N-INTERPRETER-UI-STRINGS',
        'US-I18N-MULTI-LANGUAGE-APPS-001',
        'US-I18N-MULTI-LANGUAGE-APPS-002',
        'US-I18N-MULTI-LANGUAGE-APPS-003',
        'US-I18N-MULTI-LANGUAGE-APPS-004',
        'US-I18N-MULTI-LANGUAGE-APPS-005',
      ],
    }),
    defineArticle({
      slug: 'redirects',
      title: 'URL Redirects',
      description:
        'Retire a URL without breaking the links that point at it — declare redirect rules that answer old paths with a 301 before page resolution.',
      keywords: [
        'sovrium',
        'redirects',
        '301',
        '302',
        'moved permanently',
        'retired urls',
        'url migration',
        'seo',
        'link equity',
      ],
      order: 9030,
      sidebarLabel: 'Redirects',
      body: redirectsBody,
      documents: [RedirectSchema],
      stories: ['US-PAGES-REDIRECTS', 'US-PAGES-REDIRECTS-NON-LOCALIZED'],
    }),
    defineArticle({
      slug: 'short-links',
      title: 'Short Links',
      description:
        'Share one measurable address per campaign: declare short links that resolve under `/l`, count every click in your own database, and print their QR codes.',
      keywords: [
        'sovrium',
        'short links',
        'link tracking',
        'click analytics',
        'qr code',
        'utm',
        'campaign',
        'bitly alternative',
        'self-hosted',
      ],
      order: 9040,
      sidebarLabel: 'Short Links',
      body: shortLinksBody,
      documents: [LinkSchema, LinkLifecycleSchema],
      stories: [
        'US-LINKS-ADVANCED-ROUTING',
        'US-LINKS-LIFECYCLE',
        'US-LINKS-ORGANISATION',
        'US-LINKS-QR-CODES',
        'US-LINKS-SHORT-LINKS',
        'US-LINKS-UTM-BUILDER',
      ],
    }),
    defineArticle({
      slug: 'decisions',
      title: 'Decision Records',
      description:
        "Declare the architecture decision records behind your configuration — why the app is the way it is, in Nygard's four parts, versioned with the config.",
      keywords: [
        'sovrium',
        'decision records',
        'ADR',
        'architecture decision record',
        'nygard',
        'superseded',
        'register',
        'why',
        'rationale',
        'admin api',
        'config documentation',
      ],
      order: 9050,
      sidebarLabel: 'Decision Records',
      body: decisionsBody,
      documents: [DecisionSchema],
      stories: ['US-ADMIN-DASHBOARD-SYSTEM-CONFIG-MOUNT', 'US-ADMIN-DECISIONS-CATALOG'],
    }),
    defineArticle({
      slug: 'llms-txt',
      title: 'Publish llms.txt',
      description:
        "Serve your app's documentation to AI assistants at `/llms.txt` and `/llms-full.txt` — auto-derived from your content pages, with optional overrides.",
      keywords: [
        'sovrium',
        'llms.txt',
        'llms-full.txt',
        'llmstxt.org',
        'ai assistants',
        'machine-readable docs',
        'app.llms',
      ],
      order: 9060,
      sidebarLabel: 'Publish llms.txt',
      body: llmsTxtBody,
      documents: [LlmsSchema],
      stories: [
        'US-PAGES-LLMS-TXT-CONFIGURATION-001',
        'US-PAGES-LLMS-TXT-GENERATION-001',
        'US-PAGES-LLMS-TXT-LOCALE-SCOPING-001',
      ],
    }),
  ],
})
