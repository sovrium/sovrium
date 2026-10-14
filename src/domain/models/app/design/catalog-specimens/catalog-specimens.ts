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
 *                      any that A2's confidentiality bound permits. Every
 *                      ROWS-shaped data type reads the platform's own fixture
 *                      endpoint instead: `table` and the list family share the
 *                      `{ system }` arm on `modules/data-bound.ts`, and
 *                      `chart` / `kpi` carry their own. An earlier note here
 *                      said that arm was "confined to `table`" — it quoted a
 *                      policy that module has since reversed, so do not
 *                      restore it. A graph, a location and a hierarchy are
 *                      fixture content too now. What stays in this state is
 *                      what no fixture can shape: a stored file, one record
 *                      of yours.
 */

import { SPECIMEN_TABLE_NAME } from '@/domain/models/app/design/specimen-fixture'
import { SHOWN_SPECIMENS_BY_CATEGORY } from './content'
import { TRIGGERED_SPECIMENS_BY_CATEGORY } from './interaction'
import { KIT_DATA_SPECIMENS, KIT_FORM_CONTROL_SPECIMENS } from './kit'
import { STATE_SPECIMENS_BY_CATEGORY } from './state'
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
 * an admin design system spec compares every one of these against the SAME type
 * rendered on an ordinary page, using one extractor run verbatim on both
 * sides. So these props are not free: they are the ordinary page's props, and
 * a divergence here reads as a catalog that documents markup the app does not
 * emit — the failure the whole spec exists to catch.
 */
const FORM_CONTROL_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'calendar',
    component: component({ type: 'calendar', defaultValue: '2026-10-14' }),
  },
  {
    type: 'label',
    component: component({ type: 'label', text: 'Work email', required: true }),
  },
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
    // ─── A WRITE TRANSPORT, NOT A CONTROL HOSTED BARE ──────────────────────
    //
    // Every other control here is a field drawn with no form around it, so it
    // has nowhere to send what is typed. This one is not: its Sign button
    // uploads the mark to a bucket and writes it onto a record by itself
    // (`writeSignature`), with whatever session the page carries — here, the
    // operator's admin session. That is [internal ref] A3 clause 1 on the transport,
    // which is why it is refused alongside `comments` rather than drawn.
    //
    // Its SIGNED reading is server-drawn from the bound record's field value,
    // so it would need a record too; the console binds none of yours.
    type: 'signature-pad',
    refusal: {
      state: 'not-previewable',
      note:
        'A well to sign in, or a name to type, under the statement being agreed to. Pressing ' +
        'Sign uploads the mark and writes it onto the record the page is bound to, so the pad ' +
        'is a write path of its own, and a read-only console may carry none. Once signed it ' +
        'reads "Signed by … on …" from that record. See it on a data-bound page.',
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
    type: 'input-otp',
    component: component({ type: 'input-otp', props: { name: 'specimen-code' } }),
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
    // The INPUT reading: one native radio per star, under `field`. The other
    // reading ("4 of 5") needs a bound record, and the console binds none of
    // yours, so a read-only specimen would only ever say "Not rated".
    type: 'rating',
    component: component({ type: 'rating', field: 'satisfaction', readOnly: false }),
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
    type: 'combobox',
    component: component({
      type: 'combobox',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'sent', label: 'Sent' },
      ],
    }),
  },
  {
    type: 'native-select',
    component: component({
      type: 'native-select',
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
 * 0x0 `<div>`. An admin design system spec asserts geometry and computed border
 * colour instead — which is why the divider is left at its DEFAULT style: the
 * prestyled `<hr>` is the thing being documented, and an author className here
 * would document the override rather than the default.
 */
const STRUCTURAL_SPECIMENS: readonly CatalogSpecimen[] = [
  { type: 'separator', component: component({ type: 'separator' }) },
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
    type: 'message-scroller',
    component: component({
      type: 'message-scroller',
      height: '160px',
      children: [
        { type: 'marker', content: 'Today', variant: 'separator' },
        {
          type: 'message',
          author: 'Léa Moreau',
          children: [{ type: 'bubble', content: 'Can the invoice be split in two?' }],
        },
        {
          type: 'message',
          author: 'Support',
          align: 'end',
          children: [{ type: 'bubble', align: 'end', content: 'Yes, that is done.' }],
        },
      ],
    }),
  },
  {
    type: 'aspect-ratio',
    component: component({
      type: 'aspect-ratio',
      ratio: 1,
      props: { className: 'w-32' },
      children: [{ type: 'qr-code', value: 'https://sovrium.com', size: 72 }],
    }),
  },
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
    type: 'resizable',
    component: component({
      type: 'resizable',
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

/** The same fixture as nodes and edges, for `graph` and `matrix`. Platform, not operator. */
export const CATALOG_FIXTURE_GRAPH_ENDPOINT = '/api/admin/design-system/specimen-graph'

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

/** The graph binding `graph` and `matrix` share: `{ nodes, edges }`, the keys both read by default. */
const fixtureGraph = { system: { endpoint: CATALOG_FIXTURE_GRAPH_ENDPOINT } } as const

/**
 * The data types — most drawn from platform fixture rows, two drawn from their
 * own config (`form`, and `filter-bar` spread in from the kit), and four at
 * the foot of the array drawn from the fixture's graph (`graph`, `matrix`) or
 * its reserved table (`map`, `tree`).
 *
 * Count them against `data/index.ts` rather than trusting this line: the split
 * moves, and a figure here would lag the array.
 *
 * ─── WHY THE ROWS-ORIENTED TYPES ARE DRAWN, NOT REFUSED ────────────────────
 *
 * The `{ system }` dataSource arm is not confined to `table`:
 * `modules/data-bound.ts` gives it to every rows-oriented data-bound component,
 * and `chart` / `kpi` carry their own endpoint-capable arms beside it. Each of
 * them therefore reads the platform's own fixture rows over a same-origin GET
 * and names no operator table — the same standing that makes `table` drawable.
 *
 * `list` is the only data type whose island-ness is DECIDED at resolve time.
 * Every specimen here is nested inside its canvas container, so a resolver
 * that mapped only the TOP level of `page.components` would never stamp its
 * props, and the renderer would fall through to the server-side expand path,
 * which over a system source has no rows to expand and emits an empty `<ul>`.
 * `stampNestedIslands` (`data-source-resolver.ts`) descends, so a nested
 * data-bound `list` hydrates exactly as a top-level one does — in this
 * catalogue and in any app that nests one.
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
    type: 'carousel',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'carousel',
      props: { id: 'design-system-fixture-carousel' },
      dataSource: fixtureRows,
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
    type: 'event-calendar',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'event-calendar',
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
  // ─── THE FOUR THAT READ MORE THAN FLAT ROWS ──────────────────────────────
  //
  // `graph` and `matrix` read two collections that address each other by id,
  // so they bind the fixture GRAPH served beside the rows: people, teams and
  // projects, and the edges between them. `map` and `tree` read a field a flat
  // row did not carry, a place and a parent, so they bind the reserved
  // specimen TABLE, whose rows carry both. All four stay on platform content:
  // none names a table of yours, which is the confidentiality bound.
  {
    type: 'graph',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'graph',
      props: { id: 'design-system-fixture-graph' },
      layout: 'layered',
      dataSource: fixtureGraph,
      columns: [
        { kinds: ['person'], label: 'People', groupBy: 'family' },
        { kinds: ['team'], label: 'Teams', sortBy: 'level', sortDirection: 'desc' },
        { kinds: ['project'], label: 'Projects' },
      ],
      label: 'Who works on what',
      emptyMessage: 'No specimen graph to draw.',
    }),
  },
  {
    type: 'matrix',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'matrix',
      props: { id: 'design-system-fixture-matrix' },
      dataSource: fixtureGraph,
      rows: { kinds: ['person'], groupBy: 'family' },
      columns: { kinds: ['project'] },
      cell: { from: 'edges', kind: 'access', glyph: 'quadrant', opsField: 'ops' },
      label: 'Who can reach which project',
      emptyMessage: 'No access to draw.',
    }),
  },
  {
    type: 'map',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'map',
      props: { id: 'design-system-fixture-map' },
      dataSource: { table: SPECIMEN_TABLE_NAME },
      locationField: 'location',
      labelField: 'name',
      emptyMessage: 'No specimen rows to pin.',
    }),
  },
  {
    type: 'tree',
    wrapperProps: FIXTURE_SOURCE,
    component: component({
      type: 'tree',
      props: { id: 'design-system-fixture-tree' },
      dataSource: { table: SPECIMEN_TABLE_NAME },
      parentField: 'parentId',
      labelField: 'name',
      emptyMessage: 'No specimen rows to nest.',
    }),
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
export const SPECIMENS_BY_CATEGORY: Readonly<
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
