/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import { DataNavGroup } from './admin-sidebar-data-groups'
import {
  DATA_NAV_ITEMS,
  DATA_NAV_SECTION_LABELS,
  DATA_NAV_SECTION_ORDER,
  type DataNavItem,
  type DataNavSection,
} from './admin-sidebar-data-nav'
import {
  DEVELOPER_NAV_ITEMS,
  DEVELOPER_NAV_SECTION_LABEL,
  type DeveloperNavItem,
} from './admin-sidebar-developer-nav'
import { FamilyGlyph } from './admin-sidebar-icon'

export function OverviewNavLink({ activePath }: { readonly activePath: string }): ReactElement {
  const active = activePath === '/'
  return (
    <a
      href="/_admin"
      aria-current={active ? 'page' : undefined}
      data-testid="data-nav-overview"
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        active
          ? 'bg-warmth-subtle text-warmth-fg font-medium'
          : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
      }`}
    >
      <FamilyGlyph icon="component" />
      <span className="flex-1 truncate">Tableau de bord</span>
    </a>
  )
}

function ReadyDataRow({
  item,
  active,
}: {
  readonly item: DataNavItem
  readonly active: boolean
}): ReactElement {
  return (
    <li>
      <a
        href={item.href}
        aria-current={active ? 'page' : undefined}
        data-testid={`data-nav-${item.key}`}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
          active
            ? 'bg-warmth-subtle text-warmth-fg font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

function SoonDataRow({ item }: { readonly item: DataNavItem }): ReactElement {
  return (
    <li>
      <span
        aria-disabled="true"
        data-testid={`data-nav-${item.key}`}
        className="text-foreground-subtle flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm opacity-60"
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
        <span className="border-border text-foreground-subtle rounded-full border px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase">
          Bientôt
        </span>
      </span>
    </li>
  )
}

function isDataRowActive(activePath: string, key: string): boolean {
  const base = `/${key}`
  return activePath === base || activePath.startsWith(`${base}/`)
}

function DataRow({
  item,
  activePath,
}: {
  readonly item: DataNavItem
  readonly activePath: string
}): ReactElement {
  return item.ready ? (
    <ReadyDataRow
      item={item}
      active={isDataRowActive(activePath, item.key)}
    />
  ) : (
    <SoonDataRow item={item} />
  )
}

function DataNavSectionGroup({
  section,
  items,
  activePath,
}: {
  readonly section: DataNavSection
  readonly items: ReadonlyArray<DataNavItem>
  readonly activePath: string
}): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      {}
      <h2 className="text-foreground-subtle px-2 pt-1 pb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
        {DATA_NAV_SECTION_LABELS[section]}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) =>
          section === 'app' && item.ready ? (
            <DataNavGroup
              key={item.key}
              item={item}
              parentActive={isDataRowActive(activePath, item.key)}
              activePath={activePath}
            />
          ) : (
            <DataRow
              key={item.key}
              item={item}
              activePath={activePath}
            />
          )
        )}
      </ul>
    </div>
  )
}

export function DataNavList({ activePath }: { readonly activePath: string }): ReactElement {
  return (
    <nav
      aria-label="Données"
      className="flex flex-col gap-4"
    >
      {DATA_NAV_SECTION_ORDER.map((section) => (
        <DataNavSectionGroup
          key={section}
          section={section}
          items={DATA_NAV_ITEMS.filter((item) => item.section === section)}
          activePath={activePath}
        />
      ))}
    </nav>
  )
}

function DeveloperNavRow({
  item,
  active,
}: {
  readonly item: DeveloperNavItem
  readonly active: boolean
}): ReactElement {
  return (
    <li>
      <a
        href={item.href}
        aria-current={active ? 'page' : undefined}
        data-testid={`developer-nav-${item.key}`}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
          active
            ? 'bg-warmth-subtle text-warmth-fg font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

export function DeveloperNavList({ activePath }: { readonly activePath: string }): ReactElement {
  return (
    <nav
      aria-label={DEVELOPER_NAV_SECTION_LABEL}
      className="flex flex-col gap-0.5"
    >
      <h2 className="text-foreground-subtle px-2 pt-1 pb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
        {DEVELOPER_NAV_SECTION_LABEL}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {DEVELOPER_NAV_ITEMS.map((item) => (
          <DeveloperNavRow
            key={item.key}
            item={item}
            active={isDataRowActive(activePath, item.key)}
          />
        ))}
      </ul>
    </nav>
  )
}
