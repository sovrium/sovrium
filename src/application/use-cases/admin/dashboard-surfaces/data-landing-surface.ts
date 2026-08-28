/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Data-tab destination placeholder surface.
 *
 * Each Data destination opens INSIDE the persistent shell ({@link wrapInShell}) so
 * the flat sidebar + breadcrumb persist around it. A backend-ready destination whose
 * full page is not yet built renders an honest "coming soon" placeholder (with a way
 * back to the dashboard root). [internal ref] reclaimed the dashboard root (`/_admin`)
 * for the "Dashboard" overview (owned by overview.spec.ts) and RETIRED the
 * former "Data" card-grid landing — the flat sidebar is now the complete
 * navigation, so the landing builder it duplicated was removed.
 */

import { homeCrumb, wrapInShell } from './dashboard-shell-surface'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

// The ready-page predicates live in the domain taxonomy (shared with the
// presentation sidebar island); re-exported here so the surface builder imports
// the Data-tab surface contract from one module.
export { isReadyDataPage, readyDataPageLabel } from '@/domain/utils/admin-data-nav'

/**
 * The shell concerns the Data-tab surfaces thread into {@link wrapInShell}: the
 * F5/F6 editing posture plus the operator slug + published snapshot that seed the
 * shell sidebar's brand label and count badges.
 */
export interface ConsolePosture {
  /** F5/F6 editing posture (threaded into the shell sidebar). */
  readonly canEdit: boolean
  /**
   * Whether the admin PLANE will honour this caller's account writes —
   * `isAdminEquivalent(role, app)`, the same predicate
   * `applyAdminRoleCheckMiddleware` and `requireAdminCaller` apply.
   *
   * Distinct from {@link ConsolePosture.canEdit}, which is a constant `true`
   * for every caller that reaches the console and therefore signals nothing. A
   * surface consults THIS flag before painting an account-write control: an
   * admin-TIER but non-admin-equivalent operator (`admin-viewer`) keeps console
   * read and is 404ed on every `/api/auth/admin/*` write, so a
   * "Change role" or "Ban" button rendered for them is a control their own
   * backend refuses.
   */
  readonly canAdministerAccounts: boolean
}

/**
 * The per-request console context: the {@link ConsolePosture} plus the query
 * parameters a surface may derive its own state from.
 *
 * `period` is the analytics window an analytics-shaped surface reads at
 * (`?period=24h|7d|30d`). The window lives in the URL rather than in client
 * state on purpose ([internal ref]..018): back and forward
 * then move between windows for free, a shared link carries the window it was
 * read at, and a reload survives it — none of which needs a line of client code.
 * `toDashboardPath` drops the query string, so path matching is untouched.
 *
 * It is threaded HERE rather than on {@link DataShellOptions} because it is a
 * REQUEST fact, not a shell one: the shell renders identically at every window.
 */
export interface ConsoleRequest extends ConsolePosture {
  /** `?period=` — the analytics window, when the caller asked for one. */
  readonly period?: string
}

export interface DataShellOptions extends ConsolePosture {
  /** Operator slug; seeds the shell sidebar brand label. */
  readonly appName?: string
  /** Operator config version (`app.version`); seeds the sidebar version chip. */
  readonly appVersion?: string
}

/** The placeholder body for a ready destination whose page lands in the next slice. */
function placeholderBody(label: string): ReadonlyArray<Component> {
  return [
    {
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-2 pt-4' },
      children: [
        {
          type: 'text',
          element: 'h2',
          props: { className: 'text-2xl font-semibold tracking-tight' },
          content: label,
        },
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-muted-foreground max-w-2xl' },
          content:
            'This destination is coming soon. Navigation is in place; the data page ships in a future update.',
        },
        {
          type: 'link',
          props: {
            href: '/_admin',
            className:
              'text-foreground-muted w-fit pt-1 text-sm font-medium hover:underline underline-offset-4',
          },
          content: '← Back to Data',
        },
      ],
    } as unknown as Component,
  ]
}

/**
 * Build the placeholder page for a backend-ready Data destination whose full
 * page is not yet built. Deep-linking `/_admin/{page}` still lands inside the
 * shell, so the sidebar active-row highlight and back/forward all compose; the
 * body is an honest "coming soon" with a way back to the workspace landing.
 */
export function buildDataPagePlaceholder(
  page: string,
  label: string,
  options: DataShellOptions
): Page {
  return {
    id: `dashboard-data-${page}`,
    name: `dashboard-data-${page}`,
    path: `/${page}`,
    meta: { title: `Sovrium — Data · ${label}` },
    components: wrapInShell(placeholderBody(label), {
      canEdit: options.canEdit,
      appName: options.appName,
      appVersion: options.appVersion,
      breadcrumb: [homeCrumb(options.appName), { label }],
    }),
  } as Page
}
