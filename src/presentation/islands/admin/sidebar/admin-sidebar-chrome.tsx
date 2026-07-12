/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import { AdminOperatorMenu } from './admin-operator-menu'
import { brandLabel, type Operator } from './admin-sidebar-data'

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
        aria-label={`Ouvrir ${label} dans un nouvel onglet`}
        className="hover:text-warmth-fg focus-visible:ring-primary flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
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

export function SearchTrigger(): ReactElement {
  return (
    <button
      type="button"
      aria-label="Rechercher"
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
      <span className="flex-1 text-left">Rechercher...</span>
      <span className="text-foreground-subtle text-xs">⌘K</span>
    </button>
  )
}

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

export function BuildVersionFooter({
  buildVersion,
}: {
  readonly buildVersion: string | undefined
}): ReactElement | null {
  if (buildVersion === undefined || buildVersion.length === 0) {
    return null
  }
  return (
    <div className="text-foreground-subtle px-2 font-mono text-[0.6875rem] tracking-tight">
      Sovrium v{buildVersion}
    </div>
  )
}
