/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterPublisherSchema } from '../../../data-source'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import {
  GraphColumnSchema,
  GraphDataSourceSchema,
  GraphLanesSchema,
  GraphLayoutSchema,
  GraphSelectionSchema,
} from './schema'

/**
 * `graph` — a layered node-link drawing: ordered columns of nodes, edges
 * between them.
 *
 * ─── THE TWO EXPORT NAMES ARE LOAD-BEARING ─────────────────────────────────
 *
 * `GraphTypeLiteral` and `graphFields`, exactly. The catalogue derives a
 * category's membership by pulling every `*TypeLiteral` export from the
 * category barrel and reading its literal, and `introspectType` pairs that
 * literal with a bag named `<base>Fields` by convention with no fallback
 * behind it. A misnamed literal makes the type vanish from the design-system
 * console and drops the `data` category census; a misnamed bag renders an
 * empty drawing rather than throwing. Neither failure is loud.
 *
 * ─── IT IS AN ISLAND, WHERE `matrix` NEXT DOOR IS NOT ──────────────────────
 *
 * The two components read the same wire and made opposite calls, so the reason
 * is worth stating rather than inferring. A `matrix` is a STATIC drawing of a
 * read: nothing on it is dragged, typed into, or re-fetched, so it renders
 * server-side and adds not one byte to the client bundle. A `graph` has
 * {@link GraphSelectionSchema} — a node is focused, `Enter` selects it, the
 * reach set lights up and everything outside it dims, and the selected id is
 * published on the shared-filter bus. Every one of those is client state that
 * changes after the document has been delivered, so the drawing is mounted as
 * a lazy island (`React.lazy`, its own `ISLANDS` entry, its own
 * `ISLAND_MOUNT_CEILINGS` baseline).
 *
 * That difference does NOT reach the accessible twin. The twin is rendered
 * server-side in the first response in both components — see `label` below —
 * so a reader with no scripting, and a crawler, still receive every fact the
 * drawing carries. The island adds selection to a page that already works.
 *
 * @see ./schema.ts — the sub-schemas, and the boundary between platform and endpoint vocabulary
 */
export const GraphTypeLiteral = Schema.Literal('graph')

export const graphFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  // Override the shared (rows-list) `dataSource` with the graph-specific
  // GRAPH binding. Must come AFTER `...dataBoundFields` to replace its
  // `dataSource`, exactly as `chart`, `kpi` and `matrix` do — and for the same
  // reason: the shape this component consumes is not the shape the shared
  // field describes. See `GraphSystemSourceSchema` for why there is no
  // DB-table arm.
  dataSource: Schema.optional(GraphDataSourceSchema),
  /** How the drawing places its nodes (default: 'layered') */
  layout: Schema.optional(GraphLayoutSchema),
  /** The drawing's columns, left to right — the array's ORDER is the drawing's order */
  columns: Schema.optional(
    Schema.Array(GraphColumnSchema)
      .annotate({
        description:
          'The drawing’s columns, in left-to-right order. Every node the bound graph returns is placed into the FIRST column whose `kinds` admit it; a node no column admits is not drawn, and an edge is drawn only when both its endpoints were. Declared empty is refused — see the check below.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * The lanes drawing's spine and station track — read when `layout` is `lanes`.
   *
   * Optional at the top level, like every sibling and like `columns`: a graph
   * declaring neither renders its empty state rather than refusing to boot. The
   * two are NOT both readable, and declaring both is refused BY NAME at boot in
   * `component-xor-rules.ts` — a cross-key rule this schema cannot carry, for
   * the reason that file's own docblock gives. An ignored `columns` would mean
   * an author wrote a full partition and finds none of it on a page that
   * otherwise looks correct, which is that file's own criterion for refusing.
   *
   * @see {@link GraphLanesSchema} — why this is not `columns` with two entries
   */
  lanes: Schema.optional(GraphLanesSchema),
  /** Makes nodes selectable, and says which way the reach highlight walks */
  selection: Schema.optional(GraphSelectionSchema),
  /**
   * Publishes the SELECTED NODE's id on a shared-filter channel.
   *
   * ─── THE SHIPPED PUBLISHER HALF, REUSED VERBATIM ───────────────────────
   *
   * This is `SharedFilterPublisherSchema` — the same struct `select.publishes`
   * takes, with the same two required keys. Inventing a second publisher shape
   * for one component would give the platform two vocabularies for one bus.
   *
   * ─── AND THE LIMITATION, STATED RATHER THAN PAPERED OVER ───────────────
   *
   * The shared-filter bus is a REQUEST-PARAM bus: `SharedFilterBindingSchema`
   * merges the published bag into the subscribing data source's HTTP request.
   * `GET /api/admin/organisation/graph` accepts **no query parameter in v1**,
   * and its own module says so and gives the reason — the five lenses are five
   * projections of one graph, so the lens is a client concern and the read is
   * unparameterised.
   *
   * So against the one shipped consumer this is a WELL-FORMED PUBLISHER WHOSE
   * CHANNEL NO SUBSCRIBER CAN YET ACT ON: a component bound to it re-requests
   * the identical body. Making it act is an O1 widening of the endpoint (a
   * `?node=` parameter), not a change to this component.
   *
   * That is also why the accessible twin is INSIDE this component rather than
   * being "the selection panel beside it" as the proposal's §3.6 table has it.
   * A panel the bus cannot drive is not an accessible twin; see `label`.
   */
  publishes: Schema.optional(SharedFilterPublisherSchema),
  /**
   * Draw the key that maps each shape to the node kind it stands for.
   *
   * ─── WHY `graph` HAS ONE WHERE `matrix` REFUSED ONE ────────────────────
   *
   * `MatrixCellFlagSchema` argues against a legend and the argument is right
   * there: a matrix draws three glyphs from a CLOSED platform vocabulary, one
   * of which prints its own meaning, and its accessible twin already names
   * every fact — so a legend would be prose explaining a figure that is
   * `aria-hidden` whenever `label` is omitted.
   *
   * A graph's shape vocabulary is the BOUND ENDPOINT's and is open-ended —
   * twelve node kinds on the one shipped wire, each drawn as a shape a reader
   * has no way to decode from the drawing alone. Three marks can be learned
   * from the twin; twelve shapes cannot.
   *
   * ─── AND IT IS PART OF THE DRAWING, NOT A SIBLING OF IT ────────────────
   *
   * The key renders INSIDE the drawing, so it inherits the drawing's
   * `aria-hidden` state. That is containment rather than a silent no-op: a
   * visual key for a visual figure is correctly hidden alongside the figure it
   * keys, and stays visible to a sighted reader in both of `label`'s states.
   * Its entries are derived from the kinds the declared `columns` actually
   * admit, so it cannot drift from what is drawn.
   */
  legend: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Draw the key mapping each shape to the node kind it stands for (default: false). Rendered INSIDE the drawing, so it is `aria-hidden` exactly when the drawing is. Its entries are derived from the kinds the declared columns admit, never authored, so it cannot disagree with what is drawn.',
      examples: [true],
    })
  ),
  /**
   * The drawing's accessible name — and the switch on HOW it is announced.
   *
   * A node-link diagram is not accessible by itself, so the contract has two
   * states and no third:
   *
   *  - **`label` present** — the drawing is `role="img"` carrying it as its
   *    `aria-label`, so a screen-reader user meets one named figure instead of
   *    a canvas of shapes with no text in it. The accessible twin beneath
   *    still renders and still carries every fact.
   *  - **`label` absent** — the drawing is `aria-hidden`, and the twin carries
   *    the facts ALONE. An unnamed figure announced as a figure is noise;
   *    silence plus a real table is the better reading.
   *
   * The twin is never optional in either state. It is the PRIMARY artifact and
   * the drawing is the second reading, which is why no key here can switch it
   * off — and why it lives inside this component rather than being delegated
   * to a neighbouring panel the bus cannot drive (see `publishes`). It
   * enumerates every node drawn, its kind, the column it sits in, and the
   * nodes it reaches, and every one of its rows is keyboard-reachable.
   */
  label: Schema.optional(
    Schema.String.annotate({
      description:
        'Accessible name for the drawing. Present: the drawing is role="img" with this as its aria-label. Absent: the drawing is aria-hidden and the accessible twin beneath it carries the facts alone. The twin renders either way.',
      examples: ['How access reaches each resource'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * What the drawing says when the bound graph places no node in any column.
   *
   * Same spelling as `chart`, `kanban` and `matrix` — one message, shown in
   * place of the drawing. It does NOT cover a DEGRADED read: a source that
   * could not be resolved is missing rather than empty, and rendering "nothing
   * to show" over an outage reads calm where the truth is a gap.
   */
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Message displayed when the bound graph places no node in any declared column. Not used for a DEGRADED read, where a source could not be resolved and the drawing is missing its contribution rather than empty.',
      examples: ['No configuration to map.'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------

export {
  GraphColumnSchema,
  GraphDataSourceSchema,
  GraphLanesSchema,
  GraphLaneStationsSchema,
  GraphLayoutSchema,
  GraphReachSchema,
  GraphSelectionModeSchema,
  GraphSelectionSchema,
  GraphSystemSourceSchema,
  type GraphColumn,
  type GraphLanes,
} from './schema'
