/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Reach — the access graph as TEXT.
//
// Its own module rather than another 200 lines in `organisation.ts`, because
// the page file is the one both this lens and the Processes lens land in and a
// tab that owns a file is a tab two hands can build at once. `organisation.ts`
// gains one import, one `TABS` entry and one `tabPanel` for all of this.
//
// ─── WHAT THIS LENS IS FOR ─────────────────────────────────────────────────
//
// The Map draws who reaches what; the Matrix crosses resources with grant
// sources. Both are DRAWINGS, and a drawing cannot be sorted, searched with the
// browser's own find, copied into a ticket, or read at all without sight. This
// is the same graph as a table — every relationship, one per row — and it is
// the only lens on this page an operator can put in evidence.
//
// It is also the only one that shows the edge kinds the other two drop. The
// Matrix draws `grant` edges and nothing else; the Map draws `member` and
// `grant`. `trigger`, `escalation` and `step` appear on neither, so before this
// tab three of the five relationship kinds the endpoint publishes reached no
// surface at all.
//
// ─── WHAT THE CANVAS DRAWS AND THIS DOES NOT ───────────────────────────────
//
// The `MainReach` board draws two concentric arc rings beside a "Grant chains"
// table and a "Structural position" key-value block reading
// `Holds · Reaches · Writes · Duplicate routes · Why it matters`. The rings are
// deferred by founder decision #4 — they are a second reading of the table, and
// if ever wanted they are a `chartType: 'sunburst'` on the existing `chart`,
// not a third primitive.
//
// The key-value block SHIPS, and it took an endpoint widening to get here. The
// three reasons it could not be built before are recorded rather than deleted,
// because two of them are still true and only the third moved:
//
//   - **It is per-principal, and nothing can select a principal.** STILL TRUE
//     of this tab, and it is why the block below is a LIST over every principal
//     rather than a detail panel over one. The shared-filter bus is a
//     REQUEST-PARAM bus, so a selector would need a publisher, and the only
//     component on this page that could publish one is a `graph` — which is the
//     Map, one tab over, and a tabs panel cannot subscribe across the strip.
//   - **A row-click drawer cannot stand in.** STILL TRUE. A `drawer` binds its
//     own `dataSource.system.endpoint` with a `:id` slot and FETCHES; there is
//     no `…/graph/:id` and deliberately never will be — the widening went onto
//     the existing route as `?node=` precisely so one route serves both the bus
//     and a panel, and that shape cannot fill a path segment.
//   - **Its four figures are not on the wire.** NO LONGER TRUE, and this is the
//     whole of what changed. `holds`, `reaches`, `writes` and `duplicateRoutes`
//     are now FLAT keys on every `person` and `agent` node, absent on every
//     other kind — so a row template bound to `rowsKey: 'nodes'` reads them
//     with a one-segment `$record.` path, which is the only kind of path a
//     config layer has.
//
// So the panel is a list of principals rather than the canvas's single
// key-value card: the figures are per-principal and the page cannot select one,
// so it shows them for all of them. On an instance with four staff that reads
// better than the card would have — the four rows are comparable, and the
// comparison is the point of publishing `duplicateRoutes` at all.
//
// ─── THE TABLE SHOWS NAMES NOW ─────────────────────────────────────────────
//
// The proposal's sketch names the columns `source · kind · resource · ops ·
// route`. Until the edge carried labels this table rendered node IDS, because a
// config layer cannot join `edges` to `nodes` — and one cell of it was
// unreadable: a `person:` id is the account's opaque key, so a membership row
// read `person:mg7czPiGzxoGDBGMBqhp9ovF9R0sB8hx` where a human expects a name.
//
// `fromLabel` / `toLabel` close that, and they are a REDUNDANT COPY on purpose:
// redundant only to a consumer that can join, which this one cannot. The wire's
// own module argues the case at length. Measured on this instance: all 49 edges
// carry both, and no two share a `toLabel`, so nothing is ambiguated by the
// swap.
//
// What the ids carried and the labels do not is the KIND — `page:home` says
// "page" where `home` does not. That is a real loss and it is paid for
// deliberately: the namespace was legible on four kinds and unreadable on the
// fifth, and the fifth is the one an operator is actually looking for. The
// legend below says which names appear, so the reader is told rather than left
// to infer it from a prefix that is no longer there.
//
// ─── EVERY ROW IS A SENTENCE ───────────────────────────────────────────────
//
// `valueLabels` is render-only — it substitutes the cell text and leaves the
// record and the endpoint contract alone — so `kind` can print the verb that
// joins the two names instead of the enum member. A row reads
// `Everyone · is granted · home · R · Open rung` left to right, which is the
// sentence the graph is made of. A column of bare `grant` / `member` / `step`
// would have needed a legend beside the table to say the same thing, and a
// legend is a second place for the vocabulary to drift.

import { emptyState } from '../../components/data-page'
import { ORGANISATION_GRAPH_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/**
 * The tab this module owns.
 *
 * Exported so `organisation.ts` spreads it into `TABS` rather than restating
 * the id — the id is the page's `?tab=` ADDRESS and the panel order has to
 * match the strip, so one spelling is the only safe number of spellings.
 */
export const REACH_TAB = { id: 'reach', label: '$t:admin.organisation.tabs.reach' } as const

/**
 * The two figures the read actually carries.
 *
 * `valuePath` is a dotted path walked with plain property access
 * (`readDottedPath` in `use-kpi-system-value.ts` reduces over the segments and
 * only refuses on `null` / `undefined` / a non-object), and `typeof [] ===
 * 'object'` — so `nodes.length` resolves to the array's length and the tile
 * renders it. Measured live on this page, not inferred from the type.
 *
 * That is a thinner thing to stand on than a published scalar, and it is the
 * same class of mechanism as the `String([]) === ''` empty-gate `organisation.ts`
 * documents at its own two gates. The difference is the one worth naming:
 * `.length` on an array is a guarantee of the LANGUAGE and the wire contract
 * guarantees both keys are arrays, where the empty-gate rides on how JS happens
 * to stringify. It still wants replacing by a `nodeCount` / `edgeCount` scalar
 * on the body, for the same reason the `brand` endpoint publishes a `declared`
 * boolean rather than letting a gate infer one.
 *
 * Two tiles, not six. `Holds`, `Reaches`, `Writes` and `Duplicate routes` ARE
 * on the body now, and they still do not belong here: they are per-PRINCIPAL
 * and these two are per-INSTANCE, so a strip mixing them would invite the
 * reader to compare a count of everything against one person's share of it.
 * They have their own panel directly below.
 *
 * And NOT a third tile counting `findings`: the Findings tab is one click away
 * and answers that already, and two places answering one question is how they
 * come to disagree.
 */
const scaleTile = (label: string, valuePath: string): PageComponent =>
  ({
    type: 'kpi',
    label,
    dataSource: { system: { endpoint: ORGANISATION_GRAPH_ENDPOINT, valuePath } },
    kpiFormat: { type: 'number' },
  }) as PageComponent

/**
 * The scale strip: how big the thing below is, before anyone scrolls it.
 *
 * `label` is a `$t:` TOKEN. `kpi` is island-hosted, and its schema fields are
 * serialized into `data-island-props` — but `resolveComponentTranslationTokens`
 * runs over the component BEFORE those props are built, so the island receives
 * the resolved string rather than the key. Verified live in both languages;
 * the older note here and at `footprint.ts`'s tile helper predates that pass.
 */
const scaleStrip = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'grid grid-cols-2 gap-4 sm:max-w-md' },
    children: [
      scaleTile('$t:admin.organisation.reach.things', 'nodes.length'),
      scaleTile('$t:admin.organisation.reach.relationships', 'edges.length'),
    ],
  }) as PageComponent

/**
 * One of the four figures, as a label over its number.
 *
 * NUMBER FIRST in the DOM would have been the scannable order down a column,
 * and it is not what ships: the label leads because these four are read ACROSS
 * a row before they are compared down one, and "Holds 1" is a sentence where
 * "1 Holds" is a fragment. The grid keeps the columns aligned either way, which
 * is the property that actually makes the down-column comparison work.
 *
 * `tabular-nums` so the digits align between rows of different values — a
 * proportional `1` is narrower than a `4`, and four columns of ragged figures
 * is exactly the thing a table is supposed to fix.
 *
 * `w-24` is what makes the columns line up DOWN the list without a table: the
 * cells are a fixed width inside a `shrink-0` group, so row two's `Reaches`
 * starts where row one's did however long the two names are. Sized from the
 * longest label rather than the longest value — `Duplicate routes` wraps to two
 * lines under 96px and the three others do not, which is the trade taken
 * deliberately over widening all four for one of them.
 */
const positionFigure = (label: string, field: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-24 flex-col gap-0.5' },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-xs' },
        content: label,
      } as PageComponent,
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm tabular-nums' },
        content: `$record.${field}`,
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * One principal's structural position.
 *
 * ─── THE GATE IS WHAT MAKES THIS PANEL POSSIBLE AT ALL ─────────────────────
 *
 * The binding is `rowsKey: 'nodes'`, which on this instance is 58 rows of which
 * ONE is a principal. Nothing in a system source filters rows by a field — the
 * grid's own filters are request params and this endpoint accepts only `?node=`
 * — so the filtering is done at the TEMPLATE, with the same `visibility.record`
 * grammar the findings rows use for their severity labels.
 *
 * `kind` is the right key rather than "has a holds": the four figures are
 * present on exactly `person` and `agent` and absent on every other kind, so
 * either test selects the same rows — but one of them says WHY, and a reader
 * meeting `field: 'holds'` here would reasonably wonder what a table with a
 * `holds` of zero would do.
 *
 * MEASURED: exactly ONE `<li>` reaches the DOM on an instance with 58 nodes and
 * one principal. The gate suppresses the synthesized row wrapper, not merely
 * its contents — which is the fact this whole panel depends on, and the reason
 * it is written down here rather than assumed from the findings list next door
 * (whose gates are all INSIDE a row that renders either way).
 *
 * ─── NO PER-ROW SEPARATOR, AND THAT IS NOT A STYLE CHOICE ──────────────────
 *
 * Each visible row carries its own top border and the container carries none.
 * A `divide-y` on the parent would be the ordinary idiom and it is avoided on
 * purpose: `divide-y` styles `& > * + *`, which is evaluated against whatever
 * the list emits rather than against what survives the gate, so it is one
 * renderer change away from drawing 57 rules between invisible rows. A border
 * the row owns cannot drift that way.
 *
 * ─── THE FIGURES CLUSTER RIGHT, THEY DO NOT SPREAD ─────────────────────────
 *
 * The first cut gave the row six equal grid columns, which at 1024px put 170px
 * between a name and a one-digit figure — the same eye-track defect the
 * findings row on this page measured at 710px and fixed by leading with its
 * rank. Here the fix runs the other way: the name takes the slack (`flex-1`)
 * and the four figures are a fixed-width group that does not stretch, so a
 * reader crosses one gap instead of four.
 *
 * ─── `detail` IS THE ROLE, AND IT IS NOT A SECOND SOURCE OF TRUTH ──────────
 *
 * A `person` node's `detail` is its role name, rendered server-side. It is
 * printed rather than re-derived from the `member` edges, because those are one
 * table down on this same page and two places computing one fact is how they
 * come to disagree.
 */
const positionRow = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'kind', in: ['person', 'agent'] } },
    props: {
      className: 'border-border flex flex-wrap items-baseline gap-x-6 gap-y-3 border-t px-4 py-3',
      'data-testid': 'organisation-reach-position-row',
      'data-principal-kind': '$record.kind',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        // `w-full` at phone width, `flex-1` from `sm`. The figure group is
        // `shrink-0` and 208px wide in its two-column form, so without this the
        // name block took the 93px left over at 375 and the principal's NAME —
        // the subject of the row — truncated to `Website Ad…` while four
        // single-digit figures kept their space. Measured, and the wrong thing
        // to shorten: the figures are meaningless without knowing whose they
        // are. Full width forces the group onto its own line instead.
        props: { className: 'flex w-full min-w-0 flex-col gap-0.5 sm:w-auto sm:flex-1' },
        children: [
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground truncate text-sm font-medium' },
            content: '$record.label',
          } as PageComponent,
          {
            type: 'text',
            element: 'span',
            props: { className: 'text-foreground-subtle truncate text-xs' },
            content: '$record.detail',
          } as PageComponent,
        ],
      } as PageComponent,
      // Two columns at phone width, four from `sm`. Four `w-24` cells plus
      // their gaps is 432px, which overflows a 375px viewport by more than its
      // gutters; two rows of two fits in 208px and keeps the labels on one line.
      {
        type: 'container',
        element: 'div',
        props: { className: 'grid shrink-0 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4' },
        children: [
          positionFigure('$t:admin.organisation.reach.position.holds', 'holds'),
          positionFigure('$t:admin.organisation.reach.position.reaches', 'reaches'),
          positionFigure('$t:admin.organisation.reach.position.writes', 'writes'),
          positionFigure('$t:admin.organisation.reach.position.duplicateRoutes', 'duplicateRoutes'),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * What the four figures mean — and the one of them that is not self-evident.
 *
 * `Holds` and `Reaches` want a line each because "reaches" could plausibly mean
 * one hop or two, and it means two. `Writes` wants one because the obvious
 * reading — anything that is not a read — is wrong: an AI-access grant is not a
 * write, and folding it in would report someone as a writer on the strength of
 * a tool permission.
 *
 * `Duplicate routes` is the reason the block exists. It is not a fault and the
 * copy has to say so, because a non-zero count next to three zeros reads like
 * one; what it actually names is the thing an operator cannot see by reading
 * either grant alone, which is that revoking one of them removes no access.
 */
const positionLegend = (): PageComponent =>
  ({
    type: 'description-list',
    // `dividers: false`, where the chains legend keeps the default.
    //
    // A `<dl>` under `layout: rows` draws a rule under every row, and this one
    // sits BETWEEN two data surfaces — the principal list above it and the
    // 49-row grid below. With the rules on, three bordered blocks stack and the
    // middle one reads as a third table rather than as the note explaining the
    // first. The chains legend keeps its rules because nothing follows it.
    dividers: false,
    props: { 'data-testid': 'organisation-reach-position-legend' },
    items: [
      {
        term: 'Holds',
        detail:
          'How many roles and teams this principal stands in. The open rung is not counted — nobody holds *, which is what makes it open.',
      },
      {
        term: 'Reaches',
        detail:
          'How many distinct resources it can reach through those roles and teams. Each resource counts once, however many routes lead to it.',
      },
      {
        term: 'Writes',
        detail:
          'How many of those it can change — create, update, delete or write. A read is not a write, and neither is model access.',
      },
      {
        term: 'Duplicate routes',
        detail:
          'How many it reaches through more than one role or team. Not a fault: it is why revoking one grant can leave the access in place.',
      },
    ],
  }) as PageComponent

/**
 * The structural position panel — the canvas's key-value block, one row per
 * principal instead of one card for a principal nobody can select.
 *
 * ─── WHY THERE IS NO EMPTY STATE ───────────────────────────────────────────
 *
 * The list cannot legitimately come back with no principals. This page is admin
 * -gated, so somebody is signed in, so at least their own account is a `person`
 * node — the reader is always in their own list. The one state that WOULD empty
 * it is a degraded `principals` read, and that is reported as a degraded notice
 * on the Findings tab, which says the graph is missing a source rather than
 * that the app has nobody in it. An empty state here would compete with it and
 * say the calmer of the two things.
 *
 * The measure is the chains table's, not the prose's: the row is a name against
 * four aligned figures, so it wants the same rails as the grid beneath it.
 */
const positionPanel = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full max-w-5xl flex-col gap-3' },
    children: [
      {
        type: 'text',
        element: 'h3',
        props: { className: 'text-foreground text-sm font-medium' },
        content: '$t:admin.organisation.reach.position.heading',
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: {
          className: 'border-border bg-background-raised overflow-hidden rounded-lg border',
          'data-testid': 'organisation-reach-position',
        },
        children: [
          {
            type: 'list',
            dataSource: {
              system: { endpoint: ORGANISATION_GRAPH_ENDPOINT, rowsKey: 'nodes', idKey: 'id' },
            },
            children: [positionRow()],
          } as PageComponent,
        ],
      } as PageComponent,
      positionLegend(),
    ],
  }) as PageComponent

/**
 * Every relationship in the graph, one per row.
 *
 * ─── NO `selection`, NO `onRowClick` ───────────────────────────────────────
 *
 * Both were considered and neither earns its place. Selection exports rows the
 * island already holds, which is a real affordance — but this grid's rows are a
 * derived, per-request projection whose ids are not addresses anyone holds, so
 * an exported CSV of them is a snapshot of nothing citable. `onRowClick` needs
 * somewhere to go, and the drawer it would open has no endpoint (see header).
 *
 * ─── SORTING IS THE WHOLE AFFORDANCE ───────────────────────────────────────
 *
 * `sortable` defaults true, so every column sorts and none of them declares it.
 * That is the thing the two drawings cannot do: sort by `Relationship` and the
 * five kinds band; sort by `Route` and every open-rung grant collects at one
 * end, which on a public app is most of the table and is exactly the shape an
 * operator should see.
 *
 * ─── `ops` IS BLANK ON FOUR ROWS IN FIVE KINDS, CORRECTLY ──────────────────
 *
 * The field is present on `grant` edges and absent on every other kind, because
 * a membership permits nothing — it CONFERS. A blank `Permits` cell on a
 * `member` row is the truth, not a missing value, and the `<dl>` beneath says
 * so rather than leaving the reader to decide which it is.
 */
const chainsTable = (): PageComponent =>
  ({
    type: 'table',
    props: {
      id: 'organisation-reach-chains',
      'aria-label': 'Every relationship in the access graph',
    },
    dataSource: {
      system: { endpoint: ORGANISATION_GRAPH_ENDPOINT, rowsKey: 'edges', idKey: 'id' },
    },
    // ─── NO PER-COLUMN `width`, AND THAT IS A MEASUREMENT ────────────────
    //
    // `columns[].width` is declared, decodes, and is SERIALIZED into the
    // grid's `data-island-props` — and the island then never applies it. With
    // `width: 300 / 130 / 280 / 100 / 120` declared on these five columns the
    // rendered `th` elements measured 442 / 146 / 341 / 108 / 113 px, carried
    // no inline style and no `style` attribute at all, and the table had no
    // `colgroup`: the widths are the browser's `table-layout: auto`
    // distribution, byte for byte what they are with the key absent. Measured
    // on the MOUNTED island (`data-island-mounted` + `data-island-ready`, sort
    // buttons live), so this is not an un-hydrated skeleton.
    //
    // So the key costs payload on every grid that declares it and changes
    // nothing. It is left off here rather than kept as documentation of an
    // intent the renderer does not honour — a config that looks like it is
    // doing something is worse than one that admits it cannot. The measure is
    // constrained by the wrapper in {@link chainsPanel} instead, which is a
    // class and therefore actually renders.
    columns: [
      // `fromLabel` / `toLabel`, not `from` / `to`. The ids are still on the
      // record and still the thing the graph is wired with; they are simply not
      // what a person reads. Sorting sorts the LABEL now, which is the column's
      // own text and therefore the only sort a reader can predict from looking
      // at it — where sorting by id grouped `page:` rows together, which looked
      // like a feature and was an artefact of the prefix.
      //
      // The column HEADINGS are unchanged: `Source` and `Target` name the
      // endpoints of a relationship whichever way the cell is spelled, so the
      // catalogue keys stay put and no FR twin moves.
      { field: 'fromLabel', label: '$t:admin.organisation.reach.from' },
      {
        field: 'kind',
        label: '$t:admin.organisation.reach.kind',
        // The verb that joins the two ids. Render-only, so the record and the
        // endpoint's closed enum are untouched — which is what lets the wire
        // stay `grant` while the cell reads as English.
        valueLabels: {
          member: '$t:admin.organisation.reach.kind.member',
          grant: '$t:admin.organisation.reach.kind.grant',
          trigger: '$t:admin.organisation.reach.kind.trigger',
          escalation: '$t:admin.organisation.reach.kind.escalation',
          step: '$t:admin.organisation.reach.kind.step',
        },
      },
      { field: 'toLabel', label: '$t:admin.organisation.reach.to' },
      { field: 'ops', label: '$t:admin.organisation.reach.ops' },
      {
        field: 'viaOpenRung',
        label: '$t:admin.organisation.reach.route',
        // `true` is the only value that reaches this cell: the field is absent
        // on a named grant and on every non-grant kind, so the column is SPARSE
        // by construction and every mark in it is a grant reached through `*`.
        // That sparseness is the design — a column where a mark means exposure
        // scans in one pass, where `Named` printed 4 times beside `Open rung`
        // printed 45 would read as two labels of equal weight.
        //
        // The key is the literal `true`: `valueLabels` is keyed by the RAW cell
        // value stringified, and a boolean stringifies to `true`.
        valueLabels: { true: '$t:admin.organisation.reach.openRung' },
      },
    ],
    emptyMessage: '$t:admin.organisation.reach.empty',
  }) as PageComponent

/**
 * The grid, given a MEASURE rather than the whole column.
 *
 * `table-layout: auto` divides whatever it is handed, so at 1440 the five
 * columns spread over 1150px and `Source` alone took 442 of them — for a cell
 * that reads `open` on 45 rows in 49. The eye then tracks 430px from the
 * subject to its verb on a row whose text is barely 300px wide, which is the
 * same defect `organisation.ts` measured and closed on the findings row (710px
 * there), and the same one its findings region names as "a 370px sentence in a
 * 1150px box".
 *
 * A cap is the honest lever because the per-column one does not work (see
 * {@link chainsTable}). Sized from the content rather than picked: the widest
 * Source is a `person:` id at 43 characters, the widest Target is
 * `page:products-partner` at 21, and the other three are under 12 — about 640px
 * of text plus five cell paddings, so `max-w-5xl` (1024px) leaves the longest
 * row room to breathe without leaving the short ones stranded.
 *
 * NOT `max-w-3xl`, which is the reading measure the prose on this page takes. A
 * sentence past ~75 characters is hard to track back from; a TABLE narrower
 * than its content is a table with a horizontal scrollbar, and a scrollbar
 * hides columns rather than shortening them.
 *
 * ─── THE LEGEND IS INSIDE THE CAP, NOT BESIDE IT ───────────────────────────
 *
 * All three children take the ONE measure, and the legend is the reason the
 * wrapper holds more than the grid. Capped alone, the table stopped at 1024px
 * while the `<dl>` beneath ran to the full 1150px content column: a panel that
 * exists to explain the table, visibly not lining up with it, reading as a
 * second unrelated block. Its detail column was ~940px of prose besides, which
 * is well past the measure the blurb above it is held to.
 *
 * The empty state joins them for the same reason rather than by accident — it
 * stands exactly where the grid would, so it has to be exactly as wide.
 */
const chainsPanel = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex w-full max-w-5xl flex-col gap-3' },
    children: [chainsTable(), noRelationships(), howToRead()],
  }) as PageComponent

/**
 * How to read the table — the three things a column header cannot say.
 *
 * A real `<dl>`, so a screen reader announces each term WITH its detail; a grid
 * of `text` components cannot do that at any amount of styling, which is the
 * whole reason `description-list` exists rather than a two-column layout.
 *
 * Three pairs, and each one answers a question the grid provokes and cannot
 * answer: what an id is, what the letters mean, and what a blank Route cell
 * means. `generatedAt` was considered for a fourth and dropped — the detail is
 * ordinary text with no `format`, so it would print a raw
 * `2026-09-18T15:10:17.402Z` at the foot of a panel whose other three rows are
 * sentences.
 */
const howToRead = (): PageComponent =>
  ({
    type: 'description-list',
    props: { 'data-testid': 'organisation-reach-legend' },
    items: [
      {
        term: 'Source and target',
        detail:
          'Display names — a person, a role, a team, a table, a page, a form, or Everyone for the * rung. What the name does not say is which of those it is; the Matrix bands its rows by family and says so there.',
      },
      {
        term: 'Permits',
        detail:
          'R read · C create · U update · D delete · W write · AI model access. Blank where the relationship is not a grant — a membership confers a role, it permits nothing by itself.',
      },
      {
        term: 'Route',
        detail:
          'Open rung means the grant is reached through * — anyone at all, signed in or not. Blank means it is reached through a named role or team, or that the relationship is not a grant.',
      },
    ],
  }) as PageComponent

/**
 * The empty state, on the same `String([]) === ''` gate the findings list uses
 * and for the same reason — a system-rows table that comes back empty draws an
 * empty bordered box, so the gate and the table are mutually exclusive rather
 * than merely ordered. The mechanism is documented at length in
 * `organisation.ts`; this is the third gate riding on it.
 *
 * It says which THREE things would have to be true, because "no relationships"
 * alone is indistinguishable from a read that failed — and a read that failed
 * is reported by the degraded notice on the Findings tab, which is not this
 * tab. An operator landing here first should not have to guess.
 */
const noRelationships = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    visibility: { record: { field: 'edges', eq: '' } },
    children: [
      emptyState(
        'No relationships.',
        'Nothing in this app grants anything to anybody: no role or team reaches a table, page, form or bucket, nobody stands in a role, and no automation has a step.',
        'An app with pages but no relationships usually means the read failed — check the Findings tab for a degraded notice.'
      ),
    ],
  }) as PageComponent

/**
 * The reach region.
 *
 * Same shape as the matrix and map regions next door: the prose keeps the
 * findings column's reading measure and the grid is given the whole column.
 *
 * `aria-label` and the blurb are `$t:` keys now, closing the follow-up this
 * comment used to promise. They were literals to avoid two parallel waves
 * editing one catalogue file, and the console was `lang: 'en-US'` throughout, so
 * the cost was an inconsistency of spelling and nothing more.
 *
 * It is more than that now: the console ships French, and the matrix, map and
 * processes regions beside this one carry keys. A literal blurb here meant the
 * Reach tab alone stayed English under a French console — a gap a reader would
 * read as a missing translation rather than as a deliberate choice, because
 * that is exactly what it was.
 */
export const reachSection = (): PageComponent =>
  ({
    type: 'container',
    element: 'section',
    props: {
      'aria-label': '$t:admin.organisation.reach.region',
      'data-testid': 'organisation-reach',
      className: 'flex min-w-0 flex-col gap-3',
    },
    children: [
      {
        type: 'text',
        element: 'p',
        props: { className: 'text-foreground-subtle max-w-3xl text-sm' },
        content: '$t:admin.organisation.reach.blurb',
      } as PageComponent,
      scaleStrip(),
      positionPanel(),
      chainsPanel(),
    ],
  }) as PageComponent
