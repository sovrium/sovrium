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
 *                      falls through to a bare `<div>`. `tab-panel` is the
 *                      only one today. Drawing an empty box under that heading
 *                      would be the catalogue asserting the defect is the
 *                      design.
 *   `not-previewable`  renderable, and refused. A write control may not exist
 * inside a preview frame ([internal ref] A3 clauses 1-2).
 *   `needs-data-source`
 *                      renderable, and only over records. Every one of these
 *                      binds an operator TABLE, and A2's confidentiality bound
 *                      keeps operator rows out of a preview frame. Only
 *                      `data-table` accepts the platform's fixture endpoint —
 *                      its `dataSource` union is the one that carries the
 *                      `{ system }` arm, deliberately "confined to `data-table`
 *                      and never leak onto other data-bound components".
 */

import { EXCLUDED_TYPES } from './design-system-catalog-registry'
import type { CatalogComponentCategory } from './design-system-catalog-registry'
import type { Component } from '@/domain/models/app/pages/components'

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
 * The ten layout types.
 *
 * `tab-panel` is the catalogue's own discovery: accepted by
 * `ComponentTypeSchema`, absent from `COMPONENT_REGISTRY`, and the ONLY such
 * type today. It is reported, never drawn.
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
    type: 'responsive-grid',
    component: component({
      type: 'responsive-grid',
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
    type: 'hero',
    component: component({
      type: 'hero',
      title: 'Hero',
      subtitle: 'The full-bleed page opener.',
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
  {
    // Renders as a closed overlay: nothing to show inline, and forcing it open
    // would cover the rest of the catalog.
    type: 'modal',
    refusal: {
      state: 'not-previewable',
      note: 'Renders as an overlay. It has no inline appearance to document, and opening it would cover the page.',
    },
  },
  {
    type: 'tab-panel',
    refusal: {
      state: 'no-renderer',
      note: 'Accepted by the schema with no renderer behind it: a page using it renders a bare div. Nothing is drawn here because there is nothing to draw.',
    },
  },
]

/** The endpoint the data specimens read their rows from. Platform, not operator. */
export const CATALOG_FIXTURE_ENDPOINT = '/api/admin/design-system/specimen-rows'

const dataRefusal = (
  state: SpecimenRefusal['state'],
  note: string
): CatalogSpecimen['refusal'] => ({
  state,
  note,
})

const NEEDS_TABLE =
  'Reads records from one of your tables. A preview frame carries no operator data, and only data-table accepts the platform fixture endpoint.'

/**
 * The ten data types.
 *
 * `data-table` is the one that can be drawn honestly: its `dataSource` union
 * carries the `{ system }` arm, so it reads the platform's own fixture rows
 * over a same-origin GET and never names an operator table. The rest bind a
 * table by construction.
 */
const DATA_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'data-table',
    wrapperProps: { 'data-design-fixture-source': 'platform' },
    component: component({
      type: 'data-table',
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
  { type: 'form', refusal: dataRefusal('not-previewable', EXCLUDED_TYPES['form'] ?? '') },
  { type: 'data-form', refusal: dataRefusal('not-previewable', EXCLUDED_TYPES['data-form'] ?? '') },
  { type: 'kanban', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'calendar', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'chart', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'kpi', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'gallery', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'list', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
  { type: 'data-timeline', refusal: dataRefusal('needs-data-source', NEEDS_TABLE) },
]

const SPECIMENS_BY_CATEGORY: Readonly<
  Record<CatalogComponentCategory, readonly CatalogSpecimen[]>
> = {
  'form-controls': FORM_CONTROL_SPECIMENS,
  structural: STRUCTURAL_SPECIMENS,
  layout: LAYOUT_SPECIMENS,
  data: DATA_SPECIMENS,
}

/** Every specimen a published category shows, in reading order. */
export function specimensOf(category: CatalogComponentCategory): readonly CatalogSpecimen[] {
  return SPECIMENS_BY_CATEGORY[category]
}
