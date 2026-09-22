/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sub-schemas of `graph` — a LAYERED node-link drawing over a bound graph.
 *
 * ─── WHY THIS IS NOT A `chart`, AND NOT A `matrix` ─────────────────────────
 *
 * `ChartTypeSchema` is `bar | line | pie | area | donut | scatter`: every one
 * of them plots a VALUE against an axis. A node-link drawing plots neither —
 * its geometry comes from the edges, and an author who wanted one out of
 * `chart` would be asking for a seventh `chartType` whose every other option
 * is meaningless to it.
 *
 * `matrix` next door reads the SAME wire and is still a different type: it
 * crosses two sets and draws the intersection, so a pair with no edge is a
 * visible empty cell. A graph draws the edges themselves, so a pair with no
 * edge is nothing at all. Same data, two readings — the Matrix lens answers
 * "who reaches what", the Map lens answers "how".
 *
 * ─── THE BOUNDARY THIS FILE DEFENDS — THE SAME ONE `matrix` DEFENDS ────────
 *
 * The one shipped consumer is the console's Organisation page, drawing the Map
 * lens over `GET /api/admin/organisation/graph`. That endpoint has a rich,
 * closed vocabulary — twelve node kinds, five edge kinds, `family`, `level`,
 * `state`, `ops`, `viaOpenRung` — and NONE of it belongs here.
 *
 * So every key that NAMES something in the bound graph is an OPEN string:
 * `columns[].kinds` and `columns[].groupBy`. `kinds: ['person', 'agent']` and
 * `groupBy: 'kind'` are `/api/admin/organisation/graph`'s words, not the
 * platform's, and closing them would mean a second endpoint with a different
 * node vocabulary could not be drawn at all.
 *
 * Exactly three things are closed, and all three for the one reason that
 * justifies closing anything here: the RENDERER enumerates them.
 *
 *  - {@link GraphLayoutSchema}        — it draws each layout.
 *  - {@link GraphSelectionModeSchema} — it implements each selection behaviour.
 *  - {@link GraphReachSchema}         — a traversal direction is platform
 *    vocabulary, where the field being traversed is not.
 *
 * ─── AND WHAT IS NOT A KEY HERE AT ALL ─────────────────────────────────────
 *
 * There is no edge filter, and its absence is a decision rather than a gap.
 * An edge is drawn if and only if BOTH its endpoints are drawn, and the
 * columns are the only thing that decides which nodes are drawn. So a Map
 * whose columns admit no `automation` node draws no `step` edge, without
 * anybody declaring that — the filter falls out of the geometry. Adding an
 * `edgeKinds` key would duplicate a rule that already holds, and would let two
 * halves of one config disagree: columns admitting a node kind whose only
 * edges the edge filter excludes is a node drawn with nothing attached to it.
 *
 * @see src/domain/models/api/admin/organisation/graph.ts — the shipped wire the one consumer binds
 * @see src/domain/models/app/pages/components/component-types/data/matrix/schema.ts — the other lens over the same wire
 */

import { Schema } from 'effect'
import { SortDirectionSchema } from '../../../data-source'

// ---------------------------------------------------------------------------
// GraphSystemSourceSchema / GraphDataSourceSchema
// ---------------------------------------------------------------------------

/**
 * Graph read-endpoint binding — the only way a `graph` gets its data.
 *
 * Identical in shape to `MatrixSystemSourceSchema`, deliberately and not by
 * accident: the two components read the same KIND of envelope — two
 * collections that address each other by id — so they take the same binding.
 * They are separate declarations rather than one shared schema because each
 * publishes its own `identifier` into the JSON Schema document and into the
 * design-system console's Configuration table, and a shared node would name
 * one of the two types in the other's documentation.
 *
 * ─── WHY THERE IS NO DB-TABLE ARM ──────────────────────────────────────────
 *
 * `chart` offers a union because a chart over DB rows is a well-defined thing
 * — a series is a column. A node-link drawing over DB rows is NOT, and the
 * argument is one step stronger than the one `matrix` makes: a matrix at least
 * has two axes a table could conceivably supply, where a graph needs to know
 * which rows are NODES and which are EDGES and which two columns of an edge
 * row address a node. Nothing in a `tables[]` declaration says any of that, so
 * the arm would decode and then draw an empty canvas. A union with one
 * unusable arm advertises a capability, passes decode, and fails silently at
 * render.
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/admin/organisation/graph
 *     nodesKey: nodes   # default
 *     edgesKey: edges   # default
 * ```
 */
export const GraphSystemSourceSchema = Schema.Struct({
  /** The graph read endpoint to fetch from (required) */
  endpoint: Schema.String.annotate({
    description:
      'Read endpoint path the drawing fetches its graph from, with the caller’s own credentials (e.g. /api/admin/organisation/graph)',
    examples: ['/api/admin/organisation/graph'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Key of the nodes array in the response envelope (default: 'nodes') */
  nodesKey: Schema.optional(
    Schema.String.annotate({
      description:
        "Key of the nodes array in the response envelope (default: 'nodes'). Nodes are placed into the declared columns.",
      examples: ['nodes'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Key of the edges array in the response envelope (default: 'edges') */
  edgesKey: Schema.optional(
    Schema.String.annotate({
      description:
        "Key of the edges array in the response envelope (default: 'edges'). An edge is drawn only when BOTH its endpoints were placed into a column.",
      examples: ['edges'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Static query params merged into every request to the endpoint */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
}).annotate({
  identifier: 'GraphSystemSource',
  title: 'Graph System Source',
  description:
    'Graph read-endpoint binding: the nodes are placed into the declared columns and the edges are drawn between them',
})

/**
 * Data binding for a `graph` — a graph read endpoint, and nothing else.
 *
 * A `Struct` rather than a `Union` deliberately; see
 * {@link GraphSystemSourceSchema} for why there is no DB-table arm.
 */
export const GraphDataSourceSchema = Schema.Struct({
  /** Graph read-endpoint binding (the only binding a graph accepts) */
  system: GraphSystemSourceSchema,
}).annotate({
  identifier: 'GraphDataSource',
  title: 'Graph Data Source',
  description: 'Graph read-endpoint binding for the node-link drawing',
})

// ---------------------------------------------------------------------------
// GraphLayoutSchema
// ---------------------------------------------------------------------------

/**
 * How the drawing places its nodes. TWO members, and the second one arrived
 * exactly the way this docblock said it would.
 *
 * ─── THE ONE-MEMBER-ENUM ARGUMENT IS DISCHARGED, NOT OUTSTANDING ───────────
 *
 * This key shipped in O3 with `['layered']` alone, against the usual and
 * generally-right objection that a field whose only legal value is its default
 * is ceremony. It was declared anyway on three grounds, and the record is kept
 * here because the call PAID OFF rather than because a third member is pending:
 *
 *  1. `'lanes'` was NAMED and SCHEDULED (O4, the Processes lens) rather than
 *     hypothetical. It is the value below.
 *  2. Widening an enum is additive where introducing a key is not — and so it
 *     proved: every `graph` written between O3 and O4 stays correct untouched,
 *     because `layout` was already there to be omitted.
 *  3. Refusing `'lanes'` in O3 was a TRUE statement rather than a placeholder:
 *     the renderer could not draw it, so an author reaching for it early met a
 *     refusal naming the value instead of a layered drawing that ignored them.
 *
 * Nothing about that argument now predicts a THIRD member. The set is closed at
 * two for the plain {@link GraphSelectionModeSchema} reason: the renderer
 * enumerates the layouts, and it draws these two. A value it cannot draw —
 * `radial`, say — is refused at boot naming the value, which is the invariant
 * this enum exists to hold and the one its specs assert.
 *
 * ─── WHAT EACH MEMBER READS ────────────────────────────────────────────────
 *
 *  - `'layered'` reads {@link GraphColumnSchema}`[]` — an ordered partition of
 *    every bound node, drawn left to right with edges between the columns.
 *  - `'lanes'` reads {@link GraphLanesSchema} — one row per LANE node, each
 *    followed by the chain of stations reachable from it.
 *
 * `layout` is the switch, and the key it does NOT name is not merely ignored:
 * declaring `columns` and `lanes` together is refused BY NAME at boot, in
 * `component-xor-rules.ts`. A cross-key rule is not expressible here —
 * `buildComponentUnion` composes every branch from a fields record and has no
 * per-branch refinement hook — so the pair is checked at the one decode
 * boundary every seam already rides, exactly as `timeline`'s
 * `children`/`dataSource` pair is. It is refused rather than left inert because
 * of that file's own criterion: an ignored `columns` means an author wrote a
 * full three-column partition, with kinds and headings and orderings, and finds
 * none of it on a page that otherwise looks correct.
 *
 * Omitted, it is `'layered'` — which is what kept the O4 widening free of any
 * change to a config already written.
 */
export const GraphLayoutSchema = Schema.Literals(['layered', 'lanes']).annotate({
  identifier: 'GraphLayout',
  title: 'Graph Layout',
  description:
    "How the drawing places its nodes (default: 'layered' — ordered columns, edges between them). `lanes` draws one row per lane node followed by its chain of stations. Closed because the renderer draws each layout, and it draws these two; a value it cannot draw is refused at boot naming the value.",
})

// ---------------------------------------------------------------------------
// GraphColumnSchema
// ---------------------------------------------------------------------------

/**
 * One column of the layered drawing — a NAMED PARTITION of the bound nodes.
 *
 * ─── WHY THIS IS AN ARRAY WHERE `matrix` HAS TWO NAMED AXES ────────────────
 *
 * `MatrixAxisSchema` is used twice, for `rows` and `columns`, and its symmetry
 * is the point. Here there is one shape used N times, because a layered
 * drawing has no fixed number of columns: the Map has three, and a drawing of
 * a different graph may have two or five. So `columns` is an ORDERED ARRAY and
 * the array's order is the drawing's left-to-right order — the one piece of
 * information a pair of named keys could not have carried.
 *
 * ─── BOTH `kinds` AND `label` ARE REQUIRED, AND THAT IS A DEPARTURE ────────
 *
 * Every key of `MatrixAxisSchema` is optional, and this struct's two are not.
 * The difference is real rather than stylistic, and it is the
 * `MatrixCellFlagSchema` rule — a shape with no valid reading is not made
 * expressible — applied to a whole column:
 *
 *  - **`kinds` omitted has no reading here.** On a single axis, "omit the
 *    filter" defensibly means "admit every node the graph returns". In an
 *    ORDERED PARTITION of that same node set, two columns each admitting
 *    everything draw every node twice, in two places, connected to itself.
 *    There is no config an author could have meant by that.
 *  - **`label` omitted leaves a hole in the accessible twin.** The twin groups
 *    its rows BY COLUMN, so an unnamed column is an unnamed group — a heading
 *    a screen-reader user meets with nothing in it. The tempting fallback,
 *    naming the column after the kinds it admits, is worse: `person, agent` is
 *    the ENDPOINT's vocabulary leaking into the operator's reading, where
 *    `Principals` is the word the author actually meant.
 *
 * Neither half alone is a column, so neither is expressible. `columns` itself
 * stays optional at the top level, exactly like every sibling field — a graph
 * that declares no columns renders its empty state rather than refusing to
 * boot.
 *
 * ─── EVERY VALUE HERE NAMES THE BOUND GRAPH, SO EVERY VALUE IS OPEN ────────
 *
 * `kinds` filters nodes by their own `kind` field, and `groupBy` / `sortBy`
 * name node FIELDS. On the one shipped consumer those are `person` / `role` /
 * `table` and `kind` / `family` / `level`, which are that endpoint's words. The
 * platform must not learn them.
 *
 * ─── HOW `groupBy` AND `sortBy` COMPOSE ON ONE COLUMN ──────────────────────
 *
 * `matrix` never had to answer this: it bands one axis and orders the other.
 * A column can do both, so the rule is stated rather than left to the
 * renderer. `sortBy` orders the nodes WITHIN each band, and the bands
 * themselves follow in the order their first member falls out of that sort. So
 * a Resources column banded by `family` and ordered by `level` reads as
 * families, each internally ranked — and not as one flat ranking with the
 * family labels sprinkled through it.
 *
 * @example
 * ```yaml
 * columns:
 *   - kinds: [person, agent]
 *     label: Principals
 *     groupBy: kind
 *   - kinds: [role, team, open]
 *     label: Grant sources
 *     sortBy: level
 *     sortDirection: desc     # most privileged first; `asc` is the ladder upside down
 *   - kinds: [table, page, form, bucket, agent-resource]
 *     label: Resources
 *     groupBy: family
 * ```
 */
export const GraphColumnSchema = Schema.Struct({
  /** Node kinds this column admits — required; see the note above on why */
  kinds: Schema.Array(
    Schema.String.annotate({ description: 'One node kind, as the bound graph spells it' }).pipe(
      Schema.check(Schema.isMinLength(1))
    )
  )
    .annotate({
      description:
        'Node kinds this column admits, as the BOUND GRAPH spells them — open strings, never a platform vocabulary. Required: in an ordered partition, a column with no filter would draw every node a second time, which is a config nobody means.',
      examples: [
        ['person', 'agent'],
        ['role', 'team', 'open'],
        ['table', 'page', 'form', 'bucket', 'agent-resource'],
      ],
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
  /** The column's heading — required, because the accessible twin groups by it */
  label: Schema.String.annotate({
    description:
      'The column’s heading, used by the drawing and as the group name in the accessible twin. Required alongside `kinds`: an unnamed column is an unnamed group in the twin, and naming it after its kinds would leak the endpoint’s vocabulary into the operator’s reading.',
    examples: ['Principals', 'Grant sources', 'Resources'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Node field whose value bands this column into labelled groups */
  groupBy: Schema.optional(
    Schema.String.annotate({
      description:
        'Node field whose value bands this column into labelled groups (e.g. a resource family). Names a field of the bound graph’s nodes, so it is an open string. Nodes that do not carry it are placed in the column ungrouped, after the bands.',
      examples: ['kind', 'family'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Node field this column orders by */
  sortBy: Schema.optional(
    Schema.String.annotate({
      description:
        'Node field this column orders by. Names a field of the bound graph’s nodes, so it is an open string; nodes that do not carry it keep their source order after those that do. Omitted, the column is drawn in the order the endpoint emitted.',
      examples: ['level'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * Direction `sortBy` orders in (default: 'asc').
   *
   * The SHARED `SortDirectionSchema` from `components/data-source.ts`, not a
   * graph-specific one — and that is a departure from this file's own rule
   * that a sibling declaration gets its own node. The rule exists to stop one
   * component type's `identifier` appearing in another's Configuration table,
   * and the shared node carries NO `identifier` at all: it is `title` +
   * `description` only, so there is nothing to leak. One word for one concept,
   * for the price of one import.
   *
   * (`matrix` minted its own `MatrixSortDirectionSchema` when this was already
   * here. That is a pre-existing duplication rather than a precedent to
   * follow, and collapsing the two is not this slice's to do.)
   */
  sortDirection: Schema.optional(SortDirectionSchema),
}).annotate({
  identifier: 'GraphColumn',
  title: 'Graph Column',
  description:
    'One column of the layered drawing: which node kinds it admits, the heading it carries, and the node fields it bands and orders by. The array’s order is the drawing’s left-to-right order.',
})

// ---------------------------------------------------------------------------
// GraphLanesSchema
// ---------------------------------------------------------------------------

/**
 * The station track of a lanes drawing — what a lane's chain is made of.
 *
 * ─── WHY THIS IS A NESTED STRUCT AND NOT TWO FLAT KEYS ─────────────────────
 *
 * `stationKinds` + `stationLabel` as two optional siblings of `kinds` would
 * admit one without the other, and a track with kinds and no heading is the
 * half-declaration {@link GraphColumnSchema} already refuses — an unnamed
 * heading in the drawing, and nothing to name the group in the accessible twin.
 * Nesting makes the pair required-together MECHANICALLY, where two flat keys
 * would need a cross-key rule this schema cannot carry.
 *
 * ─── AND WHY THERE IS NO `sortBy` HERE, WHERE THERE IS ONE ON THE SPINE ────
 *
 * This is the sharpest line in the whole declaration, so it is stated rather
 * than left to the renderer: **a lane's stations are already ordered by the
 * graph itself.** They are the chain reachable from the lane node — station
 * `n + 1` is the node the edge out of station `n` arrives at — so the order is
 * TOPOLOGY, not a field to sort on. A `sortBy` here would let a config
 * contradict the edges it was drawn from, and the drawing would have to pick a
 * winner. There is nothing for it to order, so it is not expressible.
 *
 * The lane SPINE is the opposite case and gets the key for that reason: lanes
 * have no structural order among themselves — the bound graph emits them in
 * whatever order it derived them — so a spine drawn in source order reads
 * correctly by luck and inverts silently the day the producer changes, which is
 * the hazard `GraphColumnSchema.sortBy` already exists to answer.
 *
 * ─── AND NO EDGE KIND IS NAMED, WHICH IS THE SAME OLD RULE ─────────────────
 *
 * The walk follows any edge arriving at a node this track admits, and names no
 * edge kind at all. It does not have to: the edges that can match are exactly
 * the edges whose target is a station, so the filter falls out of the geometry
 * — which is the argument this file already makes for why there is no
 * `edgeKinds` key. A drawing whose stations are `['step']` walks `step` edges
 * without the platform ever learning that word.
 */
export const GraphLaneStationsSchema = Schema.Struct({
  /** Node kinds a station may be — required; see the note above on why */
  kinds: Schema.Array(
    Schema.String.annotate({
      description: 'One station node kind, as the bound graph spells it',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  )
    .annotate({
      description:
        'Node kinds this track admits as STATIONS, as the BOUND GRAPH spells them — open strings, never a platform vocabulary. A lane’s stations are the chain of these reachable from its lane node, in the order the edges put them; no edge kind is named, because the only edges that can match are the ones arriving at a station.',
      examples: [['step']],
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
  /** The track's heading — required, for the reason a column's label is */
  label: Schema.String.annotate({
    description:
      'The station track’s heading, drawn once above the track. Required alongside `kinds` for the reason a column’s label is: an unnamed track is an unnamed group in the accessible twin, and naming it after its kinds would leak the endpoint’s vocabulary into the operator’s reading.',
    examples: ['Trigger → steps → writes'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'GraphLaneStations',
  title: 'Graph Lane Stations',
  description:
    'The station track of a lanes drawing: which node kinds are stations, and the heading the track carries. Their ORDER is the graph’s — the chain reachable from the lane node — so there is no key to sort them by.',
})

/**
 * A lanes drawing — one row per LANE node, each followed by its chain.
 *
 * ─── WHY THIS IS NOT `columns` WITH TWO ENTRIES ────────────────────────────
 *
 * The tempting reading of a lanes drawing is that it has two columns: an
 * identity gutter and a station track. It draws two headings, so the analogy
 * looks free. Three things make it wrong, and all three are this file's own
 * existing rules rather than new ones:
 *
 *  1. **`columns` has no defined arity and a lanes drawing has exactly two
 *     parts.** `columns` is an array precisely because a layered drawing has no
 *     fixed number of them. Reading entry 0 as the spine and entry 1 as the
 *     track leaves entries 2..n with NO READING — the shape-with-no-valid-
 *     reading this file refuses for {@link GraphColumnSchema}'s own two keys
 *     and `MatrixCellFlagSchema` refuses next door.
 *  2. **`sortBy` on entry 1 would be expressible and WRONG.** Station order is
 *     topology; see {@link GraphLaneStationsSchema}. Reusing `columns` would
 *     hand an author a key that lets the config contradict the edges.
 *  3. **`label` would mean two different things.** A column's heading names a
 *     partition of every bound node. The station track's heading names a track
 *     drawn ONCE and populated PER LANE. Same word, different object.
 *
 * The cost of a dedicated key is one more `identifier` pair in the JSON Schema
 * document and its rows in the Schema Option Census. That is paid once; a
 * permanently ambiguous array is paid by every reader.
 *
 * ─── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────────
 *
 * **No `groupBy`.** Banding the spine is a coherent reading and it has no
 * consumer, and — unlike widening a closed enum, which is the ONE thing this
 * file argues must be anticipated — adding an OPTIONAL key to a struct later is
 * additive and invalidates no config. So it waits for a drawing that needs it.
 *
 * **No marker for a publicly-triggered lane.** The bound graph does carry the
 * signal (an edge into the lane from its `open` node), and drawing from it
 * would be the first time this component read OUTSIDE ITS OWN DRAWN SET — a
 * lanes drawing admitting only lane and station kinds never draws that node.
 * That is a design question about the edge rule, not a missing field, and it is
 * left open rather than settled by a hardcoded kind.
 *
 * ─── AND WHAT AN ABSENT `lanes` DOES ───────────────────────────────────────
 *
 * `layout: 'lanes'` with no `lanes` key renders the EMPTY STATE — `emptyMessage`
 * in place of the drawing — exactly as `layout: 'layered'` with no `columns`
 * does. It is not a refusal, and that is a mechanical fact rather than a
 * preference: relating a `layout` VALUE to a sibling key's presence needs a
 * per-branch refinement hook `buildComponentUnion` does not have, and the
 * key-pair table in `component-xor-rules.ts` matches on presence rather than on
 * a value. The platform's existing answer to "declared nothing to draw" is the
 * empty state, and this follows it.
 *
 * @example
 * ```yaml
 * layout: lanes
 * lanes:
 *   kinds: [automation]
 *   label: Mechanism
 *   sortBy: label
 *   stations:
 *     kinds: [step]
 *     label: Trigger → steps → writes
 * ```
 */
export const GraphLanesSchema = Schema.Struct({
  /** Node kinds that DEFINE a lane — required, one row drawn per node admitted */
  kinds: Schema.Array(
    Schema.String.annotate({
      description: 'One lane node kind, as the bound graph spells it',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  )
    .annotate({
      description:
        'Node kinds that DEFINE a lane, as the BOUND GRAPH spells them — open strings, never a platform vocabulary. One row is drawn per node admitted here, and its stations are the chain reachable from it.',
      examples: [['automation']],
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
  /** The spine's heading — required, for the reason a column's label is */
  label: Schema.String.annotate({
    description:
      'The lane spine’s heading, drawn above the identity gutter. Required alongside `kinds` for the reason a column’s label is: an unnamed spine is an unnamed group in the accessible twin.',
    examples: ['Mechanism'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** The station track — required: a spine with no track is not a lanes drawing */
  stations: GraphLaneStationsSchema,
  /** Node field the LANES are ordered by (the stations are ordered by the graph) */
  sortBy: Schema.optional(
    Schema.String.annotate({
      description:
        'Node field the LANES are ordered by, top to bottom. Names a field of the bound graph’s nodes, so it is an open string; lanes not carrying it keep their source order after those that do. Omitted, the lanes are drawn in the order the endpoint emitted. There is deliberately no equivalent for STATIONS — their order is the chain the edges describe.',
      examples: ['label'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * Direction `sortBy` orders the LANES in (default: 'asc').
   *
   * The shared `SortDirectionSchema`, for the reason {@link GraphColumnSchema}
   * gives: the shared node carries no `identifier` at all, so there is nothing
   * to leak into another component's Configuration table.
   */
  sortDirection: Schema.optional(SortDirectionSchema),
}).annotate({
  identifier: 'GraphLanes',
  title: 'Graph Lanes',
  description:
    'A lanes drawing: which node kinds define a lane, the heading the spine carries, and the station track each lane’s chain is drawn along. Read only when `layout` is `lanes`; declaring it beside `columns` is refused at boot.',
})

// ---------------------------------------------------------------------------
// GraphSelectionSchema
// ---------------------------------------------------------------------------

/**
 * How many nodes may be selected at once.
 *
 * Closed at ONE member, and required inside {@link GraphSelectionSchema}, for a
 * reason that does not generalise from {@link GraphLayoutSchema}: `'multiple'`
 * is not scheduled, it is UNDEFINED. Two selected nodes leave the reach set
 * ambiguous — union of both reaches, or intersection? — and admitting a value
 * before deciding what it means is how a schema ships a shape the renderer
 * then has to guess at.
 *
 * So this member is closed for the plain reason: the renderer implements one
 * selection behaviour, and a second value is a behaviour it does not have.
 */
export const GraphSelectionModeSchema = Schema.Literals(['single']).annotate({
  identifier: 'GraphSelectionMode',
  title: 'Graph Selection Mode',
  description:
    'How many nodes may be selected at once. Closed at `single` because the renderer implements one selection behaviour — `multiple` would leave the reach set ambiguous (union or intersection) and is not defined.',
})

/**
 * Which way the reach highlight walks the edges from the selected node.
 *
 * CLOSED, and it does not breach the open-string boundary this file defends:
 * a traversal DIRECTION is platform vocabulary — every directed graph has one
 * — where the edges being traversed carry the bound graph's own words.
 *
 * The one shipped consumer needs `downstream`: selecting a person on the Map
 * answers "what can this person reach", which walks `person -> role ->
 * resource` with the arrows. `upstream` answers the mirror question on a
 * resource — "who can reach this" — and `both` is the whole connected
 * component around a node.
 */
export const GraphReachSchema = Schema.Literals(['downstream', 'upstream', 'both']).annotate({
  identifier: 'GraphReach',
  title: 'Graph Reach',
  description:
    "Which way the reach highlight walks the edges from the selected node (default: 'downstream' — what the selection reaches). `upstream` is the mirror question, `both` the whole connected component. Closed because a direction is platform vocabulary; the edges it walks are not.",
})

/**
 * Selecting a node, and what lights up when one is selected.
 *
 * ─── THE HIGHLIGHT IS INTERNAL STATE AND IS NEVER PUBLISHED ────────────────
 *
 * Selecting dims the nodes and edges outside the reach set and marks the ones
 * inside it. That whole computation lives in the island and crosses nothing:
 * the only thing that reaches the shared-filter bus is the selected node's
 * **id**. This is deliberate and is the reason `reach` is configured here
 * rather than being a property of the publisher — a subscriber receiving "the
 * 41 nodes downstream of this one" would be receiving a rendering decision,
 * and could not act on it anyway.
 *
 * ─── `mode` IS REQUIRED ONCE `selection` EXISTS ────────────────────────────
 *
 * `selection` is optional at the top level, and its ABSENCE is what says the
 * drawing is not selectable. So `selection: { reach: 'downstream' }` would be
 * asking for a reach highlight without saying what gets selected — the same
 * half-declared shape {@link GraphColumnSchema} refuses, and refused here for
 * the same reason.
 *
 * @example
 * ```yaml
 * selection:
 *   mode: single
 *   reach: downstream
 * ```
 */
export const GraphSelectionSchema = Schema.Struct({
  /** How many nodes may be selected at once (required once `selection` is declared) */
  mode: GraphSelectionModeSchema,
  /** Which way the reach highlight walks (default: 'downstream') */
  reach: Schema.optional(GraphReachSchema),
}).annotate({
  identifier: 'GraphSelection',
  title: 'Graph Selection',
  description:
    'Makes the drawing’s nodes selectable and says which way the reach highlight walks from the selected one. Absent: the drawing is not selectable. The highlight is internal state — only the selected node’s id reaches the shared-filter bus.',
})

// ---------------------------------------------------------------------------
// Type exports
//
// Only the TWO the renderer consumes. The binding type is deliberately NOT
// exported, for the reason `matrix` gives next door: a resolver reads an
// UNDECODED component node, so its binding shape has every key optional, and
// publishing a decoded twin beside it would invite the two to be used
// interchangeably.
//
// `GraphLanes` arrived in the change this comment predicted — the one that
// taught `graph-projection.ts` to place lanes. Until then it was absent under
// the rule read forwards: a type is exported when a renderer reads it, and
// nothing read a lanes declaration. It is read now, so it is published, and
// Knip never had to be silenced for an export with no consumer.
// ---------------------------------------------------------------------------

export type GraphColumn = Schema.Schema.Type<typeof GraphColumnSchema>

export type GraphLanes = Schema.Schema.Type<typeof GraphLanesSchema>
