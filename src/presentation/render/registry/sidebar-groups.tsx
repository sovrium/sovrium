/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, type ReactElement } from 'react'
import {
  computeSidebarGroupClasses,
  computeSidebarGroupLabelClasses,
  computeSidebarGroupListClasses,
  computeSidebarNavClasses,
  computeSidebarRailNavClasses,
  type SidebarRailBreakpoint,
} from '@/presentation/design/sidebar-default-classes'
import { resolveChildTranslation } from '../i18n/translation-handler'
import {
  disclosureListId,
  isExpandable,
  railFlag,
  renderDisclosureEntry,
  renderEntry,
  type SidebarI18n,
} from './sidebar-entry'
import type { SidebarGroup } from '@/domain/models/app/pages/components/component-types/layout/sidebar'

/**
 * A contiguous run of groups sharing ONE navigation landmark.
 *
 * `landmark: undefined` is the lone-group case — the shape every sidebar had
 * before `landmark` existed, where the group IS its own landmark named by its
 * own label.
 */
interface LandmarkRun {
  readonly landmark: string | undefined
  readonly groups: readonly SidebarGroup[]
}

/**
 * Fold the declared groups into landmark runs.
 *
 * A landmark wraps a CONTIGUOUS run because the sidebar renders groups in
 * declared order, and gathering a split run into one `nav` would silently
 * reorder a navigation the author wrote deliberately. A run interrupted by a
 * different landmark is refused at BOOT (`sidebarNavigationViolations`), so the
 * only shape that reaches here is the contiguous one.
 */
function toLandmarkRuns(groups: readonly SidebarGroup[]): readonly LandmarkRun[] {
  return groups.reduce<readonly LandmarkRun[]>((runs, group) => {
    const last = runs[runs.length - 1]
    if (group.landmark !== undefined && last !== undefined && last.landmark === group.landmark) {
      return [...runs.slice(0, -1), { landmark: last.landmark, groups: [...last.groups, group] }]
    }
    return [...runs, { landmark: group.landmark, groups: [group] }]
  }, [])
}

/**
 * One group's label, and the entries under it.
 *
 * Inside a landmark the label may be a REAL heading (`headingLevel`), which is
 * what makes the section reachable by a heading-navigation key — a styled
 * paragraph looks identical and is reachable by nothing. Outside one it stays
 * that paragraph: the group is already named by its own landmark, and a heading
 * repeating it announces the same words twice to the same reader.
 *
 * A group with NO label emits neither, and that is the whole of the label-less
 * shape on this side: its entries alone, so the `ul` becomes a direct child of
 * the navigation root and inherits every descendant rule hanging off it.
 * `headingLevel` cannot reach that branch — a label-less group carrying one is
 * refused at boot rather than rendering an empty heading.
 */
function renderGroupBody(
  group: SidebarGroup,
  i18n: SidebarI18n,
  trackNavigation: boolean,
  rail: SidebarRailBreakpoint | undefined
): ReactElement {
  const label =
    group.label === undefined
      ? undefined
      : resolveChildTranslation(group.label, i18n.currentLang, i18n.languages)
  const Heading = group.headingLevel === undefined ? undefined : (`h${group.headingLevel}` as const)
  return (
    <>
      {label !== undefined &&
        (Heading === undefined ? (
          <p className={computeSidebarGroupLabelClasses(rail)}>{label}</p>
        ) : (
          <Heading className={computeSidebarGroupLabelClasses(rail)}>{label}</Heading>
        ))}
      {group.items !== undefined && group.items.length > 0 && (
        <ul className={computeSidebarGroupListClasses()}>
          {group.items.map((item, index) => (
            // A toggle entry has no href, so the key falls back to the label for
            // the same reason `disclosureListId` does — the index alone already
            // makes it unique, and `undefined-0` names nothing.
            <li key={`${item.href ?? item.label}-${index}`}>
              {isExpandable(item)
                ? renderDisclosureEntry(item, i18n, disclosureListId(item, index), {
                    trackNavigation,
                    ...(rail === undefined ? {} : { rail }),
                  })
                : renderEntry(item, i18n, false, rail)}
            </li>
          ))}
        </ul>
      )}
      {group.source !== undefined && renderSourcedEntries(group.source, group.label, rail)}
    </>
  )
}

/**
 * Render a sidebar's `groups` as named navigation landmarks.
 *
 * A bare `sidebar` renders a `div` and nothing else, so an app wanting
 * navigation inside it hand-writes a tree of containers, headings and anchors —
 * which is how Sovrium's own admin sidebar came to be TypeScript rather than
 * config. Rendering the shape here makes it declarative and, more importantly,
 * ACCESSIBLE BY CONSTRUCTION.
 *
 * ─── WHY A LANDMARK PER GROUP, AND WHEN NOT ────────────────────────────────
 *
 * A single unnamed landmark holding every group means a screen-reader user
 * cycling landmarks meets one "navigation" and has to read all of it to reach
 * the section they wanted. So by default the group IS the landmark, named by
 * its own label, and each section is reachable BY NAME.
 *
 * That is wrong in the other direction when several groups are subdivisions of
 * ONE navigation: the reader then meets four "navigation"s where the author
 * meant one holding four headings. `landmark` says which named landmark a group
 * belongs to, and `headingLevel` turns its label into a heading rather than a
 * landmark's name — so which of the two shapes applies is the author's call and
 * not the renderer's.
 *
 * The landmarks are server-rendered even for a group that fetches its entries,
 * so navigation exists before — and without — JavaScript.
 */
export function renderSidebarGroups(
  groups: readonly SidebarGroup[],
  i18n: SidebarI18n,
  trackNavigation = false,
  rail: SidebarRailBreakpoint | undefined = undefined
): ReactElement {
  return (
    // The `key` is load-bearing, not decoration: `sidebar` in
    // `structural-components.tsx` spreads this element into a children ARRAY
    // alongside the authored `renderedChildren`, and React requires a key on
    // every child of a list. With no authored children that array has length
    // one, which is still a list. The literal cannot collide with the
    // siblings: `renderChildren` keys them by numeric index ("0", "1", ...),
    // so a non-numeric name cannot clash, by construction.
    // The rail's row rules live HERE and not on each row: the two navigation
    // islands redraw rows this renderer never sees, and a descendant rule on the
    // root is what makes their output rail too. Nothing is appended when no rail
    // is declared, so the class list stays the one it has always been.
    <div
      key="sidebar-groups"
      className={`${computeSidebarNavClasses()}${
        rail === undefined ? '' : ` ${computeSidebarRailNavClasses(rail)}`
      }`}
      data-sidebar-root=""
    >
      {trackNavigation && (
        <span
          data-island="sidebar-current"
          data-island-props="{}"
        />
      )}
      {toLandmarkRuns(groups).map((run, index) =>
        renderLandmarkRun(run, index, { i18n, trackNavigation, rail })
      )}
    </div>
  )
}

/**
 * One landmark run: either an unwrapped set of entries, or a `nav`.
 *
 * ─── THE UNWRAPPED CASE ────────────────────────────────────────────────────
 *
 * A run that is neither a declared landmark nor a LABELLED group names nothing,
 * so it wraps in nothing: no `nav`, no group `div`, no heading. Its entries
 * render straight into the navigation root, above the first labelled group —
 * which is what makes them inherit the root's descendant rules (the rail's rows)
 * and stay reachable by the client tracker's `a[data-sidebar-entry]`.
 *
 * Wrapping them in an unnamed `nav` instead would add a second "navigation" to
 * a landmark-cycling reader for what is usually a single row, which is exactly
 * the cost the label-less shape exists to avoid.
 *
 * Such a run always holds exactly ONE group: `toLandmarkRuns` merges only on a
 * DECLARED landmark, so a group without one always opens its own run.
 */
function renderLandmarkRun(run: LandmarkRun, index: number, ctx: RunContext): ReactElement {
  const first = run.groups[0]
  if (run.landmark === undefined && first?.label === undefined) {
    return (
      <Fragment key={`unlabelled-${index}`}>
        {run.groups.map((group, groupIndex) => (
          <Fragment key={`unlabelled-${index}-${groupIndex}`}>{renderBody(group, ctx)}</Fragment>
        ))}
      </Fragment>
    )
  }
  return renderNamedRun(run, index, ctx)
}

/** What every group body below this point needs, as one bag. */
interface RunContext {
  readonly i18n: SidebarI18n
  readonly trackNavigation: boolean
  readonly rail: SidebarRailBreakpoint | undefined
}

const renderBody = (group: SidebarGroup, ctx: RunContext): ReactElement =>
  renderGroupBody(group, ctx.i18n, ctx.trackNavigation, ctx.rail)

/**
 * A run that HAS a name: a declared `landmark`, or a lone group named by its
 * own label. Either way it is a `nav`, and the name is its accessible name.
 */
function renderNamedRun(run: LandmarkRun, index: number, ctx: RunContext): ReactElement {
  const ownLandmark = run.landmark === undefined
  const runName = run.landmark ?? run.groups[0]?.label ?? ''
  const name = resolveChildTranslation(runName, ctx.i18n.currentLang, ctx.i18n.languages)
  return (
    // Keyed on the landmark plus its POSITION, never on a group label alone:
    // two runs may legitimately hold groups of the same name, and a duplicate
    // key makes React drop one of them.
    <nav
      key={`${runName || 'group'}-${index}`}
      aria-label={name}
      className={ownLandmark ? computeSidebarGroupClasses() : computeSidebarNavClasses()}
      {...(ownLandmark
        ? { 'data-sidebar-group': run.groups[0]?.label }
        : { 'data-sidebar-landmark': run.landmark })}
    >
      {run.groups.map((group, groupIndex) =>
        ownLandmark ? (
          <Fragment key={`${group.label}-${groupIndex}`}>{renderBody(group, ctx)}</Fragment>
        ) : (
          <div
            key={`${group.label}-${groupIndex}`}
            className={computeSidebarGroupClasses()}
            data-sidebar-group={group.label}
          >
            {renderBody(group, ctx)}
          </div>
        )
      )}
    </nav>
  )
}

/**
 * The island host for a group's FETCHED entries.
 *
 * Only the fetched half is islanded, and that is the whole design. The authored
 * entries above stay server-rendered, so they work without JavaScript, keep
 * their icons out of the client bundle, and — because an island REPLACES the
 * SSR children it mounts over — cannot be duplicated or dropped by the mount.
 * Document order then gives the spec's guarantee for free: authored first,
 * fetched after.
 *
 * The props carry only what the fetch needs. The endpoint has already had any
 * `:param` substituted server-side (`bindRouteParams`), so the island never
 * sees a route placeholder it could not resolve.
 *
 * `query` travels as its OWN prop rather than pre-appended to the endpoint here,
 * because that is the encoding every other system-source consumer already uses:
 * the KPI and chart reads hand `{ endpoint, query }` to `buildSystemQueryUrl`
 * and let one helper own the merge. Folding it into the path server-side would
 * give this one binding a second spelling of a shape the schema shares.
 */
function renderSourcedEntries(
  source: NonNullable<SidebarGroup['source']>,
  label: string | undefined,
  rail: SidebarRailBreakpoint | undefined
): ReactElement {
  return (
    <div
      data-island="sidebar-groups"
      data-island-props={JSON.stringify({
        endpoint: source.endpoint,
        // The row rules reach these rows from the navigation root; the TOOLTIP
        // cannot, because it is an attribute rather than a paint. A fetched row
        // is the one a rail most needs it on — its label is the only thing
        // naming it, and the endpoint decides what that label says.
        ...railFlag(rail),
        rowsKey: source.rowsKey ?? 'items',
        labelKey: source.labelKey,
        hrefTemplate: source.hrefTemplate,
        ...(source.itemProps === undefined ? {} : { itemProps: source.itemProps }),
        ...(source.query === undefined ? {} : { query: source.query }),
      })}
      // A label-less group names nothing, so this is the empty string rather
      // than `undefined`: React omits an undefined attribute entirely, which
      // would leave a FETCHED label-less group's island host with no addressing
      // hook at all. `[data-sidebar-source]` still finds it; only
      // `[data-sidebar-source="Data"]` cannot, and there is no name to match.
      data-sidebar-source={label ?? ''}
    />
  )
}
