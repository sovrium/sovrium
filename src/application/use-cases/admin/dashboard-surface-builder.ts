/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dynamic dashboard-surface builder ([internal ref] — pure operational data console).
 *
 * Sovrium is config-code-only: the runtime config-EDITING surfaces (the web
 * editor, the per-object Config tabs, the family indexes, the drift/version/
 * activity observability) were retired — config changes ONLY by editing the app
 * config file. What remains is a pure operational DATA console.
 *
 * The embedded `dashboard-app.yaml` is a STATIC config — it cannot know the
 * operator's table names. The Data surfaces are therefore synthesized PER
 * REQUEST from the operator's live app:
 *
 *  - `/`                        → the home shell (Data-nav sidebar + welcome).
 *  - `/data[/:page[/:object]]`  → the Data workspace (records, runs, …).
 *  - `/users` / `/gdpr` / `/mcp` → operator-management surfaces (Better
 *    Auth admin, GDPR self-service, MCP onboarding) — operational, not config.
 *
 * Each surface is composed from EXISTING component-types plus the registered
 * `admin-sidebar` client island. No bespoke React in the render path.
 */

import { parseDataRoute } from './dashboard-surface-routes'
import { buildApiDocsPage } from './dashboard-surfaces/api-docs-surface'
import {
  isDataObjectRedirect,
  type DataObjectRedirect,
} from './dashboard-surfaces/data-object-rail'
import { resolveDataPage, type DataSurface } from './dashboard-surfaces/data-surface-resolver'
import { recordGridTablesFor } from './dashboard-surfaces/data-tables-surface'
import { buildGdprPage } from './dashboard-surfaces/gdpr-surface'
import { buildMcpDocsPage } from './dashboard-surfaces/mcp-docs-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/**
 * The synthesized result for a `/_admin` request: a rendered dashboard `App`, a
 * {@link DataObjectRedirect} (a bare object-page path → 302 to its first object,
 * Pass 1 item 1.5a), or `undefined` (no synthesized surface — render the static
 * dashboard config as-is, e.g. `/login`).
 */
export type DashboardSurfaceResult = App | DataObjectRedirect | undefined

/**
 * The operator app, projected to the read-through config snapshot the dashboard
 * shell sidebar sources from. The operator `App` IS the published/effective
 * config (booted live), so its top-level keys are exactly the snapshot the
 * sidebar reads.
 */
function publishedSnapshotOf(operatorApp: App): Readonly<Record<string, unknown>> {
  return operatorApp as unknown as Readonly<Record<string, unknown>>
}

/** Shell concerns shared by the operator-management surfaces. */
type ManagementShell = {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

/**
 * The operator-management surfaces, keyed by their dashboard path. These are
 * operational (API + MCP docs / GDPR self-service) — not config editing — so
 * they survive the config-code-only reshape. [internal ref] retired the `/data` segment
 * and moved the Data destinations to top-level `/_admin/{key}`; the Users
 * DATA directory now owns `/_admin/users` (resolved by the Data parser BEFORE
 * this map), so the former `/users` Better-Auth admin-operators surface is no
 * longer mounted here.
 *
 * Each builder receives the shell concerns AND the live operator `App`, so the
 * auto-generated docs surfaces (API / MCP) can derive their content (example
 * requests, exposed MCP tools) from the administered app's config.
 */
const MANAGEMENT_BUILDERS: Readonly<
  Record<string, (shell: ManagementShell, operatorApp: App) => Page>
> = {
  // API — auto-generated REST API reference (base URL, auth, examples, Scalar).
  '/api': (shell, app) => buildApiDocsPage('Sovrium — API', app, shell),
  // MCP — connect an external AI + the config-derived available-tools list.
  '/mcp': (shell, app) => buildMcpDocsPage('Sovrium — MCP', app, shell),
  // My account — the operator's own account: identity + GDPR self-service
  // (export / erasure / cancel). Opened from the profile menu's "My account".
  '/gdpr': (shell) => buildGdprPage('Sovrium — My account', shell),
}

/**
 * Resolve the synthesized dashboard surface for a path: a `Page`, a
 * {@link DataObjectRedirect} (bare object-page → first-object 302, Pass 1 item
 * 1.5a), or `undefined` (no surface).
 */
function resolveSurfacePage(
  operatorApp: App,
  dashboardPath: string,
  canEdit: boolean
): DataSurface | undefined {
  // Data workspace — the operator-data destinations now live at top-level
  // `/_admin/{key}[/{object}]`, and the bare `/_admin` (root) IS the workspace
  // landing ([internal ref] retired the `/data` segment; [internal ref] will reclaim the root for
  // a dashboard overview). `parseDataRoute('/')` → {} → the landing.
  const dataRoute = parseDataRoute(dashboardPath)
  if (dataRoute !== undefined) {
    const dataSurface = resolveDataPage(operatorApp, dataRoute, canEdit, publishedSnapshotOf)
    if (dataSurface !== undefined) return dataSurface
  }

  // Operator-management surfaces (`/api`, `/mcp`, `/gdpr`) —
  // resolved AFTER the Data parser, which only matches known data-page keys, so
  // these never collide.
  const managementBuilder = MANAGEMENT_BUILDERS[dashboardPath]
  if (managementBuilder) {
    return managementBuilder(
      {
        canEdit,
        appName: operatorApp.name,
        appVersion: operatorApp.version,
        publishedSnapshot: publishedSnapshotOf(operatorApp),
      },
      operatorApp
    )
  }

  return undefined
}

/**
 * The operator console's language declaration.
 *
 * The console speaks ENGLISH. The self-hosted binary ships worldwide, so English
 * is the honest default for operator chrome and any other language becomes a
 * locale rather than a hardcode.
 *
 * This declares that intent positively rather than leaning on a fallback:
 * `default`/`supported` state the document language {@link pinPageLanguage}
 * keeps pinned, and `detectBrowser: false` keeps an operator on a French-locale
 * browser from being handed a half-translated console.
 *
 * There is deliberately NO `translations` payload. The console used to override
 * the interpreter strings with French (`datatable.save` → "Enregistrer" and
 * friends) so its dogfooded page components matched its French chrome; with the
 * chrome re-voiced to English, the built-in `INTERPRETER_UI_STRINGS` catalog
 * supplies the English defaults and an override would only re-introduce drift.
 */
const OPERATOR_CONSOLE_LANGUAGES = {
  default: 'en',
  supported: [{ code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const }],
  detectBrowser: false,
} as const

/**
 * Pin the synthesized surface's document language.
 *
 * The console's pages declare no `meta.lang`, so the language resolver used to
 * land on its final `'en-US'` fallback. Declaring {@link
 * OPERATOR_CONSOLE_LANGUAGES} inserts `languages.default` ahead of that
 * fallback, which would silently change `<html lang>` from `en-US` to `en`.
 * Stating the page's language explicitly keeps the rendered document identical.
 */
function pinPageLanguage(page: Page): Page {
  if (page.meta?.lang) return page
  return { ...page, meta: { ...page.meta, lang: 'en-US' } } as Page
}

/**
 * Build the dashboard surface for a synthesized-surface request.
 *
 * Returns a dashboard `App` whose `pages` resolve `dashboardPath`; a
 * {@link DataObjectRedirect} when a bare object-page path must 302 to its first
 * object (Pass 1 item 1.5a — the route handler turns it into `c.redirect`); or
 * `undefined` when the path has no synthesized surface (the caller then renders
 * the static dashboard config as-is — e.g. the `/login` page).
 *
 * @param dashboardApp - the embedded dashboard `App` (the static host config)
 * @param operatorApp  - the operator's live `App` (source of the table schema)
 * @param dashboardPath - the `/_admin`-stripped request path
 * @param canEdit - retained for shell-host signature compatibility; the Data
 *   console is read-through and does not mutate config.
 */
export async function buildDashboardSurfaceApp(
  dashboardApp: App,
  operatorApp: App,
  dashboardPath: string,
  canEdit: boolean
): Promise<DashboardSurfaceResult> {
  const surface = resolveSurfacePage(operatorApp, dashboardPath, canEdit)
  if (surface === undefined) return undefined
  // A bare object-page path resolved to a first-object 302 redirect — propagate
  // the signal so the route handler emits `c.redirect` before rendering any page.
  if (isDataObjectRedirect(surface)) return surface
  const page: Page = surface

  // Replace any static page that already claims this path (e.g. the embedded
  // home `/`), so `renderPage(surfaceApp, dashboardPath)` resolves OUR
  // synthesized page rather than the static placeholder.
  const basePages = (dashboardApp.pages ?? []).filter((p) => p.path !== page.path)

  // The record-grid resolves columns / field meta / permissions from the
  // rendering app's `tables`, so the synthesized surface app must carry the
  // operator table the surface administers (else the grid renders no columns).
  const operatorTables = recordGridTablesFor(operatorApp, dashboardPath)

  return {
    ...dashboardApp,
    // The operator console speaks English — every label it writes for itself
    // ("Records", "No tables yet", the sidebar) and every control label the
    // shared page components it dogfoods draw from the interpreter string
    // catalog. Declaring the language here states that intent to the renderer
    // rather than leaving it to a fallback.
    languages: OPERATOR_CONSOLE_LANGUAGES,
    // Opt the dashboard surfaces out of the AUTO-APPENDED platform Cmd+K RECORD
    // palette: the dashboard expresses its OWN ⌘K palette explicitly in the shell
    // (the config-native `command-palette` component, admin mode, that hosts the
    // `admin-search-palette` island over `/api/admin/search`). Leaving `enabled`
    // on would append a SECOND generic record palette on the same ⌘K.
    palette: { enabled: false },
    // The "Built with Sovrium" badge is hard-coded OFF on the /_admin operator
    // console (it is Sovrium's own product UI, not a generated app surface).
    badge: false,
    tables: [...(dashboardApp.tables ?? []), ...operatorTables],
    pages: [...basePages, pinPageLanguage(page)],
  } as App
}
