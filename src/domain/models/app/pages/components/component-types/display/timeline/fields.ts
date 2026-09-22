/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../../modules/content'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { interactionFields } from '../../modules/interaction'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'

/**
 * Time-axis granularity for a record-bound timeline.
 *
 * Read only when `dataSource` is present — a structural timeline has no axis to
 * scale. It came here with the `data-timeline` merge and kept its name, which
 * every importer already used.
 */
export const TimelineZoomSchema = Schema.Literals(['day', 'week', 'month', 'quarter', 'year']).pipe(
  Schema.annotate({
    title: 'Timeline Zoom',
    description: 'Time-axis granularity for a record-bound timeline',
  })
)

/** @public */
export type TimelineZoom = Schema.Schema.Type<typeof TimelineZoomSchema>

/**
 * `timeline` — a vertical list of events, in one of two shapes.
 *
 * ## Two shapes, one type
 *
 * It was two types. `timeline` drew a structural list from authored children;
 * `data-timeline` drew a Gantt from a record binding. Both are "events on a
 * time axis", both are the thing an author reaches for when they think
 * "timeline", and choosing between them meant knowing which mechanism you
 * wanted before you could ask for the shape.
 *
 * The `dataSource` decides: present, and the timeline is record-bound and
 * mounts the Gantt island; absent, and it renders its children as a rail with
 * markers. There is no mode flag, because the binding IS the mode — a flag
 * would let the two disagree.
 *
 * ## The one refusal
 *
 * `children` and `dataSource` are MUTUALLY EXCLUSIVE, and that is enforced by
 * a validator pass rather than by the schema: `buildComponentUnion` has no
 * per-branch refinement hook, so an XOR between an injected field (`children`)
 * and a declared one is not expressible here. See `component-xor-rules.ts`.
 *
 * A timeline carrying both is not a merge artefact to tolerate — it is an
 * author who believes their children will render, and they will not: the
 * record binding wins and the children are silently dropped.
 */
export const TimelineTypeLiteral = Schema.Literal('timeline')

export const timelineFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Record binding. Its PRESENCE is what turns the structural list into the
   * Gantt island — see the header, and the XOR rule the validator enforces.
   */
  ...dataBoundFields,
} as const
