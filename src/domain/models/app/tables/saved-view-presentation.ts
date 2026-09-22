/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { columnWidthsSchema, rowDensitySchema } from '@/domain/models/api/tables/user-preferences'
import { savedViewTypeSchema } from '@/domain/models/api/tables/user-views'
import type { Schema } from 'effect'

/**
 * Normalise the three PRESENTATION keys of a stored saved view on the way OUT
 *.
 *
 * The keys live in a JSONB `config` blob that the CREATE path copies straight
 * out of the request body with no schema between it and the column, so a value
 * no build of this app can render is writable today — and a schema that later
 * drops a view type it used to offer strands one retroactively. Serving such a
 * blob raw hands the client something it cannot draw; decoding it against a
 * TIGHT response schema instead would fail the whole LIST request, taking
 * every OTHER view the user owns down with one bad row. Normalising here is
 * what makes that tightening safe, which is why the two land together.
 *
 * Three rules, and the differences between them are not arbitrary:
 *
 *   - ABSENT stays absent. A view that expressed no opinion is not a view with
 *     an unreadable opinion, and the two already mean different things
 *     downstream. Inventing a value here would silently convert one into the
 *     other.
 *   - An unreadable `viewType` becomes `grid`. The client must render
 *     SOMETHING, and `grid` is already the documented restore default for a
 *     view carrying no view type at all — never "the first entry in `views`",
 *     which would repoint every legacy view the day an author reorders tabs.
 *   - An unreadable `rowDensity` or `columnWidths` is DROPPED rather than
 *     replaced. Absence is itself a meaningful value for these two: it
 * inherits the user's own table preferences, which
 *     is both the documented behaviour and the only outcome that does not
 *     OVERRIDE a preference the stored view never actually expressed.
 *     Substituting a literal default would, for instance, force `normal` onto
 *     a user who asked for `compact` everywhere.
 *
 * The readability test is `decodeSafe` against the very schemas the response
 * struct declares, rather than a hand-written literal list. That is the point:
 * a parallel list can drift from the union it mirrors, and the first symptom
 * of that drift is the 500 this function exists to prevent.
 */

/** A saved-view row as it leaves the repository — presentation keys untyped. */
interface SavedViewPresentationKeys {
  readonly viewType?: unknown
  readonly rowDensity?: unknown
  readonly columnWidths?: unknown
}

/** The value served for a stored `viewType` this build cannot render. */
export const SAVED_VIEW_TYPE_FALLBACK = 'grid'

/** Does `value` decode against `schema`? The readability test for each key below. */
const isReadable = (schema: Schema.Top, value: unknown): boolean =>
  decodeSafe(schema)(value).success

export const normalizeSavedViewPresentation = <T extends SavedViewPresentationKeys>(view: T): T => {
  const { viewType, rowDensity, columnWidths, ...rest } = view
  const normalized = {
    ...rest,
    // An explicit `undefined` is as absent as a missing key to every consumer
    // — and to `JSON.stringify`, which drops both — so neither acquires a
    // fallback here.
    ...(viewType === undefined
      ? {}
      : {
          viewType: isReadable(savedViewTypeSchema, viewType) ? viewType : SAVED_VIEW_TYPE_FALLBACK,
        }),
    ...(rowDensity !== undefined && isReadable(rowDensitySchema, rowDensity) ? { rowDensity } : {}),
    ...(columnWidths !== undefined && isReadable(columnWidthsSchema, columnWidths)
      ? { columnWidths }
      : {}),
  }
  // The spread-and-reassemble above is opaque to the compiler: it cannot see
  // that the three optional keys are put back with their declared types. The
  // assertion restores the caller's row type and widens nothing — every other
  // key travels untouched in `rest`.
  return normalized as T
}
