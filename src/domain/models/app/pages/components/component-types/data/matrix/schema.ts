/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sub-schemas of `matrix` — a rows x columns grid whose CELLS are GLYPHS.
 *
 * ─── WHY THIS IS NOT A `table` ─────────────────────────────────────────────
 *
 * `table` renders TEXT cells, and its `columnsFrom` is table-bound: the columns
 * are the fields of a declared table. A matrix's columns are DATA — one per
 * node of a bound graph — and its cells are marks rather than words: a quadrant
 * that says "create and read, not update, not delete" in one glyph. Spelling
 * that as a `table` means either a column set the author has to restate by hand
 * every time the data changes, or a cell whose whole content is a string of
 * letters nobody can scan across a grid.
 *
 * ─── THE BOUNDARY THIS FILE DEFENDS ────────────────────────────────────────
 *
 * The one shipped consumer is the console's Organisation page, drawing
 * resources x grant sources over `GET /api/admin/organisation/graph`. That
 * endpoint has a rich, closed vocabulary — node kinds, `family`, `level`, the
 * `RCUDWAI` ops alphabet, `viaOpenRung` — and NONE of it belongs here.
 *
 * So every key that NAMES something in the bound graph is an OPEN string:
 * `kinds`, `groupBy`, `sortBy`, `cell.from`, `cell.kind`, `cell.opsField`,
 * `flag.field`. `groupBy: 'family'` and `sortBy: 'level'` name FIELDS OF A
 * NODE, and closing them to `'family'` / `'level'` would hard-code one
 * endpoint's shape into the platform schema — the same defect as a `table`
 * whose column names were an enum.
 *
 * Exactly two things are closed, and both for the same reason: the RENDERER
 * enumerates them.
 *
 *  - {@link MatrixGlyphSchema} — the renderer draws each glyph; an unrecognised
 *    one is a cell it cannot draw.
 *  - {@link MatrixSortDirectionSchema} — a sort direction is platform
 *    vocabulary, where the field being sorted is not.
 *
 * ─── AND WHAT IS A RENDERER CONSTANT RATHER THAN CONFIG ────────────────────
 *
 * The `R C / U D` quadrant mapping is NOT in this schema. It is the letters of
 * the ops alphabet placed at four corners, which is a drawing decision the
 * renderer owns; an author who could re-map it could produce a grid whose
 * key and its glyphs disagree — see {@link MatrixCellFlagSchema}: nothing
 * RENDERS a key today, which is precisely why the mapping may not be config.
 * The accessible twin's own column set is a
 * constant for the same reason — see {@link MatrixCellSchema}.
 *
 * @see src/domain/models/api/admin/organisation/graph.ts — the shipped wire the one consumer binds
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// MatrixSystemSourceSchema / MatrixDataSourceSchema
// ---------------------------------------------------------------------------

/**
 * Graph read-endpoint binding — the only way a `matrix` gets its data.
 *
 * ─── WHY A SPECIALISED SOURCE, LIKE `chart` ────────────────────────────────
 *
 * `dataBoundFields.dataSource` is a union of the shared DB-table binding and
 * the shared `SystemSourceSchema`, and BOTH read a flat ROWS LIST. A matrix
 * reads a GRAPH: two collections that address each other by id. So this
 * overrides the shared field exactly as `chart` and `kpi` do, and for the same
 * structural reason — the shape the component consumes is not the shape the
 * shared field describes.
 *
 * Where `SystemSourceSchema` / `ChartSystemSourceSchema` carry ONE `rowsKey`,
 * this carries TWO keys, because a graph is two arrays and neither is "the
 * rows". Defaults are `'nodes'` and `'edges'`, which is what the one shipped
 * consumer emits.
 *
 * ─── AND WHY THERE IS NO DB-TABLE ARM ──────────────────────────────────────
 *
 * `chart` offers a union because a chart over DB rows is a well-defined thing
 * — a series is a column. A matrix over DB rows is NOT: nothing in a table
 * says which rows are the axes and which cells connect them, so the arm would
 * validate and then render nothing. A union with one unusable arm is worse
 * than a narrow struct: it advertises a capability, passes decode, and fails
 * silently at render. Widening this to accept a table is a later change that
 * must first answer what a table-backed matrix MEANS.
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
export const MatrixSystemSourceSchema = Schema.Struct({
  /** The graph read endpoint to fetch from (required) */
  endpoint: Schema.String.annotate({
    description:
      'Read endpoint path the grid fetches its graph from, server-side with the caller’s own credentials (e.g. /api/admin/organisation/graph)',
    examples: ['/api/admin/organisation/graph'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** Key of the nodes array in the response envelope (default: 'nodes') */
  nodesKey: Schema.optional(
    Schema.String.annotate({
      description:
        "Key of the nodes array in the response envelope (default: 'nodes'). Nodes become the grid’s rows and columns.",
      examples: ['nodes'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Key of the edges array in the response envelope (default: 'edges') */
  edgesKey: Schema.optional(
    Schema.String.annotate({
      description:
        "Key of the edges array in the response envelope (default: 'edges'). Edges become the grid’s cells.",
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
  identifier: 'MatrixSystemSource',
  title: 'Matrix System Source',
  description:
    'Graph read-endpoint binding: the nodes become the grid’s axes and the edges become its cells',
})

/**
 * Data binding for a `matrix` — a graph read endpoint, and nothing else.
 *
 * A `Struct` rather than a `Union` deliberately; see
 * {@link MatrixSystemSourceSchema} for why there is no DB-table arm.
 */
export const MatrixDataSourceSchema = Schema.Struct({
  /** Graph read-endpoint binding (the only binding a matrix accepts) */
  system: MatrixSystemSourceSchema,
}).annotate({
  identifier: 'MatrixDataSource',
  title: 'Matrix Data Source',
  description: 'Graph read-endpoint binding for the matrix grid',
})

// ---------------------------------------------------------------------------
// MatrixAxisSchema
// ---------------------------------------------------------------------------

/**
 * Which way an axis orders.
 *
 * CLOSED, and it does not breach the open-string boundary this file defends:
 * a sort DIRECTION is platform vocabulary — every ordered thing has one —
 * where the FIELD being sorted is the bound graph's own word and stays open.
 *
 * It exists because the one shipped consumer needs `desc`: the Organisation
 * board orders its columns by role level with the MOST privileged first, and
 * `asc` would be wrong. Baking "descending" into the renderer instead would
 * only make sense for a field literally called `level` — which is exactly the
 * endpoint-specific knowledge the platform must not hold.
 */
export const MatrixSortDirectionSchema = Schema.Literals(['asc', 'desc']).annotate({
  identifier: 'MatrixSortDirection',
  title: 'Matrix Sort Direction',
  description:
    "Direction an axis orders in (default: 'asc'). Closed because a direction is platform vocabulary; the field it sorts on is not.",
})

/**
 * One axis of the grid — used by BOTH `rows` and `columns`, unchanged.
 *
 * ─── SYMMETRY IS THE POINT, AND IT IS A LESSON PAID FOR ────────────────────
 *
 * `KanbanSwimlanesSchema` one directory over records the failure this avoids:
 * a board whose two axes had different vocabularies, so the same concept was
 * configurable in one direction and fixed in the other, and an author who had
 * learned one axis had learned nothing about the other. Its fix was to make
 * the second axis read by the first's rules; this schema starts there — ONE
 * axis type, reused, exactly as `chart` reuses `ChartAxisSchema` for `xAxis`
 * and `yAxis`.
 *
 * So `rows` and `columns` each accept `kinds`, `groupBy`, `sortBy` and
 * `sortDirection`. The sketch in the proposal happens to group rows and sort
 * columns; nothing here requires that, and a board that groups its columns is
 * a config change rather than a schema change.
 *
 * ─── EVERY KEY HERE NAMES THE BOUND GRAPH, SO EVERY KEY IS OPEN ────────────
 *
 * `kinds` filters nodes by their own `kind` field; `groupBy` and `sortBy` name
 * node FIELDS. The one consumer's vocabulary — `table`, `role`, `open`,
 * `family`, `level` — is `/api/admin/organisation/graph`'s, not the platform's.
 * Closing any of them would mean a second endpoint with a different node
 * vocabulary could not be drawn at all.
 *
 * ─── `groupBy` DRAWS ON BOTH AXES ──────────────────────────────────────────
 *
 * It did not always. The schema was symmetric from the first cut and the
 * RENDERER was not: the DOM contract defined `data-matrix-row-group` with no
 * column counterpart, so `columns.groupBy` decoded, booted, and produced no
 * band. The gap was deliberately recorded here rather than closed by narrowing
 * the schema, on the grounds that splitting this struct in two would have
 * re-introduced exactly the asymmetry `KanbanSwimlanesSchema` was repaired out
 * of — and for a renderer limitation rather than for anything true about an
 * axis.
 *
 * That is settled. The projection bands both axes and the header strip draws a
 * `data-matrix-column-group` element per band, so the key means the same thing
 * in both directions and the published docs say so. The history is kept because
 * it is the argument for where a gap like this BELONGS: leaving the symmetric
 * key and fixing the renderer cost one slice, where narrowing the schema would
 * have cost a migration and left the asymmetry behind.
 *
 * @example
 * ```yaml
 * rows:
 *   kinds: [table, page, form, bucket, agent-resource]
 *   groupBy: family
 * columns:
 *   kinds: [role, team, open]
 *   sortBy: level
 *   sortDirection: desc
 * ```
 */
export const MatrixAxisSchema = Schema.Struct({
  /** Node kinds admitted onto this axis; every other node is left out of the grid */
  kinds: Schema.optional(
    Schema.Array(
      Schema.String.annotate({ description: 'One node kind, as the bound graph spells it' }).pipe(
        Schema.check(Schema.isMinLength(1))
      )
    )
      .annotate({
        description:
          'Node kinds admitted onto this axis, as the BOUND GRAPH spells them — open strings, never a platform vocabulary. Omitted: every node the graph returns is admitted.',
        examples: [
          ['table', 'page', 'form', 'bucket', 'agent-resource'],
          ['role', 'team', 'open'],
        ],
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Node field whose value groups this axis into labelled bands; drawn on both axes */
  groupBy: Schema.optional(
    Schema.String.annotate({
      description:
        'Node field whose value groups this axis into labelled bands (e.g. a resource family). Names a field of the bound graph’s nodes, so it is an open string. Drawn on BOTH axes: rows band into stacked groups, columns into groups of headings. Order within a band is the axis’ own, so `sortBy` still applies inside a group; a node not carrying the field lands in an unnamed band.',
      examples: ['family'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Node field this axis orders by */
  sortBy: Schema.optional(
    Schema.String.annotate({
      description:
        'Node field this axis orders by. Names a field of the bound graph’s nodes, so it is an open string; nodes that do not carry it keep their source order after those that do.',
      examples: ['level'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Direction `sortBy` orders in (default: 'asc') */
  sortDirection: Schema.optional(MatrixSortDirectionSchema),
}).annotate({
  identifier: 'MatrixAxis',
  title: 'Matrix Axis',
  description:
    'One axis of the grid: which node kinds it admits, how it groups them, and how it orders them. The SAME shape for rows and for columns.',
})

// ---------------------------------------------------------------------------
// MatrixCellSchema
// ---------------------------------------------------------------------------

/**
 * How a cell is DRAWN. Closed, because the renderer enumerates these three and
 * a fourth value is a cell it has no drawing for.
 *
 *  - `quadrant`  — four corners of one mark, one per letter of the ops shape.
 *    The corner mapping is a renderer constant, not config.
 *  - `filled`    — a solid mark: this pair is connected, and the strength is
 *    not the point.
 *  - `ops-label` — the ops letters printed as text in the cell.
 */
export const MatrixGlyphSchema = Schema.Literals(['quadrant', 'filled', 'ops-label']).annotate({
  identifier: 'MatrixGlyph',
  title: 'Matrix Glyph',
  description:
    'How a populated cell is drawn: `quadrant` (four corners, one per ops letter), `filled` (a solid connected mark), `ops-label` (the ops letters as text). Closed because the renderer draws each one.',
})

/**
 * The one fact a cell may carry BESIDE its ops — drawn as a mark on the glyph
 * and named in the accessible twin.
 *
 * The one consumer's case is `viaOpenRung`: a grant reached through the `*`
 * rung rather than through anything named. That is the single most
 * consequential fact its board publishes, and losing it to a footnote would
 * lose the reading the board exists for.
 *
 * BOTH keys are required when `flag` is present, and that is the one place
 * this file departs from "optional everywhere". A `field` with no `label` is a
 * mark a screen-reader user cannot read, and a `label` with no `field` is a
 * word attached to nothing — each half alone is a shape with no valid reading,
 * so neither is expressible rather than being refused later.
 *
 * ─── THERE IS NO LEGEND, AND THAT IS THE POINT ─────────────────────────────
 *
 * An earlier draft of this comment said `label` is "the word the legend and the
 * accessible twin use". There is no legend. `label` reaches exactly two places:
 * the twin's flag column, and the marked cell's `title` so a sighted reader can
 * hover the mark. `[internal ref]` asserts the label's occurrence count
 * equals the flagged-edge count EXACTLY, which forbids a third occurrence — and
 * that assertion is the right one to keep: a legend would be prose explaining a
 * figure that is `aria-hidden` whenever `label` is omitted, so the reader who
 * most needs the explanation is the one who cannot reach it.
 *
 * `field` is an OPEN string for the reason the whole file gives: the platform
 * does not know what an open rung is, and must not learn.
 */
export const MatrixCellFlagSchema = Schema.Struct({
  /** Boolean edge field whose truth marks the cell */
  field: Schema.String.annotate({
    description:
      'Boolean field on the edge whose truth marks this cell. Names a field of the bound graph’s edges, so it is an open string.',
    examples: ['viaOpenRung'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /** The word the accessible twin and the marked cell’s `title` use */
  label: Schema.String.annotate({
    description:
      'The word for a marked cell, used in the accessible twin’s flag column and as the marked cell’s `title`. There is no rendered legend. Required alongside `field`: a mark nobody can name is a mark a screen-reader user cannot read.',
    examples: ['granted through the open rung'],
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  identifier: 'MatrixCellFlag',
  title: 'Matrix Cell Flag',
  description:
    'One boolean edge field marked on the glyph and named in the accessible twin, with the word used for it',
})

/**
 * What fills a cell at the intersection of a row node and a column node.
 *
 * ─── THE GLYPH IS A PRIMARY, NOT A PROMISE ─────────────────────────────────
 *
 * `glyph` is ONE value and a real grid draws more than one, because the glyph
 * has to follow the OPS SHAPE: a `RCUD` grant reads as a quadrant, a `RW` or
 * `AI` grant has no four corners to sit in, and a grant carrying no `ops` at
 * all has no letters to print. The board of record draws all three at once.
 *
 * So the renderer contract is a DEGRADATION LADDER, stated here because it is
 * the behaviour most likely to be re-litigated:
 *
 *  1. a cell whose `ops` the declared `glyph` can express is drawn in it;
 *  2. a cell whose `ops` it cannot degrades to `ops-label` — the letters are
 *     printed rather than dropped, because dropping them would make an `RW`
 *     grant and an `AI` grant the same mark;
 *  3. a matching edge carrying NO `ops` renders `filled` — connected, with
 *     nothing further claimed.
 *
 * The alternative — a glyph per row group — was rejected: it makes the glyph a
 * property of the ROW AXIS, so a grid grouped a different way would have to
 * restate every mapping, and two configs could then disagree about how the
 * same `RCUD` grant is drawn.
 *
 * ─── AND THE ACCESSIBLE TWIN IS NOT CONFIGURED HERE ────────────────────────
 *
 * The twin beneath the grid enumerates the CELLS — row, column, ops, flag —
 * and its column set is a renderer constant. It is not a fallback but the
 * primary artifact: an author who could omit or reshape it could ship a grid
 * whose facts exist only as marks. See the `label` field in `fields.ts` for
 * the half of the accessibility contract that IS configurable.
 *
 * @example
 * ```yaml
 * cell:
 *   from: edges
 *   kind: grant
 *   glyph: quadrant
 *   opsField: ops
 *   flag:
 *     field: viaOpenRung
 *     label: granted through the open rung
 * ```
 */
export const MatrixCellSchema = Schema.Struct({
  /** Collection in the response envelope the cells are read from (default: the bound `edgesKey`) */
  from: Schema.optional(
    Schema.String.annotate({
      description:
        'Collection in the response envelope the cells are read from (default: the binding’s `edgesKey`). An open string: it names a key of the bound graph.',
      examples: ['edges'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** Edge kind admitted as a cell; every other edge is ignored */
  kind: Schema.optional(
    Schema.String.annotate({
      description:
        'Edge kind admitted as a cell — every other edge is ignored. Names the bound graph’s own edge vocabulary, so it is an open string. Omitted: every edge between an axis pair fills its cell.',
      examples: ['grant'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** How a populated cell is drawn (default: 'filled') */
  glyph: Schema.optional(MatrixGlyphSchema),
  /** Edge field carrying the operation letters the glyph reads */
  opsField: Schema.optional(
    Schema.String.annotate({
      description:
        'Edge field carrying the operation letters the glyph reads. Names a field of the bound graph’s edges, so it is an open string. Omitted: no cell has ops, and every populated cell renders `filled`.',
      examples: ['ops'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /** One boolean edge field marked on the glyph and named in the twin */
  flag: Schema.optional(MatrixCellFlagSchema),
}).annotate({
  identifier: 'MatrixCell',
  title: 'Matrix Cell',
  description:
    'What fills the intersection of a row node and a column node: which edges count, how they are drawn, and the one flag drawn beside them',
})

// ---------------------------------------------------------------------------
// Type exports
//
// Only the four the renderer consumes. The binding and sort-direction types are
// deliberately NOT exported: `matrix-graph-resolver.ts` reads an UNDECODED
// component node, so its binding shape has every key optional, and publishing a
// decoded twin beside it would invite the two to be used interchangeably.
// ---------------------------------------------------------------------------

export type MatrixAxis = Schema.Schema.Type<typeof MatrixAxisSchema>
export type MatrixGlyph = Schema.Schema.Type<typeof MatrixGlyphSchema>
export type MatrixCellFlag = Schema.Schema.Type<typeof MatrixCellFlagSchema>
export type MatrixCell = Schema.Schema.Type<typeof MatrixCellSchema>
