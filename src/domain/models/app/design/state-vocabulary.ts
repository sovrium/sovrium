/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which STATES each component type draws, and where each drawing comes from.
 *
 * ─── WHY IT IS DOMAIN AND NOT A CONSOLE DETAIL ─────────────────────────────
 *
 * It lived inside the console's own per-type page BUILDER: a caller that was not
 * that page — the type-page endpoint, a config-expressed row template, an export
 * — could not ask which states a type has without importing a presentation
 * module. So the answer moved here. The builder is gone entirely now, and the
 * RENDERING recipe it kept — the props to set, the style to force — lives below,
 * since the config page draws its cells through the specimen resolver.
 *
 * ─── 36 OF THE 88 TYPES DRAW NOTHING, AND THAT IS THE OUTPUT ───────────────
 *
 * The vocabulary is the founder-approved convention transcribed — 52 boards,
 * 200 cells, and 36 types that deliberately draw none, recorded at
 * `[internal ref]`
 * (P6(b), founder round 18: one States strip per type page, at most six cells;
 * a type whose rendering does not change under any condition draws none).
 *
 * "It has no states" is a claim about the component, not about this table
 * having been filled in yet: a `divider` has no states at all, and a `tooltip`
 * IS its own appearance. So this is a closed table rather than a default — the
 * same argument `catalog.ts` makes about its own membership. A derivation that
 * produced a plausible-looking vocabulary would be INVENTING states across most
 * of the catalogue, and a `hover` cell invented on a `spacer` would be
 * published as confidently as a real one.
 *
 * ─── `rendered` VERSUS `depicted` IS THE HONEST HALF ───────────────────────
 *
 * A `rendered` state is reached the way a visitor reaches it: a real attribute
 * the renderer reads, so the element on screen IS the element in that state. A
 * `depicted` one is a drawing — `:hover` and `:focus-visible` cannot be forced
 * from markup, so the row shows what the state LOOKS like without the browser
 * ever being in it. Publishing which is which is the difference between a
 * documented state and a screenshot of one; a page that hid the distinction
 * would teach a reader that a hover row is as trustworthy as a disabled one.
 */

/** Where a state's drawing comes from. */
export type StateSource = 'rendered' | 'depicted'

/**
 * What a state applies TO.
 *
 * A recipe's `props` and `style` are merged into the COMPONENT, so a state of a
 * row INSIDE the component had no way to say so — and a consumer reading
 * `row selected` off a table would take it for the table being selected, while
 * a `style` recipe written for it would paint every row at once. Orthogonal to
 * {@link StateSource}: a row state can be genuinely reached (selection is a
 * binding) or merely depicted (hover is a pointer state).
 */
export type StateScope = 'component' | 'row'

/** One state a type or category draws, and how it is reached. */
export interface CategoryState {
  /** The state's name, in the words a reader uses. */
  readonly state: string
  /** Whether the element IS in this state, or is drawn to look like it. */
  readonly source: StateSource
  /**
   * Whether the state is the component's or one row's.
   *
   * REQUIRED, with `component` written out on every component-scoped entry
   * rather than left to a default. Most states are component-scoped, so absence
   * would be the common case — and a reader could not tell it apart from "this
   * table does not model scope at all", which is exactly the ambiguity the
   * field exists to remove.
   */
  readonly scope: StateScope
  /**
   * Props merged into the component — the way an AUTHOR would reach the state.
   *
   * Present exactly for a `rendered` state, and that is what makes it rendered:
   * `disabled: true` is the attribute the dispatcher itself reads, so the
   * element on screen IS disabled rather than painted to look it.
   */
  readonly props?: Readonly<Record<string, unknown>>
  /**
   * An inline style forcing a paint CSS cannot be asked for statically.
   *
   * Present exactly for a `depicted` state. Inline and not a utility class,
   * because the recipes paint through ARBITRARY values
   * (`bg-[var(--sv-primary)]`) at the same specificity as any named background
   * utility — so which one wins is Tailwind's output order rather than the
   * author's, and a depiction that lost that race would render identically to
   * `default` and turn a state row into four labels.
   */
  readonly style?: Readonly<Record<string, string>>
  /**
   * A query merged into the specimen's `dataSource.system.query` — the reach a
   * DATA state needs, and the one the model did not have.
   *
   * `props` and `style` are both merged into the component's own props, and
   * `dataSource` is a SIBLING of props. So a state reached by the data source
   * answering differently — `empty`, which is the source returning no rows —
   * had no expressible reach at all, and the only way to publish it was to
   * downgrade it to a depiction: a hand-drawn picture of emptiness presented
   * with the authority of a rendering.
   *
   * It does not have to be. The console's own fixture endpoint already honours
   * `?rows=0` as the empty state a kit page draws (`parseOptionalCap` reads
   * zero as a cap and an absent param as unset), so `empty` is reached here the
   * way a visitor reaches it — the table on screen IS a table with no rows.
   * `loading` keeps no such reach and stays `depicted`, and that contrast is
   * the point rather than an aside.
   */
  readonly sourceQuery?: Readonly<Record<string, string>>
  /**
   * Component-level fields merged onto the specimen — siblings of `props`, not
   * members of it.
   *
   * `props` reaches HTML attributes; a component's own declared options are not
   * attributes. `selection` is a field of `table`, so writing it into `props`
   * would emit `selection="[object Object]"` onto the element and be read by
   * nothing — the inert-property failure this whole module is downstream of.
   */
  readonly fields?: Readonly<Record<string, unknown>>
}

/**
 * How one cell is REACHED, with the three answers the cell already knows
 * removed.
 *
 * `state` is the key it is written under, and `source` and `scope` are both
 * functions of it (see {@link cellOf}) — so a reach that could restate them
 * would be a second place for the catalogue to disagree with itself about
 * whether `hover` is depicted.
 */
type StateReach = Omit<CategoryState, 'state' | 'source' | 'scope'>

/**
 * Every state a still specimen can only DEPICT, wherever it appears.
 *
 * The rule is the state's own nature rather than the type it hangs on: a
 * pointer or keyboard state cannot be forced from markup on a `button` any more
 * than on a `tabs`, and a transient — a fetch in flight, a token stream — is
 * gone before a drawing resolves. Everything else in the vocabulary is reached
 * by a real binding the renderer reads (`disabled`, `aria-invalid`, `checked`,
 * a selection field, a source returning no rows) and is therefore RENDERED.
 *
 * Written ONCE rather than beside each of the 200 cells, because it is one rule
 * and a per-cell literal would let two cells disagree about it — `hover`
 * appears on 30 strips and the 30th is the one that would be wrong.
 */
const DEPICTED_STATES: ReadonlySet<string> = new Set([
  'hover',
  'focus',
  'active',
  'pressed',
  'row hover',
  'loading',
  'streaming',
  // A popup's real home is a portal or a client-side branch reached by an
  // interaction, and a still document enters neither. The specimen draws the
  // popup's OWN markup, so its appearance is real — but its POSITION is the
  // console's arrangement and its MODALITY is dropped, and a drawing whose
  // placement nobody navigated to is a depiction under any reading of the word
  //.
  //
  // The close call, recorded because it will be re-litigated: `command-palette`'s
  // `empty` and `ai-chat`'s `error` reach through the same render-time-prop
  // family and are `rendered`. Those two arrange the CONTENT of a surface
  // already sitting in its real DOM position; `open` is the surfacing itself.
  'open',
])

/**
 * The focus ring, as the one string every focusable type paints.
 *
 * Two layers rather than one: the inner ring is the page background, so the
 * outer one reads as a ring rather than as a thickened border on a control
 * whose own border already touches it.
 */
const FOCUS_RING = '0 0 0 2px var(--color-background), 0 0 0 4px var(--color-focus-ring)'

/**
 * The CURRENT-item paint, shared by `active` and `pressed`.
 *
 * They are the same drawing under two names: a navigation item that is the
 * current one and a toggle that is on are both "this is the one in force", and
 * the convention happens to call it `active` in navigation and `pressed` on a
 * toggle button. Subtle rather than solid, because these sit in dense strips
 * (a sidebar, a toc, a menubar) where a solid primary fill would read as a
 * selected ROW of the specimen rather than as a state of the control.
 */
const CURRENT_PAINT: Readonly<Record<string, string>> = {
  backgroundColor: 'var(--color-primary-subtle)',
  color: 'var(--color-primary-subtle-fg)',
}

/**
 * The reach each state NAME is drawn through, wherever it appears.
 *
 * A state absent from this table carries no reach by default: `default` and
 * `idle` are the component exactly as declared, and every DATA state — the ones
 * reached through a declared option or through the source — names its reach on
 * the type that draws it, because a `checked` checkbox and a `complete`
 * progress rail are reached through different fields and there is no one
 * answer to write here.
 *
 * `row hover` is absent deliberately and is not the same kind of absence. A
 * row-scoped style has nowhere to land — the drawing side merges a recipe into
 * the COMPONENT, so a row paint applied there would fill the whole grid, which
 * is the misreading `scope` exists to prevent. Carrying one anyway, unapplied,
 * would be an option that validates and does nothing: the exact defect the code
 * block's `lineNumbers` spent its life being. So the cell draws the grid as
 * declared and the strip still says `depicted` — a drawing is what the reader
 * is promised, and none is faked at the wrong scope.
 */
const REACH_OF_STATE: Readonly<Record<string, StateReach>> = {
  // A generic surface tint, NOT the button's `--color-primary-hover`. 30 types
  // draw `hover` and most of them are inputs, rows and menu entries; painting
  // an email field with the primary fill would depict a state it never enters.
  // `interactive` overrides it back, below, because a button's hover IS that.
  hover: { style: { backgroundColor: 'var(--color-background-subtle)' } },
  focus: { style: { boxShadow: FOCUS_RING } },
  active: { style: CURRENT_PAINT },
  pressed: { style: CURRENT_PAINT },
  // A transient the console cannot hold still, so its cell is honestly a
  // picture — a dimmed copy of the component as declared.
  loading: { style: { opacity: '0.5' } },
  streaming: { style: { opacity: '0.5' } },
  // The native attribute the dispatcher itself reads, so the element on screen
  // IS disabled rather than painted to look it.
  disabled: { props: { disabled: true } },
  // `aria-invalid` is what the form-control renderers read to paint an error
  // border, and what a screen reader announces — the same reach an author has.
  invalid: { props: { 'aria-invalid': 'true' } },
  // The render-time flag that draws a popup in place. It joins the existing
  // `specimen` / `specimenStatus` / `specimenQuery` family — the namespace this
  // codebase already reserves for "this is a picture, not a live control" — and
  // is deliberately NOT `defaultOpen`, which `accordion` declares as a schema
  // field (`readonly string[]`) and the drawer island as a boolean prop. A third
  // meaning on a third surface is the kind of collision nothing reports.
  //
  // Written here rather than per type because it is one reach: every type that
  // publishes `open` opens the same way, through a renderer that withholds the
  // island, the portal and the dialog role.
  open: { props: { specimenOpen: true } },
}

/**
 * One cell, with its two axes DERIVED from the state rather than restated.
 *
 * Both are functions of the name — `source` by the nature of the state
 * ({@link DEPICTED_STATES}) and `scope` by whether it names a row — so deriving
 * them is what makes the 200 cells unable to disagree with each other. A
 * hand-written `source` per cell is the version where the thirtieth `hover`
 * says `rendered` and the page claims a pointer state it never entered.
 */
const cellOf = (state: string, reach: StateReach | undefined): CategoryState => ({
  state,
  source: DEPICTED_STATES.has(state) ? 'depicted' : 'rendered',
  scope: state.startsWith('row ') ? 'row' : 'component',
  ...(reach ?? REACH_OF_STATE[state] ?? {}),
})

/**
 * A strip, from the convention's own cell NAMES in the convention's own order.
 *
 * The order is part of the contract: a strip is read left to right and
 * `default` is its leftmost cell, so a table that stored a set would publish a
 * strip opening on `disabled` and nothing would say so.
 *
 * `reaches` names the cells whose reach belongs to the TYPE rather than to the
 * state — every one of them a DATA state, and every one verified against the
 * renderer that reads it before it was written down.
 */
const stripOf = (
  states: readonly string[],
  reaches: Readonly<Record<string, StateReach>> = {}
): readonly CategoryState[] => states.map((state) => cellOf(state, reaches[state]))

/**
 * The CATEGORY table — the states every member of a category draws unless it
 * says otherwise.
 *
 * ONE category is left in it, and the single entry is load-bearing rather than
 * vestigial: `button`, `button-group` and `theme-toggle` draw the same four
 * cells, so giving each a row of its own would be duplication maintained by
 * hand and the day one drifted nothing would say so. Every other type in the
 * convention differs from its siblings and carries its own strip below.
 *
 * `link` was the fourth member and has left, keeping the same four cell NAMES
 * and diverging on all three reaches — see its entry in the per-type table and
 * `[internal ref]`. The category key was the defect: one line covering four types is
 * what published a button's hover paint onto an inline `<a>`.
 *
 * `form-controls` used to be the second entry — `default | disabled | error |
 * readonly`, derived from the native attributes the dispatcher reads. It is
 * gone because the convention retired `readonly` from the vocabulary outright
 * (it appears on none of the 52 boards) and renamed `error` to `invalid`, and
 * because all 16 of its members now carry their own strip: a `checkbox` draws
 * `checked` and its sibling `slider` does not. A category key serving nobody is
 * data that can only drift.
 *
 * A category absent from the table draws no states, which is the answer for
 * eleven of the twelve and is a fact rather than a gap.
 */
const CATEGORY_STATES: Readonly<Record<string, readonly CategoryState[]>> = {
  interactive: stripOf(['default', 'hover', 'focus', 'disabled'], {
    // The one hover that IS the primary fill: a button's hover state is its
    // hover colour, where an input's is a surface tint.
    //
    // A fill WITHOUT a foreground is how the `button-group` cell came to read
    // 1.33:1 for its `Day` and `Week` labels (measured 2026-09-16) — the paint
    // landed and nothing told the text about it. So the fill now travels with
    // the foreground it needs, said TWICE because the two reach different
    // things and neither reaches both:
    //
    //   `color`    the element the recipe lands on. On a `button` specimen that
    //              IS the control, and an inline declaration beats the
    //              variant's own `text-[…]` class.
    //   `--sv-fg`  its DESCENDANTS. A `button-group` specimen is a group with
    //              two `outline` buttons inside it, each painting
    //              `text-[var(--sv-fg,…)]` — a class, which beats an inherited
    //              `color` from the group and would keep the labels black on
    //              the new fill. Re-binding the token they read is what an
    //              inherited colour cannot do: the depiction repaints the
    //              surface, so the foreground token ON that surface changes
    //              with it, exactly as a custom property is meant to cascade.
    hover: {
      style: {
        backgroundColor: 'var(--color-primary-hover)',
        color: 'var(--color-primary-fg)',
        '--sv-fg': 'var(--color-primary-fg)',
      },
    },
  }),
}

/**
 * The per-TYPE table — the convention, transcribed.
 *
 * ─── WHY A CATEGORY KEY WAS NOT ENOUGH ─────────────────────────────────────
 *
 * `data` has nine members and they do not share a strip. A `table` draws five
 * cells, a `chart` two: `empty` is a real state of a grid and is meaningless on
 * a plotted series, and `row hover` / `row selected` name a row that a chart
 * does not have. Hanging one category-wide strip on all nine would publish
 * `empty` on a KPI tile — as `rendered`, with the authority the `source` field
 * exists to carry — which is precisely the invention the closed-table argument
 * above refuses for whole categories, one level down.
 *
 * And the pair that no category-keyed table can be right about at all: `alert`
 * and `badge` sit in `interactive` beside `button`. `button` draws four cells;
 * the convention draws these two none. Their entries are EMPTY ARRAYS rather
 * than omissions, because an omission falls through to the category and
 * publishes `button`'s strip on a component that has no such states — and `[]`
 * is not nullish, so it stops the `??` chain where a `0`-length answer must.
 *
 * ─── TWO TABLES AND NOT ONE RECORD ─────────────────────────────────────────
 *
 * A single record keyed by both would resolve `[type] ?? [category]` in one
 * lookup and read more briefly. It would also merge two namespaces that are
 * only accidentally disjoint: the day a component type is named after a
 * category, one silently answers for the other, and `CATEGORIES_WITH_STATES`
 * below would start reporting type names as categories. Two tables cost one
 * extra line and cannot do either.
 *
 * ─── THREE OF THESE STRIPS ARE PUBLISHED AND NEVER DRAWN ───────────────────
 *
 * `comments`, `language-switcher` and `record-picker` are REFUSED by the
 * specimen catalogue: each needs a table of the operator's that the
 * confidentiality bound forbids binding, or a write path onto one. Their pages
 * state the refusal instead of drawing cells, so `catalogSpecimenInAxes` never
 * resolves a recipe for one of them. The strips stay — what states a type HAS
 * is not a function of whether this console can draw it — and the DATA cells on
 * them (`empty` on two) deliberately carry no reach: there is no element to
 * reach, and a recipe written for one would be an option that validates and is
 * read by nothing.
 *
 * It was SEVEN. `ai-chat`, `breadcrumb`, `command-palette` and `form` left the
 * list together, and each for its own reason rather than by a relaxation of the
 * bound: a renderer bug that made a breadcrumb's landmark name unreachable from
 * config, and three types whose refusals were about a live TRANSPORT that
 * [internal ref] A3 clause 1 never required a specimen to carry. Their cells are
 * reached like any other — see `command-palette`'s `empty` and `ai-chat`'s
 * `error` below, both of which now have a reach where they used to have none.
 */
const TYPE_STATES: Readonly<Record<string, readonly CategoryState[]>> = {
  // ── interactive ──────────────────────────────────────────────────────────
  // The two the convention draws nothing on. See the note above: these are the
  // entries that make the table per-TYPE rather than per-category.
  alert: [],
  badge: [],
  // A `link` draws the SAME FOUR CELLS as its category and reaches all three of
  // them differently, which is the shape no category key can express and the
  // reason this entry exists (`[internal ref]`, founder rulings on rows 16, 17 and 18
  // of the 2026-09-16 console review).
  //
  // An inline `<a>` is the one member of `interactive` that is not a filled,
  // box-like control, and the category's recipe treated it as one. Measured
  // live, 2026-09-16: the hover cell painted `--color-primary-hover` under a
  // `--sv-primary` word — 1.20:1, a solid black block with the word invisible
  // in it — the focus cell drew the shared 4px ring, and the disabled cell
  // rendered `<a href="#" disabled="">`, which disables nothing.
  link: stripOf(['default', 'hover', 'focus', 'disabled'], {
    // Row 16, verbatim: _"pour le lien, on va juste faire un changement de
    // couleur du texte"_. No fill at all — the colour IS the state — and the
    // tone is the same one `computeLinkClasses` moves to under a real pointer,
    // so the depiction and the product draw the same thing.
    hover: { style: { color: 'var(--color-primary-hover)' } },
    // Row 17: the strip depicts whichever affordance the component actually
    // draws, and never one it does not. A link answers focus with an UNDERLINE
    // in the focus-ring colour (`LINK_FOCUS_CLASS`, and again in
    // `component-floor.ts`), because a 2px offset ring round an inline `<a>`
    // would reflow the line it sits in. The shared `FOCUS_RING` was drawing a
    // rectangle this component never draws.
    focus: {
      style: {
        textDecorationLine: 'underline',
        textDecorationColor: 'var(--color-focus-ring)',
      },
    },
    // Row 18, and the ARIA pattern for a disabled anchor: the `href` goes, the
    // role is stated explicitly because an `<a>` without `href` is no longer a
    // link to anything reading the page, and `aria-disabled` carries the state.
    // `href: undefined` REMOVES the catalogue's declared `'#'` rather than
    // blanking it — the merge in `propsWithRecipe` spreads this over it, and
    // React omits an attribute whose value is `undefined`.
    //
    // The mark alone would change nothing: `pointer-events-none` under the
    // `aria-disabled:` variant in `LINK_SHARED` is what makes it inert, so this
    // recipe stays `props` only and needs no paint of its own.
    disabled: { props: { role: 'link', 'aria-disabled': 'true', href: undefined } },
  }),
  // ── form-controls ────────────────────────────────────────────────────────
  checkbox: stripOf(['default', 'hover', 'focus', 'checked', 'disabled'], {
    // `checked` is a declared field of `checkbox`, read by `buildCheckboxProps`
    // through `pickFromComponent` and rendered as `defaultChecked` on the SSR
    // input — a component option, so `fields` and not `props`.
    checked: { fields: { checked: true } },
  }),
  'code-editor': stripOf(['default', 'focus', 'disabled']),
  // `open` sits SECOND, beside `default`, because the pair is one question — is
  // the calendar down or not — and reading it after the pointer states would put
  // the control's two resting shapes at opposite ends of the strip. Six cells,
  // which is the convention's own ceiling and not room for a seventh.
  'date-picker': stripOf(['default', 'open', 'hover', 'focus', 'invalid', 'disabled']),
  'date-range-picker': stripOf(['default', 'open', 'hover', 'focus', 'invalid', 'disabled']),
  field: stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  input: stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  'input-group': stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  'radio-group': stripOf(['default', 'focus', 'disabled']),
  // REFUSED — `needs-data-source`. `empty` carries no reach; see the note above.
  'record-picker': stripOf(['default', 'focus', 'loading', 'empty', 'invalid', 'disabled']),
  'rich-text-editor': stripOf(['default', 'focus', 'disabled']),
  select: stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  slider: stripOf(['default', 'hover', 'focus', 'disabled']),
  switch: stripOf(['default', 'hover', 'focus', 'checked', 'disabled'], {
    // Same declared field as `checkbox`, read through the same lookup.
    checked: { fields: { checked: true } },
  }),
  textarea: stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  toggle: stripOf(['default', 'hover', 'focus', 'pressed', 'disabled']),
  'toggle-group': stripOf(['default', 'hover', 'focus', 'disabled']),
  // ── data ─────────────────────────────────────────────────────────────────
  calendar: stripOf(['default', 'loading']),
  chart: stripOf(['default', 'loading']),
  'filter-bar': stripOf(['default', 'hover', 'focus', 'active', 'empty'], {
    // A filter bar's `empty` is a bar with no conditions in force, and
    // `conditions` is the declared field the renderer flattens onto the island
    // (`filterBarComponent`). The specimen declares one condition precisely so
    // its default cell shows a chip, which is what makes the empty cell a
    // different drawing rather than the same one twice.
    empty: { fields: { conditions: [] } },
  }),
  // `disabled` needs no reach of its own: the generic `props: { disabled: true }`
  // is exactly right here now that `renderBareFormVariant` lifts it onto a
  // `<fieldset disabled>` — every control inside the specimen IS disabled,
  // rather than the form wearing an attribute browsers ignore.
  form: stripOf(['default', 'focus', 'invalid', 'disabled']),
  gallery: stripOf(['default', 'loading']),
  kanban: stripOf(['default', 'loading']),
  kpi: stripOf(['default', 'loading']),
  list: stripOf(['default', 'loading']),
  table: stripOf(['default', 'row hover', 'row selected', 'loading', 'empty'], {
    // Reached through a REAL declared binding rather than a paint: `selection`
    // is a field of `table` that the renderer reads, so the grid on screen is
    // one whose rows can be selected. Written in `fields` and not `props`
    // because it is a component option, not an HTML attribute.
    'row selected': { fields: { selection: { mode: 'multiple', showCheckboxes: true } } },
    // And this one is NOT a picture — see `sourceQuery`. The grid on screen is
    // a grid whose source returned nothing, which is how a visitor meets it.
    empty: { sourceQuery: { rows: '0' } },
  }),
  // ── layout ───────────────────────────────────────────────────────────────
  sidebar: stripOf(['default', 'hover', 'focus', 'active']),
  // ── content ──────────────────────────────────────────────────────────────
  code: stripOf(['default', 'hover', 'focus', 'active']),
  'search-input': stripOf(['default', 'hover', 'focus', 'disabled']),
  toc: stripOf(['default', 'hover', 'active']),
  // ── display ──────────────────────────────────────────────────────────────
  accordion: stripOf(['default', 'hover', 'focus', 'active']),
  'list-item': stripOf(['default', 'hover', 'selected'], {
    // The `list-item` renderer reads `selected` straight off the element props
    // — `const selected = elementProps['selected'] === true` — and picks the
    // prestyled `selected` class set from it. An HTML-level flag, so `props`.
    selected: { props: { selected: true } },
  }),
  tabs: stripOf(['default', 'hover', 'focus', 'selected', 'disabled'], {
    // `defaultTab` names the tab that opens active, and the renderer reads it
    // off the component (`c['defaultTab']`) to pick the SSR panel and to seed
    // the island. Naming the SECOND panel is what makes the cell a different
    // drawing from `default`, which opens on the first — and it is coupled to
    // the specimen's own panel ids: change those in
    // `catalog-specimens/content.ts` and this reach stops selecting anything.
    selected: { fields: { defaultTab: 'activity' } },
  }),
  timeline: stripOf(['default', 'loading']),
  // ── navigation ───────────────────────────────────────────────────────────
  breadcrumb: stripOf(['default', 'hover', 'focus', 'disabled']),
  'command-palette': stripOf(['default', 'hover', 'focus', 'empty'], {
    // The palette's empty state is the one a reader cannot reach by looking at
    // a working app: a query that matched nothing. It is reached through the
    // specimen's OWN search text and the runtime's own filter, so the cell is a
    // drawing of the list with every row filtered out rather than a picture of
    // an emptied config — which is why the reach is a query and not an erased
    // `pages` array. The string is deliberately unpronounceable: any token that
    // could appear in a quick-action label would leave rows behind.
    empty: { props: { specimenQuery: 'zzxq' } },
  }),
  'context-menu': stripOf(['default', 'hover', 'disabled']),
  'dropdown-menu': stripOf(['default', 'open', 'hover', 'focus', 'disabled']),
  menubar: stripOf(['default', 'hover', 'focus']),
  'navigation-menu': stripOf(['default', 'hover', 'focus', 'active']),
  pagination: stripOf(['default', 'hover', 'focus', 'disabled']),
  // ── feedback ─────────────────────────────────────────────────────────────
  progress: stripOf(['default', 'complete'], {
    // `progressValue` and `progressMax` are both declared fields of `progress`,
    // and the rail plots their ratio. Both are written rather than only the
    // value, so the cell means "full" whatever the specimen declares as its
    // maximum — the specimen's own 65/100 is what the `default` cell draws.
    complete: { fields: { progressValue: 100, progressMax: 100 } },
  }),
  // ── specialty ────────────────────────────────────────────────────────────
  // REFUSED — write transport. `empty` carries no reach; see the note above.
  comments: stripOf(['default', 'empty', 'loading']),
  'file-upload': stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  // REFUSED — `needs-data-source`.
  'language-switcher': stripOf(['default', 'hover', 'focus', 'disabled']),
  'number-input': stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  'reorderable-list': stripOf(['default', 'hover', 'active']),
  'time-picker': stripOf(['default', 'hover', 'focus', 'invalid', 'disabled']),
  // ── ai ───────────────────────────────────────────────────────────────────
  // The only strip in the catalogue that does not open on `default`: a chat at
  // rest is `idle`.
  'ai-chat': stripOf(['idle', 'streaming', 'error'], {
    // A failed turn is the one appearance a reader cannot produce on demand,
    // which is why it is on the strip at all. The renderer's specimen mode
    // draws the island's own banner for it, so the cell is the real failure
    // markup rather than a dimmed copy of `idle` under a different label.
    error: { props: { specimenStatus: 'error' } },
  }),
}

/**
 * The states one TYPE draws, in reading order — its own strip when it has one,
 * else its category's, else empty.
 *
 * The fallback chain is what keeps the four `interactive` members working
 * untouched, and the final `[]` is a GUARANTEE rather than a convenience: a
 * type in neither table answers with an empty array, never with `undefined` and
 * never by omitting the key.
 *
 * `??` and not `||`: `alert` and `badge` are entered as EMPTY arrays to stop
 * the chain at the type, and an empty array is truthy — so the distinction
 * survives, where a `||` would fall through to `interactive` and publish four
 * invented cells on each.
 */
export const statesOfType = (type: string, category: string): readonly CategoryState[] =>
  TYPE_STATES[type] ?? CATEGORY_STATES[category] ?? []

/** The states a category draws, for a caller that holds no type. */
export const statesOfCategory = (category: string): readonly CategoryState[] =>
  CATEGORY_STATES[category] ?? []

/** Every category that draws at least one state, for a caller enumerating them. */
export const CATEGORIES_WITH_STATES: readonly string[] = Object.keys(CATEGORY_STATES)

/**
 * One type's recipe for one state, or `undefined` when it draws no such state.
 *
 * The lookup a caller needs to DRAW a state, where {@link statesOfType} is the
 * one it needs to LIST them. It resolves through the same chain, so a caller
 * cannot draw a state the endpoint did not publish, or miss one it did.
 */
export const stateRecipeOf = (
  type: string,
  category: string,
  state: string
): CategoryState | undefined => statesOfType(type, category).find((entry) => entry.state === state)
