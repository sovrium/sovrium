/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lift an `empty-state`'s copy fields to the element props its renderer reads.
 *
 * `emptyTitle` / `emptyDescription` are declared TOP-LEVEL on the type, beside
 * `emptyIcon` — and `display-components.tsx` reads them off `elementProps`,
 * which is built from the component's `props` bag alone. With no entry in
 * `TYPE_BUILDERS` nothing carried them across, so an author who wrote the
 * fields where the schema declares them got an empty dashed box and had to
 * duplicate them into `props` to see anything.
 *
 * ─── WHY EACH KEY IS SPREAD CONDITIONALLY ──────────────────────────────────
 *
 * Every other builder lists its fields unconditionally (`label:
 * component.label`), and that is safe for them because their fields have no
 * `props` twin. These two do. `baseElementPropsWithType` already spreads
 * `component.props`, so an unconditional `emptyTitle: component.emptyTitle`
 * would overwrite a `props`-spelled title with `undefined` — fixing the
 * declared spelling by breaking the one that works today. Spreading only what
 * the component CARRIES lifts the field without shadowing its twin, and lets
 * the top-level field win when an author writes both.
 *
 * ─── AND WHY `emptyIcon` IS NOT HERE ───────────────────────────────────────
 *
 * The schema declares it and no renderer in `src/` reads it — the empty-state
 * module draws a title, a description and its children, never an illustration.
 * Forwarding it would make an inert field look wired, which is the same reason
 * `timezone` is absent from `EDIT_META_KEYS`. It is a one-line addition here on
 * the day the renderer draws one.
 *
 * Its own module because `type-specific-props-builder.ts` sits at its 400-line
 * cap, and the reasoning above is longer than the three lines it guards.
 *
 * @see ../registry/display-components.tsx — the renderer these props reach
 */

import type { ComponentOfType } from '@/domain/models/app/pages/components'

/** The slice of the builder args this entry reads. */
type EmptyStateBuilderArgs = {
  readonly baseElementPropsWithType: Record<string, unknown>
  readonly component: ComponentOfType<'empty-state'>
}

export function buildEmptyStateElementProps({
  baseElementPropsWithType,
  component,
}: EmptyStateBuilderArgs): Record<string, unknown> {
  return {
    ...baseElementPropsWithType,
    ...(component.emptyTitle === undefined ? {} : { emptyTitle: component.emptyTitle }),
    ...(component.emptyDescription === undefined
      ? {}
      : { emptyDescription: component.emptyDescription }),
  }
}
