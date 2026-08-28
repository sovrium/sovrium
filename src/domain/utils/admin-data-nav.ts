/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure cross-layer taxonomy for the Native Admin Dashboard's **Data** tab
 *.
 *
 * The Data-tab page set is consumed by BOTH the presentation sidebar island
 * (which decorates each page with its `icon` glyph + renders the rows) AND the
 * application surface builder (which resolves `/_admin/data[/:page]` to a
 * landing / placeholder page). That shared contract therefore lives in the
 * innermost common layer — the domain — so neither consumer crosses a layer
 * boundary to reach it:
 *
 *  - presentation (`admin-sidebar-data-nav.ts`) imports {@link DATA_NAV_PAGES}
 *    and adds the presentation-only `icon` field;
 *  - application (`data-landing-surface.ts`) imports {@link DATA_NAV_PAGES} +
 *    the pure path helpers below.
 *
 * It lives in `domain/utils` (not `domain/services`) because client-side islands
 * are allowed to import `domain-util` but not `domain-service` — and this module
 * is pure data + string predicates anyway (no React, no presentation types, no
 * App-config dependency, no I/O).
 */

/**
 * The two sidebar nav sections the Data destinations group under. `app` holds
 * the operator's own application data (tables / forms / buckets / agents);
 * `system` holds the platform-level operational data (automations / users /
 * connections / page stats). Pure string union — the presentation layer maps it
 * to a section heading.
 *
 * Agents sit in `app` because a conversation is data a USER generated, exactly
 * like a record, a submission or a file — not something the platform recorded
 * about itself. The section names the data, not the object, which is why the
 * `agents` row is labelled "Conversations".
 */
export type DataNavSection = 'app' | 'system'

/**
 * English heading per nav section, shown above each grouped destination list.
 * Kept to a single word each (Apple-grade restraint) so the uppercase headers
 * read cleanly and never wrap at the 256px sidebar width: the operator's own
 * application data vs the platform's operational/system data.
 */
export const DATA_NAV_SECTION_LABELS: Readonly<Record<DataNavSection, string>> = {
  app: 'Application',
  system: 'System',
}

/** The section display order — application data first, then system data. */
export const DATA_NAV_SECTION_ORDER: ReadonlyArray<DataNavSection> = ['app', 'system']

/** One Data-tab page: a navigable runtime-data destination (icon-free contract). */
export interface DataNavPage {
  /** Stable key — the `/_admin/{key}` route segment + the row testid suffix. */
  readonly key: string
  /** English sidebar label for the page row. */
  readonly label: string
  /** The dashboard sub-path the row links to. */
  readonly href: string
  /**
   * The sidebar section this destination groups under (`app` = the operator's
   * own application data; `system` = platform-level operational data).
   */
  readonly section: DataNavSection
  /**
   * Backend readiness. `true` when the page's admin read-API ships. ALL ten
   * Data destinations are backend-ready (Pass 1: tables / automations / pages /
   * forms / users; Pass 2a: buckets; Pass 2b: agents; Pass 2c: connections;
   * Footprint: `/api/admin/footprint/overview`; Links: `/api/admin/links`) —
   * the console is 10/10 and no "Coming soon" gap row remains.
   */
  readonly ready: boolean
}

/**
 * The ten Data-tab pages, grouped into two sidebar sections: the operator's
 * own application data first (Records / Submissions / Files / Conversations),
 * then the platform-level system data (Automations / Users / Connections /
 * Analytics / Links / Footprint). The keys match the top-level `/_admin/{key}` routes
 * the surface builder resolves (the `/data` URL segment was retired in [internal ref] —
 * no back-compat); the array order is the in-section render order.
 *
 * Footprint sits last in `system` because it describes the instance rather than
 * any object in it — it is the only destination whose rows are not records the
 * operator created.
 */
export const DATA_NAV_PAGES: ReadonlyArray<DataNavPage> = [
  // ── Application data ──
  { key: 'tables', label: 'Records', href: '/_admin/tables', section: 'app', ready: true },
  { key: 'forms', label: 'Submissions', href: '/_admin/forms', section: 'app', ready: true },
  { key: 'buckets', label: 'Files', href: '/_admin/buckets', section: 'app', ready: true },
  { key: 'agents', label: 'Conversations', href: '/_admin/agents', section: 'app', ready: true },
  // ── System data ──
  {
    key: 'automations',
    label: 'Automations',
    href: '/_admin/automations',
    section: 'system',
    ready: true,
  },
  { key: 'users', label: 'Users', href: '/_admin/users', section: 'system', ready: true },
  {
    key: 'connections',
    label: 'Connections',
    href: '/_admin/connections',
    section: 'system',
    ready: true,
  },
  { key: 'pages', label: 'Analytics', href: '/_admin/pages', section: 'system', ready: true },
  // Links sits beside Analytics because it is the second analytics-shaped
  // destination: every metric panel on it reads the SAME `/api/analytics/*`
  // endpoints, narrowed to `event_type=link_click`. It stays in `system` (not
  // `app`) so it renders as a FLAT row rather than an expandable disclosure —
  // the link population is unbounded and DB-backed, and enumerating it in a
  // 256px sidebar would be hostile.
  { key: 'links', label: 'Links', href: '/_admin/links', section: 'system', ready: true },
  {
    key: 'footprint',
    label: 'Footprint',
    href: '/_admin/footprint',
    section: 'system',
    ready: true,
  },
]

/**
 * The Data workspace landing path. The `/data` URL segment was retired in [internal ref]
 * (no back-compat): the landing now lives at the dashboard root `/_admin`.
 */
export const DATA_NAV_ROOT = '/_admin'

/** The dashboard home path the brand label + home breadcrumb crumb link to. */
export const ADMIN_HOME_PATH = '/_admin'

/**
 * Reserved `name` of the embedded operator-console config
 * (`src/infrastructure/assets/dashboard/dashboard-app.yaml`). It travels with
 * the binary, never with the operator's app, so it is a stable identity marker.
 */
export const OPERATOR_CONSOLE_APP_NAME = 'sovrium-admin-dashboard'

/**
 * Whether `app` is the `/_admin` operator console rather than a generated app
 * surface.
 *
 * The console is rendered through the SAME page pipeline as any config-driven
 * page (`buildDashboardSurfaceApp` synthesizes a surface app from the embedded
 * dashboard config, then the standard renderer runs), so keeping end-user
 * chrome off it is NOT structural — it has to be deliberate. The "Built with
 * Sovrium" badge achieves that with a hard-coded `badge: false` on the
 * synthesized surface app; chrome gated on ENV rather than on app config (the
 * demo context notice) has no such config seam and asks this predicate instead.
 *
 * Identity is matched on the app NAME, not the request path: `dashboardPath` is
 * `/_admin`-stripped before the surface is built, so console pages carry
 * ordinary-looking paths (`/`, `/tables/contacts`) that are indistinguishable
 * from an operator's own pages. The synthesized surface spreads the embedded
 * config (`{ ...dashboardApp }`), so the reserved name survives onto every
 * console render, including the `/login` surface that has no synthesized page.
 */
export function isOperatorConsoleApp(app: { readonly name?: string }): boolean {
  return app.name === OPERATOR_CONSOLE_APP_NAME
}

/**
 * Title-case an app slug for display — `sovrium-partner` → `Sovrium Partner`.
 * Pure (string → string) so BOTH the presentation sidebar brand label AND the
 * application-layer breadcrumb home crumb derive the same name from one source,
 * without the application layer importing presentation. Falls back to `Console`
 * for an empty/absent name (the dashboard's own product label).
 */
export function brandLabel(appName: string | undefined): string {
  if (appName === undefined || appName.trim().length === 0) return 'Console'
  return appName
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** The backend-ready destination keys → label (Pass 1) — the deep-linkable pages. */
const READY_PAGES: ReadonlyMap<string, string> = new Map(
  DATA_NAV_PAGES.filter((page) => page.ready).map((page) => [page.key, page.label])
)

/** Whether `page` is a backend-ready Data destination (has a deep-linkable surface). */
export function isReadyDataPage(page: string): boolean {
  return READY_PAGES.has(page)
}

/** The English label for a ready Data destination key (`undefined` when not ready). */
export function readyDataPageLabel(page: string): string | undefined {
  return READY_PAGES.get(page)
}
