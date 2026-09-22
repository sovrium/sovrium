/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Family 5b of the page decode rules — a sidebar's landmark grouping, its
 * per-element `props` bags, and its disclosures.
 *
 * Split out of `page-binding-validation.ts` only so that file stays under its
 * per-file `max-lines` cap, exactly as `component-rule-validation.ts` and
 * `shared-filter-validation.ts` were. Called from
 * `collectPageBindingViolations` and from nowhere else, and sharing its
 * contract: pure, no I/O, no schema import, human-readable messages, empty when
 * the page is well-formed.
 *
 * Every rule here is decidable from the `sidebar` node alone. None of them lives
 * on `SidebarGroupSchema` for the reason the caller states at length: a
 * `Schema.check` wraps the node it guards, and a wrapped struct stops being
 * addressed by its own identifier in the published property universe.
 *
 * @see ./page-binding-validation.ts — the caller, and the other families
 */

/**
 * The attributes the sidebar RENDERER computes, and which an authored `props`
 * bag may therefore not set.
 *
 * `href` comes from the entry's own field, `aria-current` from the current-page
 * resolution, `aria-expanded` / `aria-controls` from the disclosure state, and
 * the classes from the entry's state (current or not) through the design layer.
 * Letting config supply any of them gives one attribute two owners, and the
 * losing one is dropped with no error at all — which is the failure mode a
 * `props` bag is worst at surfacing, since an unrecognised key is ALREADY
 * dropped silently by `Schema.Record`.
 */
const SIDEBAR_RENDERER_OWNED_PROPS: ReadonlySet<string> = new Set([
  'href',
  'class',
  'className',
  'aria-current',
  'aria-expanded',
  'aria-controls',
])

/** The disclosure-only entry fields, which mean nothing without children. */
const SIDEBAR_DISCLOSURE_ONLY_FIELDS: readonly string[] = [
  'defaultExpanded',
  'expandLabel',
  'collapseLabel',
  'childrenProps',
]

/**
 * The entry fields that need a DESTINATION, and so mean nothing on a top-level
 * entry that omits `href` and is therefore a toggle rather than a link.
 *
 * Each one is dead config on such a row, and dead config in a `props`-adjacent
 * position is the failure this module exists to surface: the sidebar decodes,
 * the sidebar renders, and the author is left believing they configured
 * something. The specific losses:
 *
 *   - `activeMatch` decides how the entry recognises itself as the CURRENT
 *     page. A toggle is not a page and never carries `aria-current`, so the
 *     field selects between two rules neither of which can ever run.
 *   - `expandLabel` / `collapseLabel` name the small chevron that sits BESIDE a
 *     link, where the row's own words belong to the link and the control needs
 *     its own. When the whole row is the toggle its accessible name is already
 *     that label, read with the state `aria-expanded` announces — so an
 *     `aria-label` here would replace the words on the screen with a second
 *     string an author renaming the label could drift apart from.
 */
const SIDEBAR_LINK_ONLY_FIELDS: readonly string[] = ['activeMatch', 'expandLabel', 'collapseLabel']

const groupsOf = (
  nodes: readonly Readonly<Record<string, unknown>>[]
): readonly Readonly<Record<string, unknown>>[] =>
  nodes
    .filter((node) => node['type'] === 'sidebar')
    .flatMap((node) => (Array.isArray(node['groups']) ? node['groups'] : []))
    .filter(isRecord)

const nameOf = (node: Readonly<Record<string, unknown>>): string =>
  typeof node['label'] === 'string' ? node['label'] : 'unnamed'

const itemsOf = (
  group: Readonly<Record<string, unknown>>
): readonly Readonly<Record<string, unknown>>[] =>
  (Array.isArray(group['items']) ? group['items'] : []).filter(isRecord)

/**
 * A landmark wraps a CONTIGUOUS run of groups, so groups sharing one must be
 * listed together.
 *
 * The alternative — silently reordering them into one landmark — moves entries
 * the author placed deliberately, and a navigation whose order the config does
 * not predict is worse than one that refuses to boot.
 */
function landmarkContiguityViolations(
  groups: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  const declared = groups.map((group) =>
    typeof group['landmark'] === 'string' ? group['landmark'] : undefined
  )
  // A group OPENS a landmark when the group before it is not already under the
  // same one. Opening a landmark that appeared earlier means the run was
  // interrupted — which is the whole rule, decided without carrying any state.
  return declared.flatMap((landmark, index) =>
    landmark === undefined ||
    declared[index - 1] === landmark ||
    !declared.slice(0, index).includes(landmark)
      ? []
      : [
          `${label} declares sidebar group "${nameOf(groups[index] as Readonly<Record<string, unknown>>)}" under landmark "${landmark}", which an earlier group already closed — groups sharing a landmark must be listed together, since the sidebar renders them in declared order`,
        ]
  )
}

/**
 * Two navigation landmarks cannot share an accessible name: a reader cycling
 * landmarks meets "navigation, Data" twice and cannot tell which is which,
 * which is the exact loss the named-landmark shape exists to prevent.
 *
 * A LABEL-LESS group is in neither side of the comparison. It emits no landmark
 * at all, so it has no name to collide with — and admitting it would put
 * `nameOf`'s fallback string in the set, where two label-less groups would
 * collide with each other under the literal `unnamed` and a group legitimately
 * declaring `landmark: 'unnamed'` would false-collide with all of them.
 */
function landmarkNameCollisionViolations(
  groups: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  const ownLandmarks = new Set(
    groups
      .filter((group) => group['landmark'] === undefined && typeof group['label'] === 'string')
      .map(nameOf)
  )
  return [
    ...new Set(
      groups.flatMap((group) =>
        typeof group['landmark'] === 'string' && ownLandmarks.has(group['landmark'])
          ? [group['landmark']]
          : []
      )
    ),
  ].map(
    (landmark) =>
      `${label} declares sidebar landmark "${landmark}" and a separate group also named "${landmark}" that is its own landmark — two navigation landmarks cannot share an accessible name`
  )
}

/** Refuse a `props` bag that sets an attribute the renderer computes. */
function ownedPropViolations(
  props: unknown,
  where: string,
  field: string,
  label: string
): readonly string[] {
  if (!isRecord(props)) return []
  return Object.keys(props)
    .filter((key) => SIDEBAR_RENDERER_OWNED_PROPS.has(key))
    .map(
      (key) =>
        `${label} declares sidebar ${where} with ${field} key "${key}" — the entry's href, current mark, disclosure state and classes are computed by the renderer, so ${field} may only add attributes it does not own`
    )
}

/**
 * A toggle name without `{label}` is the same name on every disclosure in the
 * sidebar, so "Expand" answers nothing about which one is being expanded.
 */
function toggleLabelViolations(
  item: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  return (['expandLabel', 'collapseLabel'] as const).flatMap((field) => {
    const value = item[field]
    if (typeof value !== 'string' || value.includes('{label}')) return []
    return [
      `${label} declares sidebar entry "${nameOf(item)}" with ${field} "${value}" carrying no {label} placeholder — every disclosure in the sidebar would answer to the same accessible name`,
    ]
  })
}

/**
 * The two rules an entry WITHOUT a destination answers to.
 *
 * `href` is optional only at this level, and only so that a parent can be one
 * toggle rather than a link with a chevron beside it. What it may not become is
 * a row that is neither: a label with no destination and nothing to open is a
 * dead line in the navigation, rendered and unclickable, which the decoder
 * cannot catch on its own because every remaining field is legal.
 *
 * The second rule is {@link SIDEBAR_LINK_ONLY_FIELDS}, refused rather than
 * ignored for the reason that list gives.
 */
function toggleEntryViolations(
  item: Readonly<Record<string, unknown>>,
  expandable: boolean,
  label: string
): readonly string[] {
  if (item['href'] !== undefined) return []
  if (!expandable)
    return [
      `${label} declares sidebar entry "${nameOf(item)}" with neither href nor children — an entry without a destination is a toggle, and a toggle with nothing to open is a row that does nothing at all`,
    ]
  return SIDEBAR_LINK_ONLY_FIELDS.filter((field) => item[field] !== undefined).map(
    (field) =>
      `${label} declares sidebar entry "${nameOf(item)}" with ${field} but no href — this entry is the toggle for its own list rather than a link, so it is never the current page and its accessible name is already its label`
  )
}

/** Per-entry rules: the authored/fetched split, the orphan disclosure fields, props. */
function sidebarEntryViolations(
  item: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const expandable = item['children'] !== undefined || item['source'] !== undefined
  const source = isRecord(item['source']) ? item['source'] : undefined
  return [
    ...toggleEntryViolations(item, expandable, label),
    ...(item['children'] !== undefined && item['source'] !== undefined
      ? [
          `${label} declares sidebar entry "${nameOf(item)}" with both children and source — a disclosure lists authored children or fetched ones, never both, because only the fetched list has loading, error and empty states; the authored-plus-fetched pairing belongs to a GROUP, which already supports it`,
        ]
      : []),
    ...SIDEBAR_DISCLOSURE_ONLY_FIELDS.filter(
      (field) => item[field] !== undefined && !expandable
    ).map(
      (field) =>
        `${label} declares sidebar entry "${nameOf(item)}" with ${field} but neither children nor source — there is nothing to expand`
    ),
    // Skipped entirely on a toggle entry: `toggleEntryViolations` has already
    // refused both fields there, and reporting the same key twice under two
    // different reasons is how an author fixes the wrong one.
    ...(item['href'] === undefined ? [] : toggleLabelViolations(item, label)),
    ...ownedPropViolations(item['props'], `entry "${nameOf(item)}"`, 'props', label),
    ...ownedPropViolations(
      item['childrenProps'],
      `entry "${nameOf(item)}"`,
      'childrenProps',
      label
    ),
    ...ownedPropViolations(source?.['itemProps'], `entry "${nameOf(item)}"`, 'itemProps', label),
    ...(Array.isArray(item['children']) ? item['children'] : [])
      .filter(isRecord)
      .flatMap((child) => sidebarSubEntryViolations(child, label)),
  ]
}

/**
 * Per-sub-entry rules: the orphan `childrenProps`, and the props bags.
 *
 * ─── THE SAME DEAD-CONFIG DEFECT, ONE LEVEL DOWN ───────────────────────────
 *
 * `childrenProps` names the sub-entry's own nested list. Declared on a sub-entry
 * that has no `children`, it names an element the renderer never emits: the
 * config decodes, the sidebar renders, and the author is left believing they
 * put a `data-testid` on something. That is exactly what
 * {@link SIDEBAR_DISCLOSURE_ONLY_FIELDS} refuses one level up, and it is
 * refused here for the same reason rather than left to be discovered by a
 * selector that never matches.
 *
 * The disclosure fields themselves are NOT checked here, because a sub-entry
 * cannot declare them at all — the third level is always open and takes no
 * toggle, so `defaultExpanded`, `expandLabel` and `collapseLabel` are not
 * fields of `SidebarSubItemSchema` and the decoder refuses them first.
 */
function sidebarSubEntryViolations(
  child: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const where = `sub-entry "${nameOf(child)}"`
  return [
    ...(child['childrenProps'] !== undefined && child['children'] === undefined
      ? [
          `${label} declares sidebar sub-entry "${nameOf(child)}" with childrenProps but no children — childrenProps names the nested list this row would render, and there is none to name`,
        ]
      : []),
    ...ownedPropViolations(child['props'], where, 'props', label),
    ...ownedPropViolations(child['childrenProps'], where, 'childrenProps', label),
    ...(Array.isArray(child['children']) ? child['children'] : [])
      .filter(isRecord)
      .flatMap((leaf) =>
        ownedPropViolations(leaf['props'], `leaf entry "${nameOf(leaf)}"`, 'props', label)
      ),
  ]
}

/**
 * `headingLevel` needs BOTH a `landmark` to sit inside and a `label` to render.
 *
 * The two refusals share a predicate and not a reason, so each states its own.
 *
 *  - No LANDMARK: a heading only replaces a group's landmark name when the
 *    group belongs to one, and a group that is its own landmark is already
 *    named by its label — the heading would announce the same words twice.
 *  - No LABEL: the heading's text IS the label, so the renderer would emit an
 *    empty `<h2>`. That is worse than inert: heading-navigation offers it as a
 *    stop and it announces nothing when the reader lands there.
 *
 * The label-less message locates the group by INDEX, because `nameOf` falls
 * back to the literal `unnamed` and quoting it would name every label-less
 * group in the sidebar identically.
 */
function headingLevelViolations(
  groups: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  return groups.flatMap((group, index) => {
    if (group['headingLevel'] === undefined) return []
    if (typeof group['label'] !== 'string') {
      return [
        `${label} declares sidebar group #${index + 1} with headingLevel but no label — the heading's text is the group label, so this would render an empty heading: a stop heading-navigation offers and that announces nothing. Give the group a label, or drop the headingLevel`,
      ]
    }
    return group['landmark'] === undefined
      ? [
          `${label} declares sidebar group "${nameOf(group)}" with headingLevel but no landmark — a heading only replaces a group's landmark name when the group belongs to one, and a lone group is already named by its own label`,
        ]
      : []
  })
}

export function sidebarNavigationViolations(
  nodes: readonly Readonly<Record<string, unknown>>[],
  label: string
): readonly string[] {
  const groups = groupsOf(nodes)
  return [
    ...headingLevelViolations(groups, label),
    ...landmarkContiguityViolations(groups, label),
    ...landmarkNameCollisionViolations(groups, label),
    ...groups.flatMap((group) => [
      ...ownedPropViolations(
        isRecord(group['source']) ? group['source']['itemProps'] : undefined,
        `group "${nameOf(group)}"`,
        'itemProps',
        label
      ),
      ...itemsOf(group).flatMap((item) => sidebarEntryViolations(item, label)),
    ]),
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
