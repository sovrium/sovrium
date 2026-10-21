/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MigratedPageMappings } from './migrated-page-mapping'

/**
 * Retool classic → kit types, read from a ToolScript ZIP
 * (the pinned Retool classic facts, `MIGRATION_PAGE_FACTS`).
 *
 * Keyed by the element name a `.rsx` file writes, which is the catalogue
 * name without spaces (`Key Value` is `KeyValue`, fact c1). The pinned
 * ToolScript export spells `Screen`, `Frame`, `Container`, `Header`, `View`,
 * `Tabs`, `Table`, `Column`, `ToolbarButton`, `Text`, `Form`, `Body`,
 * `Footer`, `TextArea`, `NumberInput`, `Select`, `TextInput`, `Button`,
 * `Option`, `Navigation` and `Chart`. A `Screen` is a page, not a node; an
 * `Event` is a handler, whose expressions are reported like any binding. A
 * name a later export spells differently is a key to correct here, never a
 * target to change.
 *
 * Every Retool binding — a `{{ }}` expression on any prop, a query a table or
 * a chart reads — is reported verbatim and never translated, so every node here
 * arrives unbound. A Retool `Form` stays an unbound `form` node: unlike a site
 * export, an app form posts to a query, and no `ExtractedForm` is made for it.
 *
 * Left out on purpose, and therefore reported: charts, navigation, list and
 * grid views, custom components, HTML and IFrame, and every integration component. Each
 * draws from data or code that a migration does not carry, and none has a kit
 * node that is meaningful empty.
 *
 * @public Read by the page migration converter.
 */
export const RETOOL_CLASSIC_PAGE_MAPPINGS: MigratedPageMappings = {
  source: 'retool-classic',
  components: {
    Container: {
      outcome: 'node',
      type: 'container',
      holds: 'children',
      note: 'A frame on the 12-column grid; its header, body and footer children carry across in order. A Container holding more than one View is a tabbed container, and becomes `tabs` with one panel per View',
    },
    CollapsibleContainer: {
      outcome: 'node',
      type: 'collapsible',
      holds: 'children',
      requires: ['triggerLabel'],
      note: 'One region behind one trigger; the trigger text is its title',
    },
    Stack: {
      outcome: 'node',
      type: 'flex',
      holds: 'children',
      note: 'Retool documents Stack as its flexbox container (fact c4)',
    },
    Frame: {
      outcome: 'transparent',
      note: 'A screen’s `$main` frame and the app’s shared `$header` frame; their children are mapped in place, the header written at the top of each page',
    },
    View: {
      outcome: 'transparent',
      note: 'One view of a Container; in a tabbed container, one panel, labelled by the view’s label',
    },
    Header: { outcome: 'transparent', note: 'A container’s header region, mapped in order' },
    Body: {
      outcome: 'transparent',
      note: 'A container’s or a form’s body region, mapped in order',
    },
    Footer: {
      outcome: 'transparent',
      note: 'A container’s or a form’s footer region, mapped in order',
    },
    Column: { outcome: 'absorbed', into: 'table', note: 'One column of a table' },
    ToolbarButton: {
      outcome: 'absorbed',
      into: 'table',
      note: 'A table toolbar action; its handler is reported',
    },
    Option: {
      outcome: 'absorbed',
      into: 'parent',
      note: 'A choice of a select or a tab of a tab strip, as its parent reads it',
    },
    TabbedContainer: {
      outcome: 'node',
      type: 'tabs',
      holds: 'children',
      note: 'One panel per view, in order',
    },
    Tabs: {
      outcome: 'node',
      type: 'tabs',
      holds: 'nothing',
      note: 'A tab strip; the views it switches are the panels',
    },
    Form: {
      outcome: 'node',
      type: 'form',
      holds: 'children',
      note: 'Arrives unbound: a classic form submits through a query, which is reported, never wired',
    },
    Table: {
      outcome: 'node',
      type: 'table',
      holds: 'nothing',
      note: 'Arrives with no data source; its data expression is reported',
    },
    KeyValue: {
      outcome: 'node',
      type: 'description-list',
      holds: 'nothing',
      requires: ['items'],
      note: 'Pairs of a term and a detail; a list whose pairs come from a binding is reported, not emptied',
    },
    Text: {
      outcome: 'node',
      type: 'text',
      element: 'p',
      holds: 'content',
      note: 'Its literal text carries across; a value with an expression is reported',
    },
    Button: {
      outcome: 'node',
      type: 'button',
      holds: 'content',
      note: 'Its label carries across; its click handler is a query or a script and is reported',
    },
    Link: {
      outcome: 'node',
      type: 'link',
      holds: 'content',
      note: 'Its label and a literal target carry across',
    },
    Image: {
      outcome: 'node',
      type: 'image',
      holds: 'nothing',
      note: 'A literal source carries across; an asset reached through a resource is reported',
    },
    Divider: {
      outcome: 'node',
      type: 'separator',
      holds: 'nothing',
      note: 'A hairline between two things',
    },
    Alert: {
      outcome: 'node',
      type: 'alert',
      holds: 'content',
      note: 'Its title and description carry across',
    },
    Statistic: {
      outcome: 'node',
      type: 'kpi',
      holds: 'nothing',
      note: 'A single figure with its label; the figure is an expression and is reported',
    },
    Avatar: {
      outcome: 'node',
      type: 'avatar',
      holds: 'nothing',
      note: 'A person or an entity at a glance',
    },
    TextArea: {
      outcome: 'node',
      type: 'textarea',
      holds: 'nothing',
      note: 'A multi-line field inside an unbound form',
    },
    NumberInput: {
      outcome: 'node',
      type: 'number-input',
      holds: 'nothing',
      note: 'A number field inside an unbound form',
    },
    TextInput: {
      outcome: 'node',
      type: 'input',
      holds: 'nothing',
      note: 'A single-line field inside an unbound form',
    },
    Select: {
      outcome: 'node',
      type: 'select',
      holds: 'nothing',
      note: 'Its literal options carry across; options read from a query are reported',
    },
    Checkbox: {
      outcome: 'node',
      type: 'checkbox',
      holds: 'nothing',
      note: 'One boolean choice',
    },
  },
  layout: {
    'grid.columns': {
      property: 'columns',
      note: 'Main and header frames sit on a fixed 12-column grid (fact c2); a frame becomes a 12-column grid',
    },
    'Stack.direction': {
      property: 'direction',
      note: 'A Stack lays its children along one axis',
    },
    'Stack.gap': {
      property: 'gap',
      note: 'The space between a Stack’s children, on the spacing scale or reported',
    },
    'Container.padding': {
      property: 'padding',
      note: 'The inner space of a frame, on the spacing scale or reported',
    },
  },
}
