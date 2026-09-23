/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentPropsSchema } from '../../props'
import { SystemSourceSchema } from '../../system-source'
import { coreFields } from '../modules/core'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const SidebarTypeLiteral = Schema.Literal('sidebar')

/**
 * A live count beside a sidebar entry, fetched from a read endpoint.
 *
 * The alternative — a literal `badge: '12'` — is the other branch of
 * {@link SidebarNavItemSchema}'s `badge`. It is right for a static marker
 * ("Beta", "New") and wrong for a count, which is stale the moment the config
 * is written.
 *
 * `valuePath` is a dot path into the response envelope, so the same endpoint a
 * `table` already binds to can also feed the badge beside its own nav
 * entry — one endpoint, not two.
 *
 * Both fields' `examples` name REAL routes and REAL envelope keys, because an
 * example is the first thing an author copies: `/api/admin/tables` was listed
 * here and does not exist (the aggregate lives at `/api/admin/tables/overview`,
 * whose count is at `totals.tables`, not at the default `total`), so the copied
 * pair fetched a 404 and the badge silently rendered nothing.
 */
export const SidebarBadgeSourceSchema = Schema.Struct({
  /** Read endpoint whose response carries the count */
  endpoint: Schema.String.pipe(
    Schema.annotate({
      description: 'Read endpoint whose response carries the badge count',
      examples: ['/api/admin/tables/overview', '/api/admin/automations/runs'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/^\//, {
        message:
          'sidebar badge endpoint must be a path starting with / — the badge reads this instance, never another origin',
      })
    )
  ),
  /** Dot path to the count within the response envelope (default: `total`) */
  valuePath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: "Dot path to the count in the response envelope (default: 'total')",
        examples: ['total', 'totals.tables', 'summary.failed'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'SidebarBadgeSource',
  title: 'Sidebar Badge Source',
  description: 'Read endpoint and value path feeding a live count beside a sidebar entry',
})

/** @public */
export type SidebarBadgeSource = Schema.Schema.Type<typeof SidebarBadgeSourceSchema>

/**
 * Extra attributes rendered onto one sidebar element.
 *
 * The reason this exists is ADDRESSABILITY: a nav entry carrying nothing but a
 * label can only be reached BY that label, so every assertion, analytics hook
 * and operator runbook is coupled to display copy that translation will change
 * out from under it. `props: { 'data-testid': … }` gives the row a name that
 * does not move.
 *
 * It reuses {@link ComponentPropsSchema} — the same `data-*` / `aria-*` /
 * camelCase key vocabulary every other component's `props` speaks — rather than
 * a second, narrower record. One prop grammar, one published Def; and the keys
 * the renderer owns are refused by a decode rule that NAMES them, instead of
 * being dropped the way an unrecognised key already is.
 */
const sidebarPropsField = Schema.optional(
  ComponentPropsSchema.annotate({
    description:
      'Extra attributes rendered on this element (data-* / aria-*); the renderer owns href, class, aria-current, aria-expanded and aria-controls',
  })
)

/**
 * When an entry is part of the navigation at all, decided by WHERE THE READER IS.
 *
 * ─── THE ONE THING `visibility` CANNOT DO ──────────────────────────────────
 *
 * Every other gate in this product reads a world that is not the URL path: the
 * session (`visibility.when`, `roles`, `condition`), the host app's own config
 * (`declares`), the bound row (`record`), the query string (`query`). None of
 * them can say "only while the reader is inside this section", and `visibility`
 * does not reach a sidebar entry at all — the gate walks a component's
 * `children`, and `groups[].items[]` is not that.
 *
 * So this is a sidebar field rather than a general one, and it is deliberately
 * the narrowest thing that answers the question. The predicate is exactly
 * `activeMatch: prefix`, reused rather than reinvented: the entry is part of
 * the navigation when the request path IS `section` or begins with `section/`.
 * One prefix rule in this module, not two.
 *
 * ─── IT REMOVES THE ROW, IT DOES NOT HIDE IT ───────────────────────────────
 *
 * A gated entry is absent from the rendered document, the way `visibility.query`
 * is absent rather than CSS-hidden. A navigation that ships every row and hides
 * most of them is a navigation whose landmark, whose tab order and whose
 * screen-reader reading all disagree with what is on the screen.
 *
 * @example
 * ```yaml
 * # the twelve kit categories, in the chrome only while a kit page is open
 * - label: Interactive
 *   href: /design-system/ui-kit?category=interactive
 *   showWhen: { section: /design-system/ui-kit }
 * ```
 */
export const SidebarShowWhenSchema = Schema.Struct({
  /**
   * The section this entry belongs to, as a path.
   *
   * Matched the way `activeMatch: prefix` matches: the request path equals it,
   * or begins with it followed by `/`. It need not be any entry's `href` — a
   * row may be scoped to a section it does not itself link into.
   */
  section: Schema.String.pipe(
    Schema.annotate({
      description:
        'Path of the section this entry belongs to; the entry renders only at it or under it',
      examples: ['/design-system/ui-kit', '/tables'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/^\//, {
        message:
          'sidebar showWhen.section must be a path starting with / — it is matched against the request path, never against another origin',
      }),
      // A QUERY here is refused rather than ignored, because ignoring it is
      // indistinguishable from a broken entry. The scope pass compares the
      // section against the request PATH alone, so a section carrying `?` can
      // never match and the row silently never renders — on every page, with
      // nothing logged. Failing at boot is the only way an author finds out.
      Schema.isPattern(/^[^?#]*$/, {
        message:
          'sidebar showWhen.section must be a bare path — a query or fragment can never match, so the entry would never render',
      })
    )
  ),
}).annotate({
  identifier: 'SidebarShowWhen',
  title: 'Sidebar Show When',
  description: 'Renders this entry only while the request path is inside the named section',
})

/** @public */
export type SidebarShowWhen = Schema.Schema.Type<typeof SidebarShowWhenSchema>

const sidebarShowWhenField = Schema.optional(
  SidebarShowWhenSchema.annotate({
    description:
      'Render this entry only while the reader is inside the named section; omitted, it is always part of the navigation',
  })
)

/**
 * The fields every sidebar entry has, at every level of the tree.
 *
 * `href` is deliberately NOT one of them — see {@link sidebarLinkFields}. The
 * two lower levels are always links and require it; a top-level entry holding
 * children may omit it and become a toggle instead.
 *
 * Spread into {@link SidebarLeafItemSchema}, {@link SidebarSubItemSchema} and
 * {@link SidebarNavItemSchema} rather than shared through `Schema.extend`,
 * which throws at IMPORT time on a duplicate key and would make adding a field
 * here a landmine rather than an edit.
 */
const sidebarEntryFields = {
  /** Display text, or a `$t:` translation key */
  label: Schema.String.pipe(
    Schema.annotate({
      description: 'Entry label; accepts a $t: translation key',
      examples: ['Tables', '$t:admin.nav.tables'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Lucide icon name rendered before the label */
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name rendered before the label',
      examples: ['table', 'users'],
    })
  ),
  /**
   * How this entry decides it is the current page.
   *
   *   - `exact` (default) — the request path equals `href`.
   *   - `prefix` — the request path is `href` or begins with `href/`.
   *
   * `prefix` is what a SECTION entry needs: `/tables` stays marked while the
   * visitor is at `/tables/customers`, so a nav never loses its place the
   * moment someone drills in. It is not the default, because on a root entry
   * (`href: /`) prefix-matching marks EVERY page as current — the failure a
   * hand-written sidebar makes first, and the reason this is declared per
   * entry rather than per sidebar.
   *
   * The match runs server-side; the marked entry carries `aria-current="page"`,
   * which is what makes "where am I" answerable by a screen reader rather than
   * by a colour alone. It is re-run on the client only when the sidebar opts in
   * with `trackNavigation`.
   *
   * It needs a destination to match, so declaring it on a top-level entry that
   * omits `href` is refused at boot rather than ignored: that row is a toggle
   * and can never be the current page.
   */
  activeMatch: Schema.optional(
    Schema.Literals(['exact', 'prefix']).annotate({
      description:
        "How the entry matches the request path to mark itself current: 'exact' (default) or 'prefix'",
    })
  ),
  /**
   * A marker beside the label: a literal string, or a live count fetched from
   * a read endpoint (see {@link SidebarBadgeSourceSchema}).
   *
   * A literal is right for a status word that changes with the config
   * ("Beta"); an endpoint is right for a count, which a config file cannot
   * state truthfully at all.
   *
   * @example
   * ```yaml
   * - { label: Tables, href: /tables, badge: { endpoint: /api/admin/tables } }
   * - { label: Agents, href: /agents, badge: Beta }
   * ```
   */
  badge: Schema.optional(
    Schema.Union([
      Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
      SidebarBadgeSourceSchema,
    ]).annotate({
      description: 'Literal marker text, or a read endpoint + value path for a live count',
    })
  ),
  props: sidebarPropsField,
  showWhen: sidebarShowWhenField,
} as const

/**
 * {@link sidebarEntryFields} plus the REQUIRED destination path.
 *
 * The two lower levels of the tree spread this one. A sub-entry and a leaf are
 * links and nothing else: a sub-entry's own list is always open and carries no
 * toggle, so a sub-entry without a destination would be a bare word above a
 * list, and a leaf without one would be a row that does nothing at all.
 *
 * Only {@link SidebarNavItemSchema} takes the path as OPTIONAL, and only
 * because it is the one level that can expand.
 */
const sidebarLinkFields = {
  ...sidebarEntryFields,
  /** Destination path */
  href: Schema.String.pipe(
    Schema.annotate({
      description: 'Destination path for the entry',
      examples: ['/tables', '/_admin/data/forms'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
} as const

/**
 * A LEAF entry: one row of a sub-entry's own list, and the bottom of the tree.
 *
 * It is a plain link — everything the levels above it have except the ability
 * to hold a list of its own. THAT ceiling is the one that stays: three levels
 * is a section, a page, and that page's own parts, and a fourth is a table of
 * contents wearing the app's chrome. Declaring each level as its own type is
 * also what keeps the schema free of `Schema.suspend`, which a self-referential
 * entry would need and which publishes a recursive Def no config author can
 * read.
 */
export const SidebarLeafItemSchema = Schema.Struct({ ...sidebarLinkFields }).annotate({
  identifier: 'SidebarLeafItem',
  title: 'Sidebar Leaf Item',
  description: "One link inside a sub-entry's own list",
})

/** @public */
export type SidebarLeafItem = Schema.Schema.Type<typeof SidebarLeafItemSchema>

/**
 * A sub-entry: one row inside a parent entry's disclosure, optionally holding a
 * list of its own.
 *
 * ─── WHY THERE IS A THIRD LEVEL, HAVING ARGUED THERE WOULD NEVER BE ────────
 *
 * This type carried the opposite claim until 2026-09-09: that two levels was
 * "deliberate and structural", because "a sidebar is a way IN, and a third
 * level of navigation is a page's own contents rather than the app's chrome".
 *
 * The second half of that sentence is still true and is now the ARGUMENT FOR
 * the level rather than against it. Sovrium's own design-system console proved
 * it: its UI kit is one page holding eighty component types under twelve
 * headed categories, and reaching a category means opening the kit and
 * scrolling it. The categories ARE the page's own contents — and a reader
 * already inside that page wants them where the navigation is. What the old
 * ruling actually got right is that such a list has no business in the chrome
 * of every OTHER page, which is what {@link SidebarShowWhenSchema} answers.
 *
 * ─── THE THIRD LEVEL IS ALWAYS OPEN, AND CARRIES NO TOGGLE ─────────────────
 *
 * A sub-entry with `children` renders them as a plain nested list. It does not
 * become a second disclosure, and it takes none of the disclosure fields
 * (`defaultExpanded`, `expandLabel`, `collapseLabel`) — only `childrenProps`,
 * so the list itself can be named.
 *
 * Two reasons, and neither is convenience. A toggle inside a toggle is a
 * control whose accessible name has to say which of two nestings it operates,
 * and there is no wording that does that briefly. And a level that appears only
 * inside its own section is already gated by the reader's location: they are
 * looking at the page these rows belong to, so a second gesture to reveal them
 * is a gesture with no decision behind it.
 *
 * A fetched third level is likewise not expressible: `source` stays a field of
 * the two levels above. A list with a loading, an error and an empty state
 * needs a disclosure to host them, which is exactly what this level refuses to
 * be.
 */
export const SidebarSubItemSchema = Schema.Struct({
  ...sidebarLinkFields,
  /**
   * Authored leaf entries, rendered as a nested list under this row.
   *
   * Pair it with `showWhen` unless the list belongs in the chrome of every
   * page: a third level that is always present is a sidebar that has become a
   * site map.
   */
  children: Schema.optional(
    Schema.Array(SidebarLeafItemSchema).pipe(
      Schema.annotate({
        description:
          'Authored leaf entries rendered as a nested list under this row; always open, never a second disclosure',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Attributes rendered on this row's own nested list element.
   *
   * The same job `childrenProps` does one level up: a leaf entry's `props`
   * names one row, and there is no other way to name the set.
   */
  childrenProps: sidebarPropsField,
}).annotate({
  identifier: 'SidebarSubItem',
  title: 'Sidebar Sub Item',
  description: 'One link inside a sidebar entry disclosure, optionally holding a nested list',
})

/** @public */
export type SidebarSubItem = Schema.Schema.Type<typeof SidebarSubItemSchema>

/**
 * A group's FETCHED source: the shared rows-envelope system source plus the two
 * projections that turn an arbitrary row into a navigation entry.
 *
 * Reusing `SystemSourceSchema` rather than inventing a second endpoint shape is
 * what makes a data-driven sidebar speak the binding a `table` already
 * speaks — including `param` (a group listing whichever collection the route
 * names) and `query` (a statically filtered group).
 *
 * @example
 * ```yaml
 * source:
 *   endpoint: /api/admin/tables
 *   rowsKey: items
 *   labelKey: name
 *   hrefTemplate: /tables/{name}
 *   itemProps:
 *     data-testid: data-nav-tables-{name}
 * ```
 */
export const SidebarGroupSourceSchema = Schema.Struct({
  ...SystemSourceSchema.fields,
  /** Row key whose value becomes the entry label */
  labelKey: Schema.String.pipe(
    Schema.annotate({
      description: "Row key whose value becomes each entry's label",
      examples: ['name', 'title'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Entry href with `{field}` placeholders filled from the row */
  hrefTemplate: Schema.String.pipe(
    Schema.annotate({
      description: 'Entry href with {field} placeholders filled from the row',
      examples: ['/tables/{name}', '/_admin/data/forms/{slug}'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/\{[^{}]+\}/, {
        message:
          'hrefTemplate must carry at least one {field} placeholder — without one every fetched entry would link to the same path',
      })
    )
  ),
  /**
   * Attributes rendered on EACH fetched entry, with `{field}` placeholders
   * filled from the row exactly as `hrefTemplate`'s are.
   *
   * The placeholder grammar is `hrefTemplate`'s on purpose. A fetched row is
   * already addressed with `{name}` two fields above; giving the same row a
   * second spelling here would make the sidebar the one place in the config
   * where one value is written two ways.
   *
   * Without this a fetched entry is addressable only by the label the endpoint
   * happened to return — so the row listing a table cannot be pointed at until
   * someone already knows which tables exist.
   */
  itemProps: Schema.optional(
    ComponentPropsSchema.annotate({
      description:
        'Attributes rendered on each fetched entry; values may carry {field} placeholders filled from the row',
    })
  ),
}).annotate({
  identifier: 'SidebarGroupSource',
  title: 'Sidebar Group Source',
  description:
    'Rows-envelope system source for a sidebar group, projected to entries via labelKey + hrefTemplate',
})

/** @public */
export type SidebarGroupSource = Schema.Schema.Type<typeof SidebarGroupSourceSchema>

/**
 * An ENTRY's fetched source: a group source plus the copy for the three states a
 * lazily-loaded child list passes through.
 *
 * A group's fetched entries render nothing until they arrive, which is right for
 * a list the reader never asked for. A disclosure is the opposite: the reader
 * has just clicked it open, so silence reads as a broken control. The three
 * labels are therefore part of THIS shape and not of the group's.
 *
 * They default to the operator console's own wording, so converting that console
 * to config needs no per-entry copy, and each accepts a `$t:` key so an app
 * shipping in another language is not stuck with it.
 */
export const SidebarItemSourceSchema = Schema.Struct({
  ...SidebarGroupSourceSchema.fields,
  /** Line shown while the children are being fetched (default: `Loading…`) */
  loadingLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Line shown while the children load; accepts a $t: key (default: "Loading…")',
        examples: ['Loading…', '$t:nav.loading'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Line shown when the fetch failed (default: `Couldn't load the list.`) */
  errorLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Line shown when the children could not be loaded; accepts a $t: key (default: "Couldn\'t load the list.")',
        examples: ["Couldn't load the list.", '$t:nav.error'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Line shown when the endpoint returned no rows (default: `No items.`) */
  emptyLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Line shown when the endpoint returned no rows; accepts a $t: key (default: "No items.")',
        examples: ['No items.', '$t:nav.empty'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
}).annotate({
  identifier: 'SidebarItemSource',
  title: 'Sidebar Item Source',
  description:
    "Rows source for an entry's disclosure, with the copy for its loading, error and empty states",
})

/** @public */
export type SidebarItemSource = Schema.Schema.Type<typeof SidebarItemSourceSchema>

/**
 * One navigation entry inside a sidebar group — a link, optionally a DISCLOSURE.
 *
 * `label` accepts a `$t:` translation key exactly as every other user-facing
 * string does, so a sidebar is translatable without a second mechanism.
 *
 * ─── WHY AN ENTRY EXPANDS AT ALL ───────────────────────────────────────────
 *
 * A destination whose contents are themselves navigable — a Records page over
 * many tables, a Files page over many buckets — otherwise costs a second click
 * and a full page load just to discover what is under it. Expanding in place is
 * what lets a reader see and reach the object they want from where they already
 * are, and it is the shape every operator console converges on.
 *
 * The children are AUTHORED (`children`, a known set) or FETCHED (`source`, one
 * per row), never both: the two lists behave differently on purpose — a fetched
 * one has a loading, an error and an empty state, and a declared one must not
 * inherit any of them. A GROUP is where the authored/fetched pair belongs, and
 * it already supports it.
 *
 * ─── AND WHY IT MAY BE A TOGGLE AND NOTHING ELSE ───────────────────────────
 *
 * Omit `href` on an entry that has children and the row stops being a link: it
 * becomes ONE toggle, opening and shutting its own list and going nowhere.
 *
 * The shape this replaces is not a smaller version of that — it is a different
 * control wearing the same row. A parent that must link somewhere gets a
 * destination invented for it, and the row then carries TWO controls with two
 * states: a link that takes the current-page fill whenever the reader is
 * anywhere inside the section, and a chevron beside it that opens the list. A
 * reader who clicks the label lands on a page they did not ask for and watches
 * the list open underneath as a side effect; a reader who wants the list has to
 * find the 16px target on the right. Sovrium's own design-system console is the
 * worked case: every kit category header navigated back to the page the reader
 * was already on, and took a selected fill for doing it.
 *
 * So the entry is a toggle when it has no destination, and the toggle is the
 * WHOLE row rather than a control beside a link. Two consequences follow, and
 * both are why this is a schema change rather than styling:
 *
 *   - it is never CURRENT. `aria-current` says "this is the page you are on",
 *     and a row that is not a page can never be one — which is also why
 *     `activeMatch` is refused on it by a decode rule rather than ignored.
 *   - its accessible name is its own label, read with the state
 *     `aria-expanded` already announces. `expandLabel` / `collapseLabel` name
 *     the small chevron BESIDE a link, where "Data" alone would not say what
 *     the control does; a row whose visible text is the name needs no second
 *     one, and an `aria-label` there would shadow the words on the screen.
 *
 * Declaring `href` keeps every one of today's renderings byte for byte: the
 * label stays a link, the chevron stays beside it, and the current mark still
 * lands. This is an option, not a new default.
 */
export const SidebarNavItemSchema = Schema.Struct({
  ...sidebarEntryFields,
  /**
   * Destination path — OPTIONAL at this level, and only at this level.
   *
   * Omitted, the entry must hold children (authored or fetched) and renders as
   * a toggle that goes nowhere. Declared, it renders exactly as it does today.
   * An entry with neither a destination nor children is refused at boot: it
   * would be a row that is neither a link nor a control.
   */
  href: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Destination path; omit it on an entry with children to make the row a toggle that goes nowhere',
        examples: ['/tables', '/_admin/data/forms'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Authored sub-entries. Their presence is what makes the entry a disclosure:
   * with an `href` the label stays a real link to its own page and a
   * `button aria-expanded` appears beside it; without one the whole row IS that
   * button.
   */
  children: Schema.optional(
    Schema.Array(SidebarSubItemSchema).pipe(
      Schema.annotate({
        description: 'Authored sub-entries; declaring any makes this entry a disclosure',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Fetched sub-entries: one per row, loaded on FIRST expand rather than at
   * render, so a sidebar of ten disclosures costs ten requests only if the
   * reader opens all ten.
   */
  source: Schema.optional(SidebarItemSourceSchema),
  /**
   * Whether the disclosure starts open.
   *
   * Independent of the auto-expand that fires when the entry (or one of its
   * sub-entries) is the current page: that one is not a default but the
   * navigation answering "where am I", and it happens whatever this says.
   */
  defaultExpanded: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Whether the disclosure starts open (default: false)',
    })
  ),
  /**
   * Accessible name of the toggle while the disclosure is SHUT.
   *
   * `{label}` is substituted with the entry's own resolved label, and is
   * required (see the decode rule): a fixed string would give every disclosure
   * in the sidebar one accessible name, which is exactly the "which one is
   * this?" a name exists to answer.
   */
  expandLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Toggle name while shut; must carry {label} (default: "Expand {label}"). Accepts a $t: key',
        examples: ['Expand {label}', '$t:nav.expand'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Accessible name of the toggle while the disclosure is OPEN */
  collapseLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Toggle name while open; must carry {label} (default: "Collapse {label}"). Accepts a $t: key',
        examples: ['Collapse {label}', '$t:nav.collapse'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Attributes rendered on the disclosure's own list element.
   *
   * The list is what a test or a runbook points at to say "these rows, under
   * this entry": a sub-entry's own `props` names one row, and there is no other
   * way to name the set.
   */
  childrenProps: sidebarPropsField,
}).annotate({
  identifier: 'SidebarNavItem',
  title: 'Sidebar Nav Item',
  description: 'A single link inside a sidebar navigation group, optionally expandable',
})

/** @public */
export type SidebarNavItem = Schema.Schema.Type<typeof SidebarNavItemSchema>

/**
 * A labelled block of sidebar entries.
 *
 * Entries come from `items` (authored, fixed) or `source` (fetched, one per
 * row). The two are independent and a group may carry both: authored entries
 * render first, fetched ones after — which is what lets a group put "All
 * tables" above a live list of every table without a second group.
 *
 * A group with neither is a heading with nothing under it, so at least one is
 * required.
 *
 * ─── LANDMARK OR SECTION ───────────────────────────────────────────────────
 *
 * By default a group WITH a label is a navigation landmark, named by that
 * label. That is right when the groups are unrelated, and wrong when several of
 * them are subdivisions of ONE navigation: a reader cycling landmarks then
 * meets four "navigation"s where the author meant one holding four headings.
 *
 * `landmark` says which named landmark a group belongs to, and `headingLevel`
 * turns its label into a real heading rather than a landmark's name. Declaring
 * neither leaves the group exactly as it renders today.
 *
 * ─── A GROUP WITH NO LABEL ─────────────────────────────────────────────────
 *
 * A console's landing page is not a SECTION of the navigation; it is the way
 * back out of every section. Omitting `label` is how that row is authored: the
 * group contributes neither a heading nor a landmark, and its entries render
 * straight into the navigation root, above the first labelled group.
 *
 * It is a group rather than a hand-written anchor because everything the row
 * needs is a descendant rule of that root — the entry fill, the rail's row
 * rules, and the client tracker that re-marks `a[data-sidebar-entry]` after an
 * in-app navigation. An authored `link` child cannot reach any of it, and would
 * land BELOW every group besides, since groups render before authored children.
 */
export const SidebarGroupSchema = Schema.Struct({
  /**
   * Group heading, or a `$t:` translation key.
   *
   * OMITTED, the group states no category name: it emits no heading and no
   * landmark, and its entries render directly into the navigation root. See the
   * note above for why that is a group rather than an authored anchor.
   */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Group heading; accepts a $t: translation key. Omit for a group that states no category name and contributes neither heading nor landmark',
        examples: ['Data', '$t:admin.nav.data'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * The named navigation landmark this group belongs to.
   *
   * Groups declaring the same value are wrapped in ONE `nav` carrying it as the
   * accessible name, and must be listed together — the sidebar renders groups in
   * declared order, so a landmark can only wrap a contiguous run of them.
   *
   * Omitted, a group WITH a `label` is its own landmark named by that label —
   * which is what every sidebar rendered before this field existed — and a
   * group without one is no landmark at all, its entries rendering directly
   * into the navigation root.
   */
  landmark: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Named navigation landmark this group belongs to; groups sharing it are wrapped in one nav. Accepts a $t: key',
        examples: ['Data', '$t:admin.nav.data'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Render the group label as a real heading of this level, instead of the
   * quiet styled paragraph a landmark-named group uses.
   *
   * `1` is refused: the page's own title is the `h1`, and a sidebar section is
   * never the top heading of the document it sits beside.
   *
   * Only meaningful inside a `landmark` — a group that is its OWN landmark is
   * already named by its label, and a heading repeating it announces the same
   * words twice to the same reader.
   *
   * Requires a `label` too, and for a sharper reason: the heading's text IS the
   * label, so a label-less group would emit an empty heading — a stop that
   * heading-navigation lands on and that announces nothing. Both are refused at
   * boot rather than left inert.
   */
  headingLevel: Schema.optional(
    Schema.Literals([2, 3, 4, 5, 6]).annotate({
      description: 'Heading level for the group label; requires landmark',
    })
  ),
  /** Authored entries, rendered before any fetched ones */
  items: Schema.optional(
    Schema.Array(SidebarNavItemSchema).pipe(
      Schema.annotate({ description: 'Authored entries, rendered before any fetched ones' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Fetched entries: one per row of a system read endpoint */
  source: Schema.optional(SidebarGroupSourceSchema),
}).annotate({
  identifier: 'SidebarGroup',
  title: 'Sidebar Group',
  description: 'A labelled block of sidebar entries, authored and/or fetched from an endpoint',
})

/** @public */
export type SidebarGroup = Schema.Schema.Type<typeof SidebarGroupSchema>

/**
 * Below which breakpoint the sidebar renders as an ICON RAIL.
 *
 * ─── WHY THIS IS ONE KEY AND NOT THREE ─────────────────────────────────────
 *
 * "The sidebar becomes a rail" is a single behaviour with three inseparable
 * consequences, and an author who gets two of them has a broken navigation
 * rather than a navigation that is merely half dressed:
 *
 * 1. the sidebar takes a fixed narrow width instead of the one it was authored
 *    with, so the content beside it gets the difference back;
 * 2. every entry label, every entry badge and every group heading stops being
 *    PAINTED — while staying in the accessibility tree, and gaining a pointer
 *    tooltip so a sighted reader can still name a row;
 * 3. each entry centres its icon in that width, instead of running icon-then-
 *    label across a column that is no longer there.
 *
 * Splitting them into a width option, a label option and an alignment option
 * would let an author declare a narrow column of full-width labels — which is
 * strictly worse than the sidebar they started with, and is exactly what the
 * operator console got when it tried to reach this shape through `className`
 * alone. One key means the three move together or not at all.
 *
 * ─── THE LABELS ARE NOT REMOVED, AND THAT IS LOAD-BEARING ──────────────────
 *
 * A rail entry keeps its accessible name. An entry whose name changed with the
 * viewport would be a link that resolves by name on a desktop and resolves by
 * nothing on a laptop — so every deep link, every operator runbook and every
 * assertion addressing a row would hold at one width and silently fail at
 * another, while the page looked correct in both. The label is hidden from the
 * PAINT, never from the document.
 *
 * The same argument is why a rail is not "the sidebar with `visible: false` on
 * its labels" at a breakpoint: the `responsive` field can hide a component,
 * and a hidden label is a link with no name.
 *
 * ─── IT IS NOT A DRAWER ────────────────────────────────────────────────────
 *
 * A rail is still present, still a navigation landmark, and still reachable by
 * keyboard in its declared order. An app that wants the sidebar to LEAVE the
 * layout on a phone and come back behind a button is describing a drawer, which
 * is a different affordance with a different control and is not this field.
 * The two compose: a sidebar may be a rail from one breakpoint down and be
 * hidden behind a drawer from a narrower one, because the drawer is the frame's
 * behaviour and the rail is the navigation's.
 */
export const SidebarRailSchema = Schema.Struct({
  /**
   * The breakpoint at which the full sidebar returns.
   *
   * Read as a strict lower bound: the rail applies at every width BELOW this
   * breakpoint, and at it and above the sidebar renders exactly as it does
   * today. So a console wanting a rail on a laptop and a full sidebar on a wide
   * desktop names the breakpoint at which the desktop starts, not the one at
   * which the laptop does.
   *
   * The tokens are the `responsive` field's, so a config names a breakpoint
   * one way in this product. `mobile` is REFUSED rather than accepted and
   * ignored: it is the base rather than a breakpoint, so "below mobile" is the
   * empty range and the rail would never apply — on every page, with nothing
   * logged. A rail that can never render is not a narrower rail.
   */
  below: Schema.Literals(['sm', 'md', 'lg', 'xl', '2xl']).annotate({
    description:
      'Breakpoint at and above which the full sidebar returns; the rail applies at every width below it',
    examples: ['lg', 'xl'],
  }),
}).annotate({
  identifier: 'SidebarRail',
  title: 'Sidebar Rail',
  description: 'Renders the sidebar as an icon rail below the named breakpoint',
})

/** @public */
export type SidebarRail = Schema.Schema.Type<typeof SidebarRailSchema>

export const sidebarFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  /**
   * Navigation groups rendered inside the sidebar.
   *
   * Without this a `sidebar` is a bare layout box, and every app wanting
   * navigation inside it hand-writes a tree of containers and links — which is
   * how Sovrium's own admin sidebar came to be TypeScript rather than config.
   * `groups` makes the common shape declarative: labelled blocks of entries,
   * each entry authored or fetched.
   *
   * @example
   * ```yaml
   * - type: sidebar
   *   groups:
   *     - label: Overview
   *       items:
   *         - { label: Home, href: /, icon: home }
   *     - label: $t:nav.data
   *       source:
   *         endpoint: /api/admin/tables
   *         rowsKey: items
   *         labelKey: name
   *         hrefTemplate: /tables/{name}
   * ```
   */
  groups: Schema.optional(
    Schema.Array(SidebarGroupSchema).pipe(
      Schema.annotate({
        description: 'Labelled navigation groups rendered inside the sidebar',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Render the sidebar as an ICON RAIL below a breakpoint.
   *
   * A sidebar wide enough to read is a sidebar that costs a laptop a quarter of
   * its width — and the surface next to it is usually the one the reader came
   * for. The rail keeps the navigation present and reachable at that width
   * while giving the column back: icons stay, labels stop being painted, and
   * nothing leaves the accessibility tree.
   *
   * Omitted, the sidebar renders at every width exactly as it does today. See
   * {@link SidebarRailSchema} for the three consequences the key carries
   * together, and for why the labels survive.
   *
   * @example
   * ```yaml
   * # full sidebar on a wide desktop, icon rail on anything narrower
   * - type: sidebar
   *   rail: { below: xl }
   *   groups:
   *     - label: Data
   *       items:
   *         - { label: Tables, href: /tables, icon: table }
   * ```
   */
  rail: Schema.optional(
    SidebarRailSchema.annotate({
      description:
        'Render the sidebar as an icon rail below the named breakpoint; omitted, it renders in full at every width',
    })
  ),
  /**
   * Re-derive the current-entry mark on the CLIENT after a same-document
   * navigation.
   *
   * `aria-current="page"` is resolved server-side, which is correct and
   * sufficient for an app whose every navigation is a page load. An app that
   * swaps its content region in place leaves the sidebar mounted and the
   * server's mark frozen on the page the reader has already left — so the one
   * element that answers "where am I" becomes the one element that is wrong.
   *
   * Opt-in rather than always-on: it costs a client island, and an app doing
   * only full page loads gains nothing from it.
   *
   * The mark moves on `popstate` (browser back / forward) and on the documented
   * `sovrium:navigated` event an in-app swapper dispatches on `document` once
   * `window.location` already reflects the new path. A disclosure whose section
   * becomes current opens with it, and never closes on its own.
   */
  trackNavigation: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Re-derive the current-entry mark on the client after a same-document navigation (default: false)',
    })
  ),
} as const
