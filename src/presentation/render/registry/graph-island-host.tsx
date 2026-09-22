/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `graph` island's mount root, its loading skeleton, and the twin BESIDE it.
 *
 * Split from `island-graph-component.tsx` so that file exports only its
 * renderer: a module mixing a component export with a non-component one defeats
 * fast refresh, which is the same reason `matrix-grid.tsx` sits apart from
 * `matrix-component.tsx` next door.
 *
 * ─── THE ADJACENCY IS THE POINT ────────────────────────────────────────────
 *
 * The `data-island` div and `<GraphTwin>` are SIBLINGS, never nested, and this
 * is the only place that relationship is expressed — so it is the only place it
 * could be got wrong. An island REPLACES its own mount root when it hydrates,
 * so a twin rendered inside that root would be painted once by the server and
 * then again by the island; two paints of one table across the SSR boundary
 * drift silently, and the twin is the artifact that may least afford to.
 *
 * Keeping it outside also means the twin never waits on a chunk: every fact the
 * drawing carries is already in the first response, for a reader with no
 * scripting and for a crawler.
 */

import { GraphTwin } from '@/presentation/render/registry/graph-twin'
import type { Component } from '@/domain/models/app/pages/components'
import type { GraphView } from '@/presentation/render/resolve/graph-projection'
import type { GraphResolvedComponent } from '@/presentation/render/resolve/graph-resolver'
import type { ReactElement } from 'react'

/** The declaration the graph renderer reads off the component, beside its drawing. */
export type GraphComponent = Component &
  GraphResolvedComponent & {
    readonly label?: string
    readonly legend?: boolean
    readonly emptyMessage?: string
    readonly selection?: { readonly mode?: string; readonly reach?: string }
    readonly publishes?: { readonly bindTo?: string; readonly param?: string }
  }

/**
 * Tailwind heights for the skeleton's placeholder nodes.
 *
 * Hoisted to module scope so the JSX never allocates an inline
 * `style={{ height }}` object (`react-perf/jsx-no-new-object-as-prop`), and
 * reused for both axes of the skeleton grid — the columns and the rows in each
 * — because four by four is a placeholder, not a prediction.
 */
const SKELETON_NODES = ['h-7', 'h-7', 'h-7', 'h-7']

/**
 * The props bag the island mounts with.
 *
 * The PROJECTION crosses, never the envelope: the island receives the nodes
 * already partitioned, banded and ordered, so it computes geometry and nothing
 * else. That is also what keeps the endpoint's vocabulary out of the island —
 * it meets `kind` as an opaque string with a shape index already assigned.
 *
 * `legendEntries` and `legend` are two different things wearing one word in the
 * schema: the ENTRIES are derived from the kinds actually drawn, while `legend`
 * is the author's boolean saying whether to draw the key at all. Naming them
 * apart here is what stops the island reading one for the other.
 */
const islandProps = (
  component: GraphComponent,
  view: Extract<GraphView, { kind: 'drawing' }>
): Record<string, unknown> => ({
  columns: view.columns,
  // Present only under `layout: 'lanes'`, and then `columns` is `[]` — the two
  // placements are mutually exclusive in the projection, so the island reads
  // one switch rather than choosing between two populated shapes. The lanes
  // object carries its own two headings, so the host never has to know what a
  // lanes declaration looks like.
  lanes: view.lanes,
  edges: view.edges,
  shapes: view.shapes,
  legendEntries: view.legend,
  legend: component.legend === true,
  label: component.label,
  selection: component.selection,
  publishes: component.publishes,
})

/** The mount root and its skeleton, with the server-rendered twin beside it. */
export function GraphIslandHost({
  component,
  view,
}: {
  readonly component: GraphComponent
  readonly view: Extract<GraphView, { kind: 'drawing' }>
}): ReactElement {
  return (
    <>
      <div className="overflow-x-auto">
        <div
          data-island="graph"
          data-island-props={JSON.stringify(islandProps(component, view))}
        >
          {/* Loading skeleton — preserved as the Suspense fallback. Placeholder
           * columns of a fixed size, because the drawing's own geometry is not
           * known until the island computes it, and a skeleton that guessed the
           * real column heights would shift twice instead of once. */}
          <div
            className="flex gap-12 py-2"
            aria-label="Loading map..."
            role="status"
          >
            {SKELETON_NODES.map((_column, index) => (
              <div
                key={`graph-skeleton-${String(index)}`}
                className="flex w-40 flex-col gap-2"
              >
                {SKELETON_NODES.map((cls, row) => (
                  <div
                    key={`graph-skeleton-${String(index)}-${String(row)}`}
                    className={`bg-background-subtle animate-pulse rounded ${cls}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <GraphTwin rows={view.twinRows} />
    </>
  )
}
