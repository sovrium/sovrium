/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn ONE graph read into the layered drawing a `graph` renders.
 *
 * ─── WHAT THIS MODULE MAY KNOW, AND WHAT IT MAY NOT ────────────────────────
 *
 * It knows the ENVELOPE's structure — a node has an `id`, a `label` and a
 * `kind`; an edge has a `from` and a `to` — because that is what makes a graph
 * a graph. It knows nothing else. `person`, `family`, `level`, `state`, `ops`
 * and `viaOpenRung` are the bound endpoint's own words and reach this file only
 * as the OPEN STRINGS the author wrote in `columns[].kinds`, `groupBy` and
 * `sortBy`. A second endpoint with a different node vocabulary draws here
 * unchanged, which is the whole reason the schema left those keys open.
 *
 * ─── THE PROJECTION IS SHARED; THE GEOMETRY IS NOT ─────────────────────────
 *
 * This answers WHICH nodes, in WHICH column, in WHICH band, in WHICH order —
 * the questions the accessible twin and the drawing ask identically. It does
 * NOT answer where a node sits in pixels: that is the island's, because only
 * the drawing has coordinates and the twin would pay to serialise them.
 *
 * The island cannot import this type anyway — no island imports from
 * `@/presentation/render/**`, and the boundaries config is what says so — so
 * the two sides meet as JSON in `data-island-props` and the island declares its
 * own structurally-compatible props. That is the shape every other island
 * already has (`KpiIslandProps`, the chart's prop bag), not a concession made
 * here.
 *
 * ─── AND WHY THERE IS NO CEILING, WHERE `matrix` HAS TWO ───────────────────
 *
 * `matrix-projection.ts` caps its axes at 150 x 40, because a matrix inlines
 * rows x COLUMNS of markup and the cliff arrives from a config an author cannot
 * read a size off. A graph inlines nodes PLUS edges — a sum, not a product — so
 * the same instance costs an order of magnitude less. Measured on the console's
 * own app: 58 nodes and 49 edges, of which 47 nodes are one column.
 *
 * A lopsided, tall drawing is therefore the NORMAL case rather than a defect,
 * and it is deliberately not capped. Hiding nodes behind an "and N more" would
 * hide exactly the facts the lens exists to show — a resource nobody can name
 * is a resource nobody can audit. It is drawn whole and the page scrolls.
 *
 * @see ./graph-resolver.ts — the render-path read that feeds this
 * @see src/presentation/render/registry/island-graph-component.tsx — the SSR half
 */

import type {
  GraphColumn,
  GraphLanes,
} from '@/domain/models/app/pages/components/component-types/data/graph'

/** One record of the bound envelope — a node or an edge, read loosely. */
type GraphRecord = Readonly<Record<string, unknown>>

/** One node as the drawing and the twin both need it. */
export interface GraphNodeView {
  readonly id: string
  readonly label: string
  /** The bound graph's own word, published as `data-graph-node-kind`. */
  readonly kind: string
  /** `active` / `paused` / `disabled` on the shipped wire — open, drawn as WEIGHT. */
  readonly state?: string
  /** One short line the drawing carries as a `<title>` and the twin prints. */
  readonly detail?: string
}

/**
 * One band of a column — the nodes sharing a `groupBy` value.
 *
 * `value` absent is the UNGROUPED band: either the column declared no
 * `groupBy`, or these are the nodes that do not carry the field. The schema
 * puts those AFTER the named bands, and {@link bandsOf} is where that happens.
 */
export interface GraphBandView {
  readonly value?: string
  readonly nodes: readonly GraphNodeView[]
}

/** One declared column, with whatever it admitted. */
export interface GraphColumnView {
  /** The author's heading — `data-graph-column-label`, and the twin's group name. */
  readonly label: string
  readonly bands: readonly GraphBandView[]
}

/**
 * One lane — a spine node and the chain of stations reachable from it.
 *
 * `stations` is ORDERED BY THE GRAPH and by nothing else: station `n + 1` is
 * the node the edge out of station `n` arrives at. The schema refuses a
 * `sortBy` here for exactly that reason, so this array's order is a fact
 * recovered from the edges rather than a decision taken over them.
 */
export interface GraphLaneRowView {
  readonly node: GraphNodeView
  readonly stations: readonly GraphNodeView[]
}

/**
 * The whole lanes drawing — both headings, and one row per admitted lane.
 *
 * The two labels travel HERE rather than being read off the component in
 * `graph-island-host.tsx`, so the island receives one self-contained lanes
 * object and the host never has to know a lanes declaration's shape. It is the
 * same rule the columns already follow: the PROJECTION crosses, never the
 * config it was made from.
 */
export interface GraphLanesView {
  /** The spine heading — `data-graph-lane-label`, and the lanes' twin group. */
  readonly label: string
  /** The station track's heading — `data-graph-station-label`. */
  readonly stationLabel: string
  readonly rows: readonly GraphLaneRowView[]
}

/** One edge BOTH of whose endpoints were drawn. */
export interface GraphEdgeView {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: string
}

/** One row of the accessible twin — one DRAWN node, and what it reaches. */
export interface GraphTwinRowView {
  readonly id: string
  readonly label: string
  readonly kind: string
  readonly columnLabel: string
  readonly band?: string
  readonly detail?: string
  /** Labels of the nodes this one reaches DIRECTLY — the edges, as text. */
  readonly reaches: readonly string[]
}

/** One entry of the key: a node kind, and the shape index that stands for it. */
export interface GraphLegendEntryView {
  readonly kind: string
  readonly shape: number
}

export interface GraphDrawingView {
  readonly kind: 'drawing'
  readonly columns: readonly GraphColumnView[]
  /**
   * The lanes, under `layout: 'lanes'` — and ABSENT under `layout: 'layered'`.
   *
   * The two layouts share one `drawing` variant rather than taking one each,
   * because every other field here means the same thing in both: the edges are
   * the edges, the twin is the twin, the key is the key. Only the PLACEMENT
   * differs, so only the placement is carried twice — and `columns` is `[]`
   * whenever this is present, which is what makes "no `[data-graph-column]` in
   * a lanes drawing" fall out of the projection rather than out of a renderer
   * remembering to suppress it.
   */
  readonly lanes?: GraphLanesView
  readonly edges: readonly GraphEdgeView[]
  readonly twinRows: readonly GraphTwinRowView[]
  readonly legend: readonly GraphLegendEntryView[]
  /** Shape index per node kind — one vocabulary, so the key cannot disagree. */
  readonly shapes: Readonly<Record<string, number>>
  readonly degraded: readonly string[]
}

/**
 * The reads a graph can meet.
 *
 * THREE variants encode the FOUR states the user story names, exactly as
 * `matrix` does, because two of them differ in DATA rather than in shape:
 *
 *  - `drawing` with edges              — the healthy read;
 *  - `drawing` with NO edge            — SPARSE. Still a drawing: a set of
 *    resources nobody has been granted is a finding, not a blank;
 *  - `drawing` | `empty` with a
 *    non-empty `degraded[]`            — DEGRADED. Draws what it has and names
 *    what it could not read;
 *  - `empty`                           — no column admitted a single node, so
 *    there is no geometry and `emptyMessage` renders instead;
 *  - `unavailable`                     — the read did not succeed for THIS
 *    caller. Drawn as a notice and no drawing at all: the instance has grants,
 *    and saying it has none because this caller could not read them is the lie
 *    the endpoint's own `degraded[]` contract exists to refuse.
 */
export type GraphView =
  | GraphDrawingView
  | { readonly kind: 'empty'; readonly degraded: readonly string[] }
  | { readonly kind: 'unavailable' }

/** The declaration this projection reads, lifted off the component. */
export interface GraphProjectionConfig {
  /** The SWITCH. Anything but `'lanes'` — absent included — reads `columns`. */
  readonly layout?: string
  readonly columns?: readonly GraphColumn[]
  readonly lanes?: GraphLanes
  readonly nodesKey?: string
  readonly edgesKey?: string
}

const DEFAULT_NODES_KEY = 'nodes'
const DEFAULT_EDGES_KEY = 'edges'

/** A non-empty string field, or nothing. Absence has one spelling here. */
const text = (record: GraphRecord, key: string): string | undefined => {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** An array of records under `key`, or none — a missing collection is not an error. */
const collection = (envelope: GraphRecord, key: string): readonly GraphRecord[] => {
  const value = envelope[key]
  return Array.isArray(value) ? (value as readonly GraphRecord[]) : []
}

/** The envelope's own `degraded[]`, kept as the strings the endpoint named. */
export const degradedSources = (envelope: GraphRecord): readonly string[] => {
  const value = envelope['degraded']
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

const compareValues = (left: unknown, right: unknown): number =>
  typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right))

/**
 * Order a column's nodes — or the lane SPINE — by `sortBy`, in `sortDirection`.
 *
 * One function for both, because the two declarations ask the same question in
 * the same words. Its parameter is therefore the PAIR OF KEYS rather than a
 * `GraphColumn`: a lanes declaration is not a column and must not have to
 * pretend to be one in order to be sorted. Stations are deliberately not
 * sortable and never reach here — their order is the chain the edges describe.
 *
 * A node that does not CARRY the field keeps its source order AFTER those that
 * do — the schema's own wording. On the console's own instance that is what
 * puts the open rung last in Grant sources: it ranks on no ladder, so it can
 * neither sort among the levelled roles nor be dropped.
 */
interface SortSpec {
  readonly sortBy?: string
  readonly sortDirection?: string
}

const order = (nodes: readonly GraphRecord[], spec: SortSpec): readonly GraphRecord[] => {
  const key = spec.sortBy
  if (key === undefined) return nodes
  const direction = spec.sortDirection === 'desc' ? -1 : 1
  const carried = nodes.filter((node) => node[key] !== undefined && node[key] !== null)
  const uncarried = nodes.filter((node) => node[key] === undefined || node[key] === null)
  return [
    ...carried.toSorted((left, right) => direction * compareValues(left[key], right[key])),
    ...uncarried,
  ]
}

const nodeView = (node: GraphRecord): GraphNodeView => {
  const id = text(node, 'id') ?? ''
  const state = text(node, 'state')
  const detail = text(node, 'detail')
  return {
    id,
    label: text(node, 'label') ?? id,
    kind: text(node, 'kind') ?? '',
    ...(state === undefined ? {} : { state }),
    ...(detail === undefined ? {} : { detail }),
  }
}

/**
 * Band one column's ALREADY-ORDERED nodes.
 *
 * The composition rule is the schema's, stated there because `matrix` never had
 * to answer it — it bands one axis and orders the other, where a column does
 * both. `sortBy` orders WITHIN each band, and the bands follow in the order
 * their FIRST member falls out of that sort. So a Resources column banded by
 * `family` and ordered by `level` reads as families, each internally ranked —
 * not as one flat ranking with the family labels sprinkled through it.
 *
 * Nodes not carrying the field land in a trailing UNNAMED band, which is what
 * the schema means by "ungrouped, after the bands".
 */
const bandsOf = (
  ordered: readonly GraphRecord[],
  groupBy: string | undefined
): readonly GraphBandView[] => {
  if (groupBy === undefined) return [{ nodes: ordered.map(nodeView) }]
  const carried = ordered.filter((node) => text(node, groupBy) !== undefined)
  const uncarried = ordered.filter((node) => text(node, groupBy) === undefined)
  const values = [...new Set(carried.map((node) => text(node, groupBy) ?? ''))]
  const named = values.map((value) => ({
    value,
    nodes: carried.filter((node) => text(node, groupBy) === value).map(nodeView),
  }))
  return uncarried.length === 0 ? named : [...named, { nodes: uncarried.map(nodeView) }]
}

/**
 * Place every node into the FIRST column whose `kinds` admit it.
 *
 * FIRST, not every — the schema calls `columns` an ordered PARTITION, so a node
 * two columns both admit is drawn once, in the leftmost. Returns one entry per
 * DECLARED column, including the columns that admitted nothing: the DOM
 * contract is one `[data-graph-column]` per declared entry, so a column whose
 * kinds the instance has none of is an EMPTY column rather than an absent one.
 */
const partition = (
  nodes: readonly GraphRecord[],
  columns: readonly GraphColumn[]
): readonly (readonly GraphRecord[])[] =>
  columns.reduce<{
    readonly claimed: ReadonlySet<string>
    readonly admitted: readonly (readonly GraphRecord[])[]
  }>(
    (acc, column) => {
      const taken = nodes.filter((node) => {
        const id = text(node, 'id')
        const kind = text(node, 'kind')
        if (id === undefined || kind === undefined || acc.claimed.has(id)) return false
        return column.kinds.includes(kind)
      })
      return {
        claimed: new Set([...acc.claimed, ...taken.map((node) => text(node, 'id') ?? '')]),
        admitted: [...acc.admitted, taken],
      }
    },
    { claimed: new Set(), admitted: [] }
  ).admitted

/**
 * The edges BOTH of whose endpoints were drawn.
 *
 * This is the entire edge filter, and the schema says why there is no other: a
 * Map whose columns admit no `automation` node draws no `step` edge without
 * anybody declaring that. It is also where a MALFORMED body lands softly — an
 * edge naming an endpoint the response does not carry resolves to no drawn node
 * and is dropped, because a map that crashes on one bad edge tells the operator
 * nothing about the ninety good ones.
 */
const drawnEdges = (
  edges: readonly GraphRecord[],
  drawn: ReadonlySet<string>
): readonly GraphEdgeView[] =>
  edges.flatMap((edge) => {
    const id = text(edge, 'id')
    const from = text(edge, 'from')
    const to = text(edge, 'to')
    if (id === undefined || from === undefined || to === undefined) return []
    if (!drawn.has(from) || !drawn.has(to)) return []
    return [{ id, from, to, kind: text(edge, 'kind') ?? '' }]
  })

/**
 * One twin row per DRAWN node, in the order the drawing lays them out.
 *
 * `reaches` is the node's DIRECT successors, by label. Direct rather than
 * transitive because the criterion is that "the edges exist as text, not only
 * as lines" — a transitive closure would be the island's reach SET, which is a
 * rendering decision and deliberately crosses nothing.
 */
/**
 * What a node reaches DIRECTLY, by label — the edges of one drawing, as text.
 *
 * Closed over once per projection rather than passed down as an `edges` +
 * `labels` pair, which is a readability point as much as a parameter-count one:
 * every caller wants the same question answered about a different node, and a
 * function that answers it is a smaller thing to hand around than the two
 * collections the answer is computed from.
 */
type Reach = (id: string) => readonly string[]

const reachOver =
  (edges: readonly GraphEdgeView[], labels: ReadonlyMap<string, string>): Reach =>
  (id) =>
    edges.filter((edge) => edge.from === id).map((edge) => labels.get(edge.to) ?? edge.to)

const twinRow = (
  node: GraphNodeView,
  columnLabel: string,
  band: string | undefined,
  reach: Reach
): GraphTwinRowView => ({
  id: node.id,
  label: node.label,
  kind: node.kind,
  columnLabel,
  ...(band === undefined ? {} : { band }),
  ...(node.detail === undefined ? {} : { detail: node.detail }),
  reaches: reach(node.id),
})

const twinRowsOf = (
  columns: readonly GraphColumnView[],
  reach: Reach
): readonly GraphTwinRowView[] =>
  columns.flatMap((column) =>
    column.bands.flatMap((band) =>
      band.nodes.map((node) => twinRow(node, column.label, band.value, reach))
    )
  )

/**
 * One twin row per drawn node of a lanes drawing — a lane, then its stations.
 *
 * The twin's SHAPE does not change between the two layouts, which is the
 * property worth keeping: `Column` names the track a node sits in — the spine
 * heading for a lane, the station heading for a station — and `Group` names the
 * lane a station belongs to. Without that group cell a station's row is a bare
 * action name with nothing saying which mechanism runs it, and the eight rows
 * read as one undifferentiated list.
 *
 * A LANE's row carries no group, and that is not an omission: its own `Node`
 * cell already names the lane, so a group would say the same word twice on one
 * row.
 */
const laneTwinRowsOf = (lanes: GraphLanesView, reach: Reach): readonly GraphTwinRowView[] =>
  lanes.rows.flatMap((row) => [
    twinRow(row.node, lanes.label, undefined, reach),
    ...row.stations.map((station) => twinRow(station, lanes.stationLabel, row.node.label, reach)),
  ])

/**
 * A shape index per node kind, assigned in the order the kind is first DRAWN.
 *
 * Derived, never enumerated — and that is forced rather than chosen. The node
 * vocabulary belongs to the bound endpoint, so a renderer mapping `person` to a
 * circle would be the platform learning one endpoint's words, which is the
 * single thing this component's schema refuses. An index assigned by first
 * appearance is stable for one body, open to any vocabulary, and the legend is
 * what decodes it.
 *
 * It takes the drawn NODES rather than the placed columns, so a lanes drawing
 * assigns its shapes by the same rule and through the same code — first
 * appearance in drawn order, lane before its stations.
 *
 * Built from the kinds ACTUALLY drawn rather than from the union of the
 * declared `columns[].kinds`. The schema promises the key "cannot drift from
 * what is drawn", and a column declaring `bucket` on an instance that has no
 * bucket would otherwise put a shape in the key that appears nowhere in the
 * figure — which is exactly that drift.
 */
const shapesOf = (nodes: readonly GraphNodeView[]): Readonly<Record<string, number>> => {
  const kinds = [...new Set(nodes.map((node) => node.kind))]
  return Object.fromEntries(kinds.map((kind, index) => [kind, index]))
}

/** The nodes a declaration's `kinds` admit, ignoring anything without an id. */
const admittedBy = (
  nodes: readonly GraphRecord[],
  kinds: readonly string[]
): readonly GraphRecord[] =>
  nodes.filter((node) => {
    const kind = text(node, 'kind')
    return text(node, 'id') !== undefined && kind !== undefined && kinds.includes(kind)
  })

/**
 * Walk one lane's chain forward from its spine node.
 *
 * NAMES NO EDGE KIND, and does not need to: it follows any edge leaving the
 * current node whose TARGET the station track admits, and the only edges that
 * can satisfy that are the ones between a lane and its stations. The filter
 * falls out of the geometry — which is the same argument this component makes
 * for having no `edgeKinds` key at all.
 *
 * `seen` carries every node already placed — this lane's chain so far AND every
 * earlier lane's — so a station is drawn once, in the first lane that reaches
 * it, exactly as {@link partition} gives a node to the first column that admits
 * it. It is also what terminates the walk on a cyclic body rather than
 * recurring forever, and what keeps the twin's row ids unique.
 *
 * Where two edges both qualify the FIRST in body order wins. The one shipped
 * producer emits a path, so that case does not arise there; it is resolved
 * rather than left to chance because a malformed body must draw something.
 */
const walkChain = (
  origin: string,
  edges: readonly GraphRecord[],
  track: ReadonlyMap<string, GraphRecord>,
  seen: ReadonlySet<string>
): readonly GraphNodeView[] => {
  const next = edges.find((edge) => {
    const to = text(edge, 'to')
    return text(edge, 'from') === origin && to !== undefined && track.has(to) && !seen.has(to)
  })
  const id = next === undefined ? undefined : text(next, 'to')
  const node = id === undefined ? undefined : track.get(id)
  if (id === undefined || node === undefined) return []
  return [nodeView(node), ...walkChain(id, edges, track, new Set([...seen, id]))]
}

/** Every lane, in spine order, each carrying the chain it claimed. */
const laneRowsOf = (
  spine: readonly GraphRecord[],
  edges: readonly GraphRecord[],
  track: ReadonlyMap<string, GraphRecord>
): readonly GraphLaneRowView[] =>
  spine.reduce<{
    readonly claimed: ReadonlySet<string>
    readonly rows: readonly GraphLaneRowView[]
  }>(
    (acc, node) => {
      const id = text(node, 'id') ?? ''
      const stations = walkChain(id, edges, track, new Set([...acc.claimed, id]))
      return {
        claimed: new Set([...acc.claimed, ...stations.map((station) => station.id)]),
        rows: [...acc.rows, { node: nodeView(node), stations }],
      }
    },
    { claimed: new Set(), rows: [] }
  ).rows

/**
 * Place the bound nodes into the declared COLUMNS — the `layered` layout.
 *
 * `empty` and `drawing` are told apart by GEOMETRY alone: no column admitting a
 * single node has nothing to draw, while columns that resolve and edges that do
 * not are a SPARSE drawing and still a drawing.
 */
const projectLayered = (
  nodes: readonly GraphRecord[],
  edgeRecords: readonly GraphRecord[],
  declared: readonly GraphColumn[],
  degraded: readonly string[]
): GraphView => {
  const admitted = partition(nodes, declared)
  if (admitted.every((column) => column.length === 0)) return { kind: 'empty', degraded }

  const columns: readonly GraphColumnView[] = declared.map((column, index) => ({
    label: column.label,
    bands: bandsOf(order(admitted[index] ?? [], column), column.groupBy),
  }))
  const drawnNodes = columns.flatMap((column) => column.bands.flatMap((band) => band.nodes))
  const labels = new Map(drawnNodes.map((node) => [node.id, node.label]))
  const edges = drawnEdges(edgeRecords, new Set(drawnNodes.map((node) => node.id)))
  const shapes = shapesOf(drawnNodes)
  return {
    kind: 'drawing',
    columns,
    edges,
    twinRows: twinRowsOf(columns, reachOver(edges, labels)),
    legend: Object.entries(shapes).map(([kind, shape]) => ({ kind, shape })),
    shapes,
    degraded,
  }
}

/**
 * Place the bound nodes into LANES — one row per spine node, then its chain.
 *
 * The three ways this answers `empty` are the layered rule read over a lanes
 * declaration, not new ones. No `lanes` key at all is the same "declared
 * nothing to draw" as `layout: 'layered'` with no `columns` — a refusal would
 * need a per-branch hook `buildComponentUnion` does not have, and the platform's
 * existing answer to that is the empty state. A spine that admits no node is
 * the same emptiness `partition` reports. A lane whose chain is empty is NOT
 * empty: a mechanism that runs no step is a finding, and it is drawn.
 *
 * `columns: []` is deliberate and load-bearing rather than a filler value. It
 * is what makes "a lanes drawing emits no `[data-graph-column]`" a consequence
 * of the projection, where a renderer remembering to suppress them would be one
 * `if` away from drawing both scaffoldings at once.
 */
const projectLanes = (
  nodes: readonly GraphRecord[],
  edgeRecords: readonly GraphRecord[],
  declared: GraphLanes | undefined,
  degraded: readonly string[]
): GraphView => {
  if (declared === undefined) return { kind: 'empty', degraded }
  const spine = order(admittedBy(nodes, declared.kinds), declared)
  if (spine.length === 0) return { kind: 'empty', degraded }

  const track = new Map(
    admittedBy(nodes, declared.stations.kinds).map((node) => [text(node, 'id') ?? '', node])
  )
  const lanes: GraphLanesView = {
    label: declared.label,
    stationLabel: declared.stations.label,
    rows: laneRowsOf(spine, edgeRecords, track),
  }
  const drawnNodes = lanes.rows.flatMap((row) => [row.node, ...row.stations])
  const labels = new Map(drawnNodes.map((node) => [node.id, node.label]))
  const edges = drawnEdges(edgeRecords, new Set(drawnNodes.map((node) => node.id)))
  const shapes = shapesOf(drawnNodes)
  return {
    kind: 'drawing',
    columns: [],
    lanes,
    edges,
    twinRows: laneTwinRowsOf(lanes, reachOver(edges, labels)),
    legend: Object.entries(shapes).map(([kind, shape]) => ({ kind, shape })),
    shapes,
    degraded,
  }
}

/**
 * Project the envelope into the view the twin and the drawing share.
 *
 * `layout` is the ONLY switch, and it is read the way the schema declares it:
 * `'lanes'` reads `lanes`, and everything else — `'layered'`, and absence —
 * reads `columns`. The key the layout does not name is never consulted here,
 * which is exactly why declaring both is refused one layer up in
 * `component-xor-rules.ts` rather than resolved by a precedence rule nobody
 * could read off the config.
 */
export const projectGraph = (envelope: GraphRecord, config: GraphProjectionConfig): GraphView => {
  const nodes = collection(envelope, config.nodesKey ?? DEFAULT_NODES_KEY)
  const edges = collection(envelope, config.edgesKey ?? DEFAULT_EDGES_KEY)
  const degraded = degradedSources(envelope)
  return config.layout === 'lanes'
    ? projectLanes(nodes, edges, config.lanes, degraded)
    : projectLayered(nodes, edges, config.columns ?? [], degraded)
}
