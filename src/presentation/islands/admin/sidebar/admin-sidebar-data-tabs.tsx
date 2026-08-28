/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Native Admin Dashboard sidebar's **Data** page list
 *.
 *
 * The dashboard is a pure operational DATA console (config code-only, [internal ref]):
 * the sidebar is navigation-only over the Data pages — there is no longer a
 * Config/Data segmented control. {@link DataNavList} is the whole sidebar
 * body. The active row is DERIVED from the URL by the island (no separate client
 * state), so it composes for free with the SPA content-swap and back/forward.
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

/**
 * The "Dashboard" overview link. Sits at the
 * TOP of the sidebar, ABOVE the `navigation "Data"` landmark — it points to
 * the reclaimed dashboard root (`/_admin`, the cross-domain KPI overview), which
 * is a distinct destination from the Data-page navigation below. Rendered outside
 * the Data landmark so that landmark stays present + separate (the spec checks
 * both). Active (`aria-current="page"`) when the URL-derived `activePath` is the
 * root (`/`); a glyph + label styled like {@link ReadyDataRow}.
 */
export function OverviewNavLink({ activePath }: { readonly activePath: string }): ReactElement {
  const active = activePath === '/'
  return (
    <a
      href="/_admin"
      aria-current={active ? 'page' : undefined}
      data-testid="data-nav-overview"
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        active
          ? 'text-foreground-muted bg-background-subtle font-medium'
          : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
      }`}
    >
      <FamilyGlyph icon="component" />
      <span className="flex-1 truncate">Dashboard</span>
    </a>
  )
}

/** A single backend-ready Data page row: a navigable glyph + label link. */
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
            ? 'text-foreground-muted bg-background-subtle font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

/**
 * A backend-gap Data page row: a disabled, non-navigable row with a "Coming soon"
 * pill so the workspace IA reads complete (Pass 2 ships the backend and promotes
 * it to a {@link ReadyDataRow}).
 */
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
          Coming soon
        </span>
      </span>
    </li>
  )
}

/**
 * Whether a Data-page row is the active one for the current path. A row matches
 * its own top-level `/{key}` page AND any object-scoped sub-path under it
 * (`/{key}/{object}`) — so the "Records" row stays accented when an
 * operator drills into a table's grid (`/tables/contacts`). The prefix test is
 * anchored on `/{key}` followed by end-or-slash, so `/forms` never lights up the
 * `/form` row of a hypothetical sibling. ([internal ref] retired the `/data` segment, so
 * `activePath` is now the top-level `/_admin`-stripped path.)
 */
function isDataRowActive(activePath: string, key: string): boolean {
  const base = `/${key}`
  return activePath === base || activePath.startsWith(`${base}/`)
}

/** Render one destination row — a navigable link, or a disabled "Coming soon" row. */
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

/**
 * One nav section: a quiet uppercase heading followed by its destination rows.
 * The Application section renders Notion-style expandable {@link DataNavGroup}
 * disclosures (each lazy-loads its object list — [internal ref]); the System
 * section renders flat {@link DataRow} links (single nav items, no toggle).
 *
 * The switch is on `section === 'app'` ALONE, so moving a destination into the
 * Application section is what turns it into a disclosure — there is no per-key
 * opt-in. A destination moved here without a list endpoint expands to "No
 * items.", so the move and its endpoint belong in the same change. Both
 * stay inside the single `navigation "Data"` landmark so the section is a
 * visual grouping, not a second landmark.
 */
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
      {/* A real heading (not a styled <p>) so screen-reader users can navigate
          the sidebar by section, matching the Linear/Stripe operator-console
          pattern. Visually it stays a quiet uppercase micro-label. */}
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

/**
 * The Data-tab page list: a single `navigation "Data"` landmark whose rows
 * are grouped into two labelled sections — the operator's own application data
 * ("Application": Records / Submissions / Files / Conversations) and the
 * platform-level system data ("System": Automations / Users / Connections /
 * Analytics / Footprint). `activePath` (the `/_admin`-stripped active path)
 * drives the active-row highlight via each item's `/{key}` href, including
 * object-scoped sub-paths (see {@link isDataRowActive}).
 */
export function DataNavList({ activePath }: { readonly activePath: string }): ReactElement {
  return (
    <nav
      aria-label="Data"
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

/** One Developers row: a navigable glyph + label link (same style as a Data row). */
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
            ? 'text-foreground-muted bg-background-subtle font-medium'
            : 'text-foreground-muted hover:text-foreground hover:bg-background-subtle'
        }`}
      >
        <FamilyGlyph icon={item.icon} />
        <span className="flex-1 truncate">{item.label}</span>
      </a>
    </li>
  )
}

/**
 * The Developers nav list: a
 * SECOND `navigation` landmark below the Data nav, grouping the auto-generated
 * integration docs — the REST API reference (`/_admin/api`) and the MCP
 * connection guide (`/_admin/mcp`). Kept as its own landmark (not a section of
 * the Data nav) because these are management/docs surfaces, not data
 * destinations. `activePath` (the `/_admin`-stripped active path) drives the
 * active-row highlight, matching on `/{key}` exactly or any sub-path under it.
 */
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
