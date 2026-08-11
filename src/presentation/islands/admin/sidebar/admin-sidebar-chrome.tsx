/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Native Admin Dashboard sidebar chrome: the brand
 * header, the ⌘K page-search trigger, and the signed-in operator identity bar.
 * Split from `admin-sidebar-island.tsx` to keep both files under the eco
 * `max-lines: 250` cap; the operator hook + brand-label helper live in the
 * non-component `admin-sidebar-data.ts` so this file only exports components.
 */

import { type ReactElement } from 'react'
import { AdminOperatorMenu } from './admin-operator-menu'
import { brandLabel, type Operator } from './admin-sidebar-data'

/**
 * The brand header: monogram mark, app name (a link to the live app root, opened
 * in a new tab so the console stays put), and the config-version chip. The whole
 * mark+name is the `/` link; the version chip sits outside it as quiet metadata.
 * `version` is resolved by the island ({@link useVersion}) — the operator app's
 * `app.version`, or the running Sovrium build version when the app declares none.
 */
export function BrandHeader({
  appName,
  version,
}: {
  readonly appName: string | undefined
  readonly version: string | undefined
}): ReactElement {
  const label = brandLabel(appName)
  return (
    <div className="flex items-center gap-2">
      <a
        href="/"
        target="_blank"
        rel="noopener"
        aria-label={`Open ${label} in a new tab`}
        className="hover:text-foreground-muted focus-visible:ring-primary flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      >
        <span className="bg-foreground text-background flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
          {label.charAt(0).toUpperCase()}
        </span>
        <span className="text-foreground truncate text-sm font-semibold">{label}</span>
      </a>
      {version !== undefined && version.length > 0 && (
        <span className="bg-background-subtle text-foreground-subtle shrink-0 rounded-full px-2 py-0.5 font-mono text-xs">
          {version}
        </span>
      )}
    </div>
  )
}

/**
 * The page-search trigger — opens the ⌘K palette to jump to a Data page. It is
 * the dashboard's single `Search` affordance: the chrome bar no longer
 * carries a duplicate button, so this lives at the top of the sidebar (matching
 * prototype 05). Placing it in the sidebar makes keyboard navigation flow
 * correctly — focusing it and pressing Tab moves into the sidebar nav
 *. The `CommandPaletteCapture` inline
 * script opens the palette on click via the `[aria-label="Search"]` target,
 * before the palette island hydrates. `focus-visible` draws a clear keyboard
 * focus ring (no ring on mouse click).
 */
export function SearchTrigger(): ReactElement {
  return (
    <button
      type="button"
      aria-label="Search"
      className="border-border text-foreground-subtle hover:text-foreground focus-visible:ring-primary flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
      >
        <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />
      </svg>
      <span className="flex-1 text-left">Search...</span>
      <span className="text-foreground-subtle text-xs">⌘K</span>
    </button>
  )
}

/**
 * The signed-in operator bar pinned to the sidebar foot. Once the session
 * resolves it becomes the {@link AdminOperatorMenu} trigger (a config-native
 * `dropdown-menu` — account / feedback / bug report / sign out); until then it
 * shows a calm loading line so the foot never flashes an empty slot.
 */
export function OperatorBar({
  operator,
}: {
  readonly operator: Operator | undefined
}): ReactElement {
  if (operator === undefined) {
    return (
      <div className="border-border text-foreground-subtle border-t px-2 pt-3 text-xs">
        Session en cours…
      </div>
    )
  }
  return <AdminOperatorMenu operator={operator} />
}

/**
 * The quiet Sovrium build-version line pinned to the very foot of the sidebar,
 * below the operator bar. It reports which Sovrium the operator is running
 * (`Sovrium vX.Y.Z`) as plain platform metadata — deliberately distinct from
 * the brand chip's app-config version above. Mono + muted + tiny so it reads as
 * an unobtrusive footer, never competing with the operator's own identity bar.
 * Renders nothing until the version resolves (see {@link useBuildVersionOnly}).
 */
export function BuildVersionFooter({
  buildVersion,
}: {
  readonly buildVersion: string | undefined
}): ReactElement | null {
  if (buildVersion === undefined || buildVersion.length === 0) {
    // eslint-disable-next-line unicorn/no-null -- React renders null, not undefined
    return null
  }
  return (
    <div className="text-foreground-subtle px-2 font-mono text-[0.6875rem] tracking-tight">
      Sovrium v{buildVersion}
    </div>
  )
}
