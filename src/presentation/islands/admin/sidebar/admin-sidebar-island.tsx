/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `admin-sidebar` island — the Native Admin Dashboard sidebar.
 *
 * The dashboard is a pure operational DATA console (config code-only, [internal ref]):
 * config changes ONLY by editing the app config file, so the sidebar is now
 * NAVIGATION-ONLY over the Data pages — there is no Config/Data tab control
 * and no config-family zones. The body is the flat {@link DataNavList} of
 * runtime-data destinations (records, runs, submissions, users, …).
 *
 * Chrome (brand header, search trigger, active-row highlight, signed-in operator
 * identity) is rendered here so the sidebar reads as the console shell: a
 * scannable glyph + label list, paper-warm, separated by border, with a single
 * terracotta `warmth` accent reserved for the active row.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { subscribeAdminNavigated } from '../spa-nav/admin-spa-nav'
import { BrandHeader, OperatorBar, SearchTrigger } from './admin-sidebar-chrome'
import { useBuildVersionOnly, useOperator, useVersion } from './admin-sidebar-data'
import { DataNavList, DeveloperNavList, OverviewNavLink } from './admin-sidebar-data-tabs'

interface AdminSidebarIslandProps {
  /**
   * Retained for prop compatibility with the shell host (which still passes the
   * F-tier / read-only flag); inert in the Data-only console.
   */
  readonly canEdit?: boolean
  /** Operator app name (slug); rendered as the brand label, title-cased. */
  readonly appName?: string
  /**
   * The administered app's config version (`app.version`), shown as the brand
   * version chip. When absent, the sidebar falls back to the running Sovrium
   * build version (see {@link useVersion}).
   */
  readonly appVersion?: string
  /** Retained for prop compatibility with the shell host; inert (always nav-only). */
  readonly collapsed?: boolean
}

/** The active dashboard path (e.g. `/data/tables/clients`), `/_admin`-stripped. */
function activePath(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname.replace(/^\/_admin/, '') || '/'
}

/**
 * Track the active dashboard path: seed from `window.location`, re-read on mount,
 * and re-highlight when the SPA nav module swaps content WITHOUT re-creating the
 * sidebar — the announced path is already
 * `/_admin`-stripped, matching `activePath()`.
 */
function useActivePath(): string {
  const [path, setPath] = useState<string>(() => activePath())
  useEffect(() => {
    setPath(activePath())
    return subscribeAdminNavigated(setPath)
  }, [])
  return path
}

/** Admin-sidebar island — the Data-only operator navigation. */
export default function AdminSidebarIsland({
  appName,
  appVersion,
}: AdminSidebarIslandProps): ReactElement {
  const path = useActivePath()
  const operator = useOperator()
  // Brand chip = the administered app's OWN config version (`app.version`,
  // default 1.0.0); the account menu closes on the running Sovrium build
  // version — two distinct facts, never conflated in one chip.
  const version = useVersion(appVersion)
  const buildVersion = useBuildVersionOnly()

  return (
    <div
      data-dashboard-sidebar
      className="flex h-full flex-col gap-5"
    >
      <BrandHeader
        appName={appName}
        version={version}
      />
      <SearchTrigger />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {/* The "Dashboard" overview link sits ABOVE the Data landmark —
            it is the dashboard root, a separate destination from the Data-page
            navigation. Kept outside `<DataNavList>` so that `navigation
            "Data"` landmark stays present + separate. */}
        <OverviewNavLink activePath={path} />
        <DataNavList activePath={path} />
        {/* The Developers section (API + MCP docs) sits below the Data nav
            as its own landmark — these are integration docs, not data
            destinations. */}
        <DeveloperNavList activePath={path} />
      </div>
      <OperatorBar
        operator={operator}
        buildVersion={buildVersion}
      />
    </div>
  )
}
