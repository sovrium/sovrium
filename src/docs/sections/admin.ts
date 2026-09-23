/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import adminDashboardBody from '@/admin/config/pages/admin-dashboard.docs.md' with { type: 'file' }
import designSystemConsoleBody from '@/admin/config/pages/design-system/design-system-console.docs.md' with { type: 'file' }
import adminCustomizationBody from '@/domain/models/app/admin/admin-customization.docs.md' with { type: 'file' }
import { BuiltInAnalyticsSchema } from '@/domain/models/app/analytics'
import analyticsBody from '@/domain/models/app/analytics/analytics.docs.md' with { type: 'file' }
import activityMonitoringBody from '@/presentation/api/tables/activity-monitoring.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Admin & Observability — the section manifest.
 *
 * ─── WHY FIVE ARTICLES SIT IN FOUR DIFFERENT TREES ─────────────────────────
 *
 * The obvious reading is that every `admin` article belongs under
 * `src/admin/`, and it is wrong for two of the five. The placement rule sends
 * a paragraph to the narrowest thing it is TRUE of, and "the operator console"
 * is not the subject of all five:
 *
 *   - `admin-dashboard` documents the console's own surface — every page it
 *     serves, how you sign into it, and the read API behind it. Its pages span
 *     `config/pages/{,data/,developers/}`, so the narrowest directory holding
 *     them is `src/admin/config/pages/` itself.
 *   - `design-system-console` documents the eight routes under
 *     `/design-system`, which are exactly the pages of
 *     `config/pages/design-system/`.
 *   - `admin-customization` documents the `admin` KEY — a boolean, plus what
 *     your `design` does and does not reach once the console is served. The
 *     key is declared in `src/domain/models/app/admin/`, and that is where the
 *     article goes; the console is its subject only in the way any property's
 *     effect is.
 *   - `analytics` documents the `analytics` property, its event model and its
 *     endpoints. It mentions the console's Analytics page in one paragraph and
 *     is otherwise not about the console at all.
 *   - `activity-monitoring` documents `GET /api/activity`, implemented in
 *     `src/presentation/api/tables/activity-feed-routes.ts` — a class-B,
 *     route-subject article, filed beside `record-history.docs.md`, which is
 *     the article a reader arrives from.
 *
 * Both schema-property homes were among the five directories the `Doc File
 * Presence` census listed as uncovered, which is a second, independent reading
 * of the same placement: the census asks every schema property for an article,
 * and these two were the ones it had not been given.
 *
 * ─── WHY ONLY ONE DIRECTIVE ────────────────────────────────────────────────
 *
 * `AdminConfigSchema` is `Schema.Boolean`. The walker renders a scalar as an
 * empty table and the engine refuses to publish one, so the `admin` key is
 * prose — the same call the manual already makes for `NameSchema` and
 * `VersionSchema`. Everything else these five articles tabulate is a ROUTE or
 * an HTTP parameter rather than a config option, and no schema node carries
 * it. `BuiltInAnalytics` is the one real option bag in the section.
 */
export const section = defineSection({
  slug: 'admin',
  title: 'Admin & Observability',
  order: 9400,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'admin-dashboard',
      title: 'Admin Dashboard',
      description:
        'The operator console at `/_admin` — an admin-only, read-only data console over records, runs, submissions, accounts, files and analytics, plus the read API behind it.',
      keywords: [
        'sovrium',
        'admin dashboard',
        '_admin',
        'operational console',
        'read-only',
        'records',
        'automation runs',
        'form submissions',
        'RBAC',
        '404',
        'gdpr',
        'admin API',
      ],
      order: 9400,
      sidebarLabel: 'Overview',
      body: adminDashboardBody,
      documents: [],
      stories: [
        'US-ADMIN-AGENTS-CONVERSATIONS',
        'US-ADMIN-AGENTS-LIST',
        'US-ADMIN-AUTOMATIONS-OVERVIEW',
        'US-ADMIN-AUTOMATIONS-PAUSE-RESUME',
        'US-ADMIN-AUTOMATIONS-RUNS-LIST',
        'US-ADMIN-BUCKETS-FILES',
        'US-ADMIN-BUCKETS-LIST',
        'US-ADMIN-BUCKETS-OVERVIEW',
        'US-ADMIN-CONFIG-ENV',
        'US-ADMIN-CONFIG-INSTANCE',
        'US-ADMIN-CONFIG-MCP-TOOLS',
        'US-ADMIN-CONFIG-REFLECTION',
        'US-ADMIN-CONFIG-SCHEMA',
        'US-ADMIN-CONFIG-VERSION',
        'US-ADMIN-CONNECTIONS-CONNECTIONS',
        'US-ADMIN-CONNECTIONS-CONNECTIONS-ACTIONS',
        'US-ADMIN-DASHBOARD-AUTH-ENDUSERS',
        'US-ADMIN-DASHBOARD-DATA-USERS-PAGING',
        'US-ADMIN-DASHBOARD-GDPR',
        'US-ADMIN-DASHBOARD-LOGIN',
        'US-ADMIN-DASHBOARD-ORGANISATION-GRAPH',
        'US-ADMIN-DASHBOARD-OVERVIEW',
        'US-ADMIN-DASHBOARD-PASSWORD-RESET',
        'US-ADMIN-FORMS-ANALYTICS',
        'US-ADMIN-FORMS-LIST',
        'US-ADMIN-FORMS-SUBMISSION-DETAIL',
        'US-ADMIN-FORMS-SUBMISSIONS-BULK',
        'US-ADMIN-FORMS-SUBMISSIONS-LIST',
        'US-ADMIN-LINKS-CATALOG',
        'US-ADMIN-LINKS-MUTATIONS',
        'US-ADMIN-LINKS-VARIANTS',
        'US-ADMIN-RELEASES-LEDGER',
        'US-ADMIN-TABLES-OVERVIEW',
        'US-ADMIN-USERS-OVERVIEW',
      ],
    }),
    defineArticle({
      slug: 'admin-customization',
      title: 'Console Customization',
      description:
        'What you can change about the built-in admin console — whether it is served at all, and how your own design paints it — plus the accessibility floor no configuration can remove.',
      keywords: [
        'sovrium',
        'admin console',
        'customization',
        'design cascade',
        'prebuilt console',
        'accessibility floor',
        'read-only console',
        'fork',
      ],
      order: 9405,
      sidebarLabel: 'Console Customization',
      body: adminCustomizationBody,
      documents: [],
      stories: ['US-ADMIN-DASHBOARD-CONSOLE-DESIGN-CASCADE'],
    }),
    defineArticle({
      slug: 'analytics',
      title: 'Analytics',
      description:
        'Built-in, privacy-first, self-hosted analytics — page views, sessions, referrers, UTM campaigns and device breakdowns on one unified event model, with no cookies and no external services.',
      keywords: [
        'sovrium',
        'analytics',
        'page views',
        'privacy',
        'GDPR',
        'unified events',
        'event model',
        'retention',
        'referrers',
        'UTM',
        'inspect events',
        'no cookies',
      ],
      order: 9410,
      sidebarLabel: 'Analytics',
      body: analyticsBody,
      documents: [BuiltInAnalyticsSchema],
      stories: [
        'US-ANALYTICS-EVENT-POPULATION-FILTER',
        'US-ANALYTICS-INSPECT-EVENTS',
        'US-ANALYTICS-PAGE-ANALYTICS-001',
        'US-ANALYTICS-PAGE-ANALYTICS-002',
        'US-ANALYTICS-PAGE-ANALYTICS-003',
        'US-ANALYTICS-PAGE-ANALYTICS-004',
        'US-ANALYTICS-PAGE-ANALYTICS-005',
        'US-ANALYTICS-PAGE-ANALYTICS-006',
        'US-ANALYTICS-PAGE-ANALYTICS-007',
        'US-ANALYTICS-UNIFIED-EVENTS-MODEL',
      ],
    }),
    defineArticle({
      slug: 'activity-monitoring',
      title: 'Activity Monitoring',
      description:
        'System-wide activity logging — record CRUD, authentication events and administrative actions — with filtering, pagination, and an audit trail that outlives the rows it describes.',
      keywords: [
        'sovrium',
        'activity log',
        'audit trail',
        'monitoring',
        'record tracking',
        'auth events',
        'admin actions',
        'compliance',
        'SOC2',
        'GDPR',
      ],
      order: 9420,
      sidebarLabel: 'Activity Monitoring',
      body: activityMonitoringBody,
      documents: [],
      stories: [
        'US-ACTIVITY-ACTIVITY-LOGGING-001',
        'US-ACTIVITY-ACTIVITY-LOGGING-002',
        'US-ACTIVITY-ACTIVITY-LOGGING-003',
        'US-ADMIN-AUDIT-LOG-BOOT-RETENTION',
        'US-ADMIN-AUDIT-LOG-FILTERS',
      ],
    }),
    defineArticle({
      slug: 'design-system-console',
      title: 'Design System Console',
      description:
        'The console section that draws your design system at its rendered values — foundations, the UI kit, your own components, brand, voice — and the revocable link that publishes it to someone with no login.',
      keywords: [
        'sovrium',
        'design system console',
        'admin',
        'component catalog',
        'share link',
        'revocable link',
        'design tokens preview',
        'brand charter',
        'read-only',
      ],
      order: 9430,
      sidebarLabel: 'Design System Console',
      body: designSystemConsoleBody,
      documents: [],
      stories: ['US-ADMIN-DESIGN-SYSTEM-DESIGN-FACETS', 'US-ADMIN-DESIGN-SYSTEM-SHARE'],
    }),
  ],
})
