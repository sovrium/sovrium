/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import MenuIsland from '@/presentation/islands/overlays/menu-island'
import type { Operator } from './admin-sidebar-data'

const FEEDBACK_URL = 'https://github.com/sovrium/sovrium/issues/new?labels=feedback'
const BUG_REPORT_URL = 'https://github.com/sovrium/sovrium/issues/new?labels=bug'

const ACCOUNT_PATH = '/_admin/gdpr'

const OPERATOR_MENU_ITEMS = [
  { label: 'Mon compte', action: { type: 'navigate', path: ACCOUNT_PATH } },
  { separator: true },
  { label: 'Donner un avis', action: { type: 'navigate', path: FEEDBACK_URL } },
  { label: 'Signaler un bug', action: { type: 'navigate', path: BUG_REPORT_URL } },
  { separator: true },
  {
    label: 'Se déconnecter',
    variant: 'destructive' as const,
    action: { type: 'auth', method: 'logout', onSuccess: { navigate: '/_admin/login' } },
  },
] as const

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

export function AdminOperatorMenu({ operator }: { readonly operator: Operator }): ReactElement {
  return (
    <MenuIsland
      floatingSide="top"
      floatingAlign="start"
      triggerClassName={TRIGGER_CLASSES}
      triggerAriaLabel="Menu du compte"
      triggerContent={<ProfileTriggerContent operator={operator} />}
      menuItems={OPERATOR_MENU_ITEMS}
    />
  )
}
