/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signed-in operator's menu for the Native Admin Dashboard sidebar
 *.
 *
 * Consoles-as-Config (batch C3): the operator identity bar at the sidebar foot is
 * now expressed through the config-native `dropdown-menu` ({@link MenuIsland}) —
 * the bespoke inline Base UI menu is gone. The menu carries the operator-account
 * affordances as config `MenuItem` + `Action` data: jump to their own account
 * (`navigate`), give feedback / report a bug (`navigate` to the PUBLIC GitHub
 * issues tracker — never private infra), and sign out (`auth` `method: logout` →
 * back to the login page). The dropdown-menu wires those actions, so this file is
 * just the trigger content (the identity bar) plus the items config.
 */

import { type ReactElement } from 'react'
import MenuIsland from '@/presentation/islands/overlays/menu-island'
import type { Operator } from './admin-sidebar-data'

/**
 * Public GitHub issue-tracker links for the feedback + bug-report actions. Both
 * open `github.com/sovrium/sovrium/issues/new` (the public tracker) — NEVER the
 * private `[internal ref]` instance — with a pre-selected label.
 */
const FEEDBACK_URL = 'https://github.com/sovrium/sovrium/issues/new?labels=feedback'
const BUG_REPORT_URL = 'https://github.com/sovrium/sovrium/issues/new?labels=bug'

/**
 * The operator's own-account destination. Until the dedicated account page lands,
 * "My account" routes to the EXISTING self-service Data & GDPR surface, which
 * already shows the operator their own account data.
 */
const ACCOUNT_PATH = '/_admin/gdpr'

/** The operator menu items, expressed as config `MenuItem` + `Action` data. */
const OPERATOR_MENU_ITEMS = [
  { label: 'My account', action: { type: 'navigate', path: ACCOUNT_PATH } },
  { separator: true },
  { label: 'Give feedback', action: { type: 'navigate', path: FEEDBACK_URL } },
  { label: 'Report a bug', action: { type: 'navigate', path: BUG_REPORT_URL } },
  { separator: true },
  {
    label: 'Sign out',
    variant: 'destructive' as const,
    action: { type: 'auth', method: 'logout', onSuccess: { navigate: '/_admin/login' } },
  },
] as const

/** The identity-bar trigger content (avatar + name + email + chevron). */
function ProfileTriggerContent({ operator }: { readonly operator: Operator }): ReactElement {
  return (
    <>
      <span className="bg-background-subtle text-foreground-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium">
        {operator.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm">{operator.name}</span>
        <span className="text-foreground-subtle block truncate text-xs">{operator.email}</span>
      </span>
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
        className="text-foreground-subtle shrink-0"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </>
  )
}

const TRIGGER_CLASSES =
  'border-border hover:bg-background-subtle focus-visible:ring-primary flex w-full items-center gap-2 rounded-md border-t px-2 pt-3 pb-1 text-left outline-none focus-visible:ring-2'

/**
 * The operator menu: the config `dropdown-menu` anchored above the identity bar
 * pinned to the sidebar foot. `operator` is the signed-in identity (already
 * loaded by the sidebar island).
 */
export function AdminOperatorMenu({ operator }: { readonly operator: Operator }): ReactElement {
  return (
    <MenuIsland
      floatingSide="top"
      floatingAlign="start"
      triggerClassName={TRIGGER_CLASSES}
      triggerAriaLabel="Account menu"
      triggerContent={<ProfileTriggerContent operator={operator} />}
      menuItems={OPERATOR_MENU_ITEMS}
    />
  )
}
