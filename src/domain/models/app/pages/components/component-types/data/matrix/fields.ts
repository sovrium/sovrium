/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { MatrixAxisSchema, MatrixCellSchema, MatrixDataSourceSchema } from './schema'

/**
 * `matrix` — a rows x columns grid whose cells are GLYPHS rather than text.
 *
 * ─── THE TWO EXPORT NAMES ARE LOAD-BEARING ─────────────────────────────────
 *
 * `MatrixTypeLiteral` and `matrixFields`, exactly. The catalogue derives a
 * category's membership by pulling every `*TypeLiteral` export from the
 * category barrel and reading its literal, and `introspectType` pairs that
 * literal with a bag named `<base>Fields` by convention with no fallback
 * behind it. A misnamed literal makes the type vanish from the design-system
 * console and drops the `data` category census; a misnamed bag renders a page
 * of empty cells rather than throwing. Neither failure is loud.
 *
 * ─── IT RENDERS SERVER-SIDE. IT IS NOT AN ISLAND ───────────────────────────
 *
 * A matrix is a static drawing of a read: nothing on it is dragged, typed into
 * or re-fetched. So the grid is produced by the SSR renderer, which fetches
 * the bound endpoint with the caller's own credentials on the render path —
 * the pattern `systemRowsFetcher` / `systemRecordFetcher` already establish —
 * and ships HTML. Consequences, all deliberate:
 *
 *  - no `React.lazy` entry, no `ISLANDS` registration, no
 *    `ISLAND_MOUNT_CEILINGS` baseline, no visx, and not one byte added to the
 *    client bundle (eco R2);
 *  - the grid and its accessible twin are in the FIRST response, so a reader
 *    with no scripting — and a crawler — get the facts rather than a skeleton;
 *  - a degraded read is a render-time fact rather than a client-side state,
 *    which is what lets `degraded` be reported honestly instead of arriving
 *    after the document as an empty grid.
 *
 * @see ./schema.ts — the sub-schemas, and the boundary between platform and endpoint vocabulary
 */
export const MatrixTypeLiteral = Schema.Literal('matrix')

export const matrixFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  // Override the shared (rows-list) `dataSource` with the matrix-specific
  // GRAPH binding. Must come AFTER `...dataBoundFields` to replace its
  // `dataSource`, exactly as `chart` and `kpi` do — and for the same reason:
  // the shape this component consumes is not the shape the shared field
  // describes. See `MatrixSystemSourceSchema` for why there is no DB-table arm.
  dataSource: Schema.optional(MatrixDataSourceSchema),
  /** The grid's vertical axis — which nodes become rows, grouped and ordered */
  rows: Schema.optional(MatrixAxisSchema),
  /** The grid's horizontal axis — the SAME shape as `rows`, deliberately */
  columns: Schema.optional(MatrixAxisSchema),
  /** What fills each intersection, and how it is drawn */
  cell: Schema.optional(MatrixCellSchema),
  /**
   * The grid's accessible name — and the switch on HOW the grid is announced.
   *
   * A grid of glyphs is not accessible by itself, so the contract has two
   * states and no third:
   *
   *  - **`label` present** — the grid is `role="img"` carrying it as its
   *    `aria-label`, so a screen-reader user meets one named figure instead of
   *    a table of marks with no text in it. The accessible twin beneath still
   *    renders and still carries every fact.
   *  - **`label` absent** — the grid is `aria-hidden`, and the twin carries the
   *    facts ALONE. An unnamed figure announced as a figure is noise; silence
   *    plus a real table is the better reading.
   *
   * The twin is never optional in either state. It is the primary artifact,
   * not a fallback, which is why no key here can switch it off.
   */
  label: Schema.optional(
    Schema.String.annotate({
      description:
        'Accessible name for the grid. Present: the grid is role="img" with this as its aria-label. Absent: the grid is aria-hidden and the accessible twin beneath it carries the facts alone. The twin renders either way.',
      examples: ['Who can do what to what'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * What the grid says when the bound graph resolves no cells.
   *
   * Same spelling as `chart` and `kanban` — one message, shown in place of the
   * grid. It does NOT cover a DEGRADED read: a source that could not be
   * resolved is missing rather than empty, and rendering "nothing to show" over
   * an outage reads calm where the truth is a gap.
   */
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Message displayed when the bound graph resolves no cells. Not used for a DEGRADED read, where a source could not be resolved and the grid is missing its contribution rather than empty.',
      examples: ['No grants declared.'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------

export {
  MatrixAxisSchema,
  MatrixCellFlagSchema,
  MatrixCellSchema,
  MatrixDataSourceSchema,
  MatrixGlyphSchema,
  MatrixSortDirectionSchema,
  MatrixSystemSourceSchema,
  type MatrixAxis,
  type MatrixCell,
  type MatrixCellFlag,
  type MatrixGlyph,
} from './schema'
