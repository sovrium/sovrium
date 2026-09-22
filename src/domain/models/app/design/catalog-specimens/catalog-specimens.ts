/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One specimen per component-type: the REAL component, with the props a real
 * specimen needs.
 *
 * ─── THE PROPS ARE THE WORK, AND TWO OF THEM WERE MEASURED ─────────────────
 *
 * A catalog that iterated type literals and passed no props would print empty
 * boxes under real headings. Measured on this tree: rendered bare, `field`
 * emits `<div data-component="field"></div>` — literally nothing — and
 * `select` / `radio-group` / `toggle-group` are equally empty without options.
 * So this table is hand-authored per type, and that is not duplication: the
 * type LIST is derived (`design-system-catalog-registry.ts`), the illustrative
 * CONTENT cannot be.
 *
 * ─── WHY A TYPE MAY BE REPORTED INSTEAD OF DRAWN ───────────────────────────
 *
 * Three states, and each says a different true thing:
 *
 *   `no-renderer`      schema-accepted, no `COMPONENT_REGISTRY` entry. Config
 *                      validates, the page boots, `dispatchComponentType`
 *                      falls through to a bare `<div>`. Drawing an empty box
 *                      under that heading would be the catalogue asserting the
 *                      defect is the design.
 *
 *                      NO TYPE IS IN THIS STATE TODAY, and the state stays
 *                      anyway. Its only member was `tab-panel`, retired into
 *                      `tabs.panels[]` — the catalogue reshape's answer to a
 *                      component nobody can draw is to stop making it a
 *                      component. The state survives because `Component
 *                      Renderer Drift` can still produce one: a type added to
 *                      the union with no registry entry lands here, and an
 *                      empty vocabulary would leave the catalogue drawing that
 *                      empty box instead of reporting it.
 *   `not-previewable`  renderable, and not HERE. Two distinct reasons, and the
 *                      note says which: a write control may not exist inside a
 * preview frame ([internal ref] A3 clauses 1-2), or the type
 *                      needs a render position this surface cannot give it
 *                      (`list`, which hydrates only at the top level).
 *   `needs-data-source`
 *                      renderable, and only over records — with no way to get
 *                      any that A2's confidentiality bound permits. NO TYPE IS
 *                      IN THIS STATE TODAY, and the state is kept for the next
 *                      one that is. Every data-bound type now reads the
 *                      platform's own fixture endpoint: `table` and the
 *                      list family share the `{ system }` arm on
 *                      `modules/data-bound.ts`, and `chart` / `kpi` carry
 *                      their own. An earlier note here said that arm was
 *                      "confined to `table`" — it quoted a policy that
 *                      module has since reversed, so do not restore it.
 */

import { componentWithRecipe } from '@/domain/models/app/design/catalog-specimens/recipe-application'
import { stateRecipeOf } from '@/domain/models/app/design/state-vocabulary'
import { SHOWN_SPECIMENS_BY_CATEGORY } from './content'
import { TRIGGERED_SPECIMENS_BY_CATEGORY } from './interaction'
import { KIT_DATA_SPECIMENS, KIT_FORM_CONTROL_SPECIMENS } from './kit'
import { STATE_SPECIMENS_BY_CATEGORY } from './state'
import type { CategoryState } from '@/domain/models/app/design/state-vocabulary'
import type { TypeField, TypeIntrospection } from '@/domain/models/app/design/type-introspection'
import type { Component } from '@/domain/models/app/pages/components'
import type { CatalogComponentCategory } from '@/domain/models/app/pages/components/component-types/catalog'

/** Why a specimen is reported rather than drawn. */
export interface SpecimenRefusal {
  /** Machine-readable state, surfaced as `data-design-specimen-state`. */
  readonly state: 'no-renderer' | 'not-previewable' | 'needs-data-source'
  /** The sentence a reader sees under the type name. */
  readonly note: string
}

/** One catalogued component-type. */
export interface CatalogSpecimen {
  readonly type: string
  /** The real component, rendered by the real renderer. Absent when refused. */
  readonly component?: Component
  /** Present exactly when `component` is absent. */
  readonly refusal?: SpecimenRefusal
  /** Extra attributes for the specimen wrapper (provenance, mostly). */
  readonly wrapperProps?: Readonly<Record<string, string>>
}

const component = (value: unknown): Component => value as Component

/**
 * The eleven form-controls, with the props each needs to be a specimen OF
 * something.
 *
 * `[internal ref]` compares every one of these against the SAME type
 * rendered on an ordinary page, using one extractor run verbatim on both
 * sides. So these props are not free: they are the ordinary page's props, and
 * a divergence here reads as a catalog that documents markup the app does not
 * emit — the failure the whole spec exists to catch.
 */
const FORM_CONTROL_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'record-picker',
    refusal: {
      state: 'needs-data-source',
      note:
        'Searches a table of yours and links the row it finds. This page is bound to no table — ' +
        'and binding it to one of yours is what the confidentiality bound forbids — so there are ' +
        'no candidates for it to offer. Its states, its paging and its create path are drawn as ' +
        'authored option sections on its own page.',
    },
  },
  {
    type: 'input',
    component: component({
      type: 'input',
      inputType: 'email',
      props: { placeholder: 'ada@example.com' },
    }),
  },
  {
    type: 'textarea',
    component: component({ type: 'textarea', props: { placeholder: 'Describe the issue' } }),
  },
  {
    type: 'checkbox',
    component: component({ type: 'checkbox', props: { label: 'Send me updates' } }),
  },
  { type: 'switch', component: component({ type: 'switch', props: { label: 'Notifications' } }) },
  { type: 'toggle', component: component({ type: 'toggle', props: { label: 'Bold' } }) },
  {
    type: 'toggle-group',
    component: component({
      type: 'toggle-group',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
    }),
  },
  {
    type: 'radio-group',
    component: component({
      type: 'radio-group',
      options: [
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
      ],
    }),
  },
  {
    type: 'select',
    component: component({
      type: 'select',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'sent', label: 'Sent' },
      ],
    }),
  },
  {
    // An input with a LEADING addon and nothing else. One attachment rather than
    // the full prefix/suffix/action composition: the card documents the SEAM —
    // the shared height, the squared inner corner, the addon outside the
    // submitted value — and three attachments show that same seam three times
    // while making the control too wide for the grid.
    type: 'input-group',
    component: component({
      type: 'input-group',
      label: 'Amount',
      name: 'amount',
      prefix: '€',
      value: '4120.00',
    }),
  },
  { type: 'slider', component: component({ type: 'slider', props: {} }) },
  {
    type: 'date-picker',
    component: component({ type: 'date-picker', props: { label: 'Due date' } }),
  },
  {
    // A composed label / description / control WRAPPER. Bare it emits nothing
    // at all, which is why it carries a child here.
    type: 'field',
    component: component({
      type: 'field',
      fieldLabel: 'Full name',
      fieldDescription: 'As it appears on the invoice',
      children: [{ type: 'input' }],
    }),
  },
  ...KIT_FORM_CONTROL_SPECIMENS,
]

/**
 * The two structural primitives.
 *
 * Neither has text or an accessible name, so every instrument used elsewhere
 * in the catalog reports success against a specimen that rendered as a bare
 * 0x0 `<div>`. `[internal ref]` asserts geometry and computed border
 * colour instead — which is why the divider is left at its DEFAULT style: the
 * prestyled `<hr>` is the thing being documented, and an author className here
 * would document the override rather than the default.
 */
const STRUCTURAL_SPECIMENS: readonly CatalogSpecimen[] = [
  { type: 'divider', component: component({ type: 'divider' }) },
  { type: 'spacer', component: component({ type: 'spacer', size: 'md' }) },
]

const boxedText = (content: string): unknown => ({
  type: 'text',
  element: 'p',
  props: { className: 'text-foreground-subtle text-sm' },
  content,
})

/** A layout container needs something inside it to have any shape at all. */
const layoutChildren = (...labels: readonly string[]): readonly unknown[] =>
  labels.map((label) => ({
    type: 'card',
    props: { className: 'text-foreground-subtle text-sm' },
    children: [boxedText(label)],
  }))

/**
 * The layout types — the structural containers, each drawn holding placeholder
 * children so the container itself is what the reader sees.
 */
const LAYOUT_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'container',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-2' },
      children: layoutChildren('Inside a container'),
    }),
  },
  {
    type: 'flex',
    component: component({
      type: 'flex',
      props: { className: 'gap-2' },
      children: layoutChildren('One', 'Two'),
    }),
  },
  {
    type: 'grid',
    component: component({
      type: 'grid',
      columns: 2,
      props: { className: 'gap-2' },
      children: layoutChildren('One', 'Two'),
    }),
  },
  {
    type: 'card',
    component: component({
      type: 'card',
      children: [boxedText('A card is the default raised surface.')],
    }),
  },
  {
    type: 'split-pane',
    component: component({
      type: 'split-pane',
      props: { className: 'gap-2' },
      children: layoutChildren('Left pane', 'Right pane'),
    }),
  },
  {
    type: 'sidebar',
    component: component({
      type: 'sidebar',
      props: { className: 'gap-2' },
      children: layoutChildren('Sidebar'),
    }),
  },
]

/** The endpoint the data specimens read their rows from. Platform, not operator. */
export const CATALOG_FIXTURE_ENDPOINT = '/api/admin/design-system/specimen-rows'

/**
 * The wrapper attribute that records where a specimen's ROWS came from.
 *
 * Named rather than inlined because three readers share the spelling: the entry
 * that declares it, and the two accessors in `./provenance` that publish it —
 * one to a renderer that stamps a frame, one to a config page that cannot
 * inspect a wrapper and is handed the boolean instead.
 */
export const FIXTURE_SOURCE_ATTRIBUTE = 'data-design-fixture-source'

/** The provenance marker every fixture-backed specimen wrapper carries. */
const FIXTURE_SOURCE = { [FIXTURE_SOURCE_ATTRIBUTE]: 'platform' } as const

/** The rows binding shared by the four drawn components that carry `dataBoundFields`. */
const fixtureRows = {
  system: { endpoint: CATALOG_FIXTURE_ENDPOINT, rowsKey: 'items', idKey: 'id', totalKey: 'total' },
} as const

/**
 * The data types — most drawn from platform fixture rows, two drawn from their
 * own config (`form`, and `filter-bar` spread in from the kit), and two
 * reported rather than drawn (`graph` and `matrix`, at the foot of the array).
 *
 * Count them against `data/index.ts` rather than trusting this line: the split
 * has moved three times now, and every time the sentence lagged the array —
 * which is why the figure is gone from it rather than corrected again.
 *
 * ─── WHY SEVEN OF THESE STOPPED BEING REFUSALS ─────────────────────────────
 *
 * They used to share one sentence saying the `{ system }` dataSource arm was
 * "confined to `table`". That was true when it was written and is not
 * true now: `modules/data-bound.ts` generalized the arm to every rows-oriented
 * data-bound component, and `chart` / `kpi` carry their own endpoint-capable
 * arms beside it. Each of them therefore reads the platform's own fixture
 * rows over a same-origin GET and names no operator table — the same standing
 * that made `table` drawable in the first place.
 *
 * `list` was the last to arrive, and for a different reason: its binding and
 * its `itemTemplate` were always right, but it is the only data type whose
 * island-ness is DECIDED at resolve time, and the resolver used to map
 * `page.components` — the TOP level only. Every specimen here is nested inside
 * its canvas container, so the props were never stamped and the renderer fell
 * through to the server-side expand path, which over a system source had no
 * rows to expand and emitted an empty `<ul>`. `stampNestedIslands`
 * (`data-source-resolver.ts`) now descends, so a nested data-bound `list`
 * hydrates exactly as a top-level one does — in this catalogue and in any app
 * that nests one.
 *
 * The confidentiality bound is unchanged, and the wrapper marker is what
 * records it: `platform` provenance on every one of them, never a table.
 *
 * ─── AND THE LAST ONE, WHICH NO FIXTURE COULD HAVE REACHED ─────────────────
 *
 * `form` was the one refusal left here, and it was never about where rows come
 * from: it is [internal ref] A3, which no fixture endpoint can satisfy. What resolved
 * it was reading clause 1 as written — *"a specimen form element … carries no
 * action and no submit path"* — and reaching for the mode that already has
 * neither. See its entry. Its BOUND modes are still undrawable and still
 * undeclarable inside a specimen (`SPECIMEN_REFUSED_TYPES`); the category has
 * no refusal left.
 *
 * ─── THE BINDINGS ARE NOT DECORATION ───────────────────────────────────────
 *
 * Each type needs the field that tells it how to PLACE a record; without it
 * the island draws its own missing-binding state instead of the component.
 * `kanbanGroupBy` for kanban and `dateField` for calendar. `chart` AGGREGATES
 * rather than plotting a column, because the fixture carries no numeric field
 * and a chart over non-numeric values filters every point out and draws an
 * empty canvas. `kpi` is scalar-shaped, so it reads the envelope's `total`
 * rather than any row.
 */
const DATA_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'table',
    wrapperProps: FIXTURE_SOURCE,
    // The BOUND mode, deliberately. A `table` has two — declare a `dataSource`
    // for a grid, omit it for the rows written in the config — and the
    // catalogue draws one specimen per type. The grid is the mode a reader
    // arriving at the `data` category came for, and the one a static sample
    // could not show the behaviour of.
    component: component({
      type: 'table',
      props: { id: 'design-system-fixture-grid', 'aria-label': 'Specimen rows' },
      dataSource: { system: { endpoint: CATALOG_FIXTURE_ENDPOINT, rowsKey: 'items' } },
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'role', label: 'Role' },
        { field: 'status', label: 'Status' },
      ],
      emptyMessage: 'No specimen rows',
    }),
  },
  {
    // ─── THE BARE MODE, WHICH IS THE ONE A3 NAMES ──────────────────────────
    //
    // `form` was refused as a specimen because its two BOUND modes emit a live
    // submit control: an `action` routes it to the CRUD island, a `dataSource`
    // synthesises one, and either way the drawing becomes a real write path
    // pointed at something. That is [internal ref] A3 clause 1, and no fixture
    // endpoint can satisfy it.
    //
    // It has a third mode, and the clause names it verbatim: *"A specimen form
    // element, if a specimen ever needs one, carries no action and no submit
    // path."* A `form` with children and no binding renders exactly that —
    // `renderBareFormVariant` emits `<form>` around the controls, with no
    // `action`, no `method` and no submit button. Drawn rather than composed
    // out of look-alikes, because a strip made of `input` and `button` would
    // document the composition instead of the component.
    //
    // `disabled` is the one state that needed the renderer to change, and it
    // was already broken for every author: `<form disabled>` is ignored by
    // every browser, so the declaration painted nothing. It now lifts onto a
    // `<fieldset disabled>`, which is the HTML-native way to say it — the
    // controls on screen ARE disabled rather than drawn to look it.
    type: 'form',
    component: component({
      type: 'form',
      props: { 'aria-label': 'Request access', className: 'w-80 max-w-full' },
      children: [
        {
          type: 'field',
          fieldLabel: 'Work email',
          children: [{ type: 'input', inputType: 'email', props: { name: 'specimen-email' } }],
        },
        {
          type: 'field',
          fieldLabel: 'Why do you need access?',
          children: [{ type: 'textarea', rows: 2, props: { name: 'specimen-why' } }],
        },
      ],
    }),
  },
  {
    type: 'kanban',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'kanban',
      props: { id: 'design-system-fixture-kanban' },
      dataSource: fixtureRows,
      kanbanGroupBy: { field: 'status' },
      card: { footer: [{ field: 'role', format: 'text' }] },
      emptyColumnMessage: 'No specimen rows',
    }),
  },
  {
    type: 'calendar',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'calendar',
      props: { id: 'design-system-fixture-calendar' },
      dataSource: fixtureRows,
      dateField: 'startsAt',
      endDateField: 'endsAt',
      labelField: 'name',
      defaultView: 'month',
    }),
  },
  {
    type: 'chart',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'chart',
      props: { id: 'design-system-fixture-chart' },
      // The chart arm is deliberately narrower than the shared one: endpoint,
      // `rowsKey` and `query` only, so no `idKey` / `totalKey` here.
      dataSource: { system: { endpoint: CATALOG_FIXTURE_ENDPOINT, rowsKey: 'items' } },
      chartType: 'bar',
      chartAggregate: { function: 'count', groupBy: 'status' },
      emptyMessage: 'No specimen rows',
    }),
  },
  {
    type: 'kpi',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'kpi',
      props: { id: 'design-system-fixture-kpi' },
      dataSource: { system: { endpoint: CATALOG_FIXTURE_ENDPOINT, valuePath: 'total' } },
      label: 'Specimen rows',
      kpiFormat: { type: 'number' },
    }),
  },
  {
    type: 'gallery',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'gallery',
      props: { id: 'design-system-fixture-gallery' },
      dataSource: fixtureRows,
      layout: 'grid',
      gridColumns: { mobile: 1, md: 2, lg: 3 },
      // No `coverImage`: the fixture ships no image, and pointing one at a
      // remote URL would put a cross-origin request inside a frame whose whole
      // guarantee is that it makes none (A3 clause 3).
      emptyMessage: 'No specimen rows',
    }),
  },
  {
    type: 'list',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'list',
      props: { id: 'design-system-fixture-list' },
      dataSource: fixtureRows,
      // `$record.` references, not bare field names. `substituteRecordVars` is
      // the ONE substitutor every item template goes through and its grammar is
      // `$record.<field>` — a bare `name` matches nothing and reaches the page
      // as the literal word "name", which is a specimen of the template rather
      // than of the component.
      listDisplay: {
        itemTemplate: {
          title: '$record.name',
          subtitle: '$record.role',
          badge: '$record.status',
        },
        emptyMessage: 'No specimen rows',
      },
    }),
  },
  // ─── THE TWO THE FIXTURE CANNOT REACH ────────────────────────────────────
  //
  // Every drawn specimen above reads `CATALOG_FIXTURE_ENDPOINT`, whose envelope
  // is `{ items, total }` — a flat list of rows. These two read a different
  // KIND of envelope: two collections that address each other by id, nodes and
  // edges. The platform publishes no such fixture, and the one graph an
  // instance can actually serve is the operator's own access map, which is the
  // read the confidentiality bound keeps out of a preview frame ([internal ref] A3
  // clause 3) — the same standing that reports `record-picker` rather than
  // drawing it.
  //
  // So the refusal is `needs-data-source` rather than `no-renderer`: both
  // renderers exist and both work, and what is missing is something honest for
  // them to lay out. Minting a nodes-and-edges fixture endpoint to fill the gap
  // is a runtime, not a registration, and is deliberately not done here.
  //
  // Their notes are DIFFERENT sentences, not one pasted twice. The two draw
  // different readings of the same wire — one follows the edges, the other
  // crosses the sets — and a reader who meets the identical paragraph on both
  // pages learns that the console has a refusal, not what these components are.
  {
    type: 'graph',
    refusal: {
      state: 'needs-data-source',
      note:
        'Places the nodes of a bound graph into ordered columns and draws the edges between them. ' +
        'The only graph this instance can read is your own access map, and binding a preview ' +
        'frame to it is what the confidentiality bound forbids; the platform’s specimen fixture ' +
        'publishes rows rather than nodes and edges, so there is no path for it to lay out here.',
    },
  },
  {
    type: 'matrix',
    refusal: {
      state: 'needs-data-source',
      note:
        'Crosses two sets of nodes from a bound graph and marks each intersection an edge ' +
        'connects, so an absent pair stays a visible empty cell. It reads the same envelope the ' +
        'map next door does and meets the same wall: your own access map is the one graph this ' +
        'instance holds, and a fixture of flat rows gives it no two sets to cross.',
    },
  },
  ...KIT_DATA_SPECIMENS,
]

/**
 * Every published category's specimens.
 *
 * The four this phase specified are written above; the eight the
 * kit-completion pass added live in the three `catalog-specimens/{state,content,interaction}`
 * modules and are spread in here. The `Record<CatalogComponentCategory, …>`
 * annotation is what makes that split safe: publishing a thirteenth category
 * without writing its specimens fails at compile time, in this expression,
 * rather than shipping a heading over nothing.
 */
const SPECIMENS_BY_CATEGORY: Readonly<
  Record<CatalogComponentCategory, readonly CatalogSpecimen[]>
> = {
  'form-controls': FORM_CONTROL_SPECIMENS,
  structural: STRUCTURAL_SPECIMENS,
  layout: LAYOUT_SPECIMENS,
  data: DATA_SPECIMENS,
  ...STATE_SPECIMENS_BY_CATEGORY,
  ...SHOWN_SPECIMENS_BY_CATEGORY,
  ...TRIGGERED_SPECIMENS_BY_CATEGORY,
}

/** Every specimen a published category shows, in reading order. */
export function specimensOf(category: CatalogComponentCategory): readonly CatalogSpecimen[] {
  return SPECIMENS_BY_CATEGORY[category]
}

/**
 * Every specimen in the catalogue, indexed by type.
 *
 * The index is what `specimen.subject` resolves through, so a kit page NAMING a
 * type draws the same row the catalogue draws. Re-deriving the illustrative
 * props per page is how a kit ends up documenting markup the app does not emit:
 * rendered bare, `select` is an empty box and `field` emits literally nothing.
 *
 * Built once at module load rather than per lookup — the table is a constant of
 * the build, and a routed kit page would otherwise rebuild ninety rows on every
 * request.
 */
export const SPECIMEN_BY_TYPE: ReadonlyMap<string, CatalogSpecimen> = new Map(
  Object.values(SPECIMENS_BY_CATEGORY)
    .flat()
    .map((specimen) => [specimen.type, specimen] as const)
)

/**
 * The catalogue's own specimen for one type, when there is a DRAWING to be had.
 *
 * `undefined` covers three genuinely different things, and a caller resolving a
 * routed subject wants the same answer for all of them: a type nobody
 * catalogued, a type the catalogue REPORTS rather than draws (`no-renderer` /
 * `not-previewable`), and a type a preview frame may never carry at all. Each
 * is a 404 — a frame drawn around nothing would leave a reader believing the
 * type has no specimen rather than no existence.
 */
export function catalogSpecimenComponent(type: string): Component | undefined {
  return SPECIMEN_BY_TYPE.get(type)?.component
}

/**
 * Why the catalogue does not DRAW a type, when it has a reason on file.
 *
 * `undefined` covers two different silences and the caller must not conflate
 * them with each other: a type the catalogue draws (there is no refusal), and a
 * type the catalogue has never heard of (there is no row). A resolved subject
 * that reaches neither is reported with the closest true state rather than a
 * fourth vocabulary — see the row-mode branch of `specimen-subject-resolver.ts`.
 */
export function catalogSpecimenRefusal(type: string): SpecimenRefusal | undefined {
  return SPECIMEN_BY_TYPE.get(type)?.refusal
}

/**
 * The axis values a specimen may be drawn IN.
 *
 * All three optional and independent: a subject may name a variant without a
 * size, a state without either, or none at all — which is the plain specimen.
 */
export interface SpecimenAxes {
  readonly variant?: string
  readonly size?: string
  readonly state?: string
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The catalogue's specimen for one type, drawn IN the axis values it was given.
 *
 * ─── ONE DECLARATION, ONE CELL OF THE MATRIX ───────────────────────────────
 *
 * `specimen.subject` already turns ninety kit pages into one by taking its TYPE
 * from a route or a row. A variant matrix is the next axis over: seven variants
 * by three sizes is twenty-one cells, and writing them out is the ninety-page
 * problem again one level down. So a subject may name the axis values too, and
 * a row template draws one cell per row.
 *
 * ─── THE AXIS FIELD IS LIFTED, NEVER ASSUMED ───────────────────────────────
 *
 * `variant` and `size` are written onto whichever FIELD the introspector lifted
 * for this type, not onto a field of those names: the axis is a closed union
 * wherever the schema put it, and a type spelling it otherwise would be handed
 * a property it does not declare. The introspection is passed IN rather than
 * read here, so the caller that already holds it — a detail endpoint publishing
 * the axis rows a page then draws — reads the schema once per request instead
 * of once per cell.
 *
 * ─── AND THE SPECIMEN IS UNWRAPPED TO THE TYPE'S OWN NODE ─────────────────
 *
 * MEASURED, and it is the whole difference between a matrix and twenty-one
 * copies of one picture. A catalogue specimen is illustrative, so several of
 * them COMPOSE: `button`'s is a `container` of five buttons showing five
 * variants side by side, and `badge`'s is the same shape. Patching the axis
 * onto that root writes `variant` onto a `container`, which declares no such
 * field — the renderer drops it and every cell of the matrix draws the same
 * five buttons. So when an axis is named the type's OWN node inside the
 * specimen is what gets drawn, keeping the illustrative content (`label`,
 * `options`, children) that makes a bare `select` more than an empty box.
 *
 * With NO axis named nothing is unwrapped: the plain subject must keep drawing
 * exactly what it drew before this feature, or every existing kit page changes
 * under it.
 *
 * ─── AND A STATE IS APPLIED THE WAY AN AUTHOR WOULD REACH IT ───────────────
 *
 * A `rendered` state merges the real attribute the dispatcher reads, so the
 * element IS in that state. A `depicted` one merges an inline style, because a
 * browser pseudo-class cannot be forced from markup. Publishing the difference
 * is `componentTypeDetail.states[]`'s job; honouring it is this function's.
 *
 * `undefined` for a type with no drawing, and for an axis value the type does
 * not declare — the caller reports that in place rather than drawing a cell
 * that silently ignored what it was asked for.
 */
/**
 * The axis value written onto the field the introspector lifted for it:
 * `{}` when no value was asked for, and `undefined` when one was asked for that
 * the type does not declare.
 *
 * Wrapped for the same reason {@link recipeFor} is: "no axis" and "an axis this
 * type has never heard of" are different answers, and only the second is a
 * refusal. Membership is tested against the union's OWN members rather than
 * merely against the field existing, so a value from the wrong type's rows is
 * refused instead of being handed to a renderer that would ignore it.
 */
const axisPatch = (
  value: string | undefined,
  field: TypeField | undefined
): Readonly<Record<string, string>> | undefined => {
  if (value === undefined) return {}
  if (field === undefined || !(field.members ?? []).includes(value)) return undefined
  return { [field.name]: value }
}

/**
 * The type's own node inside its catalogue specimen — the root itself when the
 * specimen IS one control, and the first descendant of that type when it
 * composes several.
 *
 * Depth-first and first-match, because a composing specimen lists its own type
 * as siblings: any one of them is a faithful base, and the first is the one an
 * author reads as "the default".
 */
export const ownNodeOf = (
  node: unknown,
  type: string
): Readonly<Record<string, unknown>> | undefined => {
  if (!isPlainRecord(node)) return undefined
  if (node['type'] === type) return node
  const children = Array.isArray(node['children']) ? node['children'] : []
  return children.reduce<Readonly<Record<string, unknown>> | undefined>(
    (found, child) => found ?? ownNodeOf(child, type),
    undefined
  )
}

/**
 * The state recipe for a subject: `{ recipe }` when it resolves, `{}` when no
 * state was asked for, and `undefined` when a state was asked for that nothing
 * draws.
 *
 * Wrapped rather than returning the recipe directly, because "no state" and
 * "an unknown state" are different answers and only the second is a refusal.
 */
const recipeFor = (
  type: string,
  state: string | undefined
): { readonly recipe?: CategoryState } | undefined => {
  if (state === undefined) return {}
  const category = CATEGORY_OF_TYPE.get(type)
  // Resolved per TYPE with the category as fallback — the same chain the
  // endpoint publishes through, so a cell can never be asked to draw a state
  // the contract did not list, or miss one it did.
  const recipe = category === undefined ? undefined : stateRecipeOf(type, category, state)
  return recipe === undefined ? undefined : { recipe }
}

export function catalogSpecimenInAxes(
  type: string,
  axes: SpecimenAxes,
  introspection: Pick<TypeIntrospection, 'variant' | 'size'>
): Component | undefined {
  const base = catalogSpecimenComponent(type)
  if (base === undefined || !isPlainRecord(base)) return base
  if (axes.variant === undefined && axes.size === undefined && axes.state === undefined) return base

  const resolved = recipeFor(type, axes.state)
  const variant = axisPatch(axes.variant, introspection.variant)
  const size = axisPatch(axes.size, introspection.size)
  if (resolved === undefined || variant === undefined || size === undefined) return undefined

  const drawn = ownNodeOf(base, type) ?? base
  return {
    ...drawn,
    ...variant,
    ...size,
    ...componentWithRecipe(drawn, resolved.recipe),
  } as Component
}

/** Which published category each catalogued type belongs to. */
const CATEGORY_OF_TYPE: ReadonlyMap<string, string> = new Map(
  Object.entries(SPECIMENS_BY_CATEGORY).flatMap(([category, specimens]) =>
    specimens.map((specimen) => [specimen.type, category] as const)
  )
)
