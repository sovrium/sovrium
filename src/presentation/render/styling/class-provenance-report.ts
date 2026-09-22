/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Why a class is — or is not — on one part of one engine component, in the
 * shape both readers of that question consume.
 *
 * There are exactly two, and they must not answer differently:
 *
 *  - `GET /api/admin/design-system/provenance`, which a console page binds; and
 *  - the `specimen` component's per-part badges, rendered server-side beside
 *    the drawn component.
 *
 * A second copy of this composition would let the badge and the endpoint
 * disagree about the same element on the same page, which is worse than either
 * being absent. It lives in `presentation/utils/` because that is the one layer
 * both an API route and an SSR component may import — the resolver it wraps
 * (`resolve-component-classes.ts`) is already here for the same reason.
 *
 * ─── THE VOCABULARY IS THE RESOLVER'S ──────────────────────────────────────
 *
 * `default` / `app` / `floor` are `ClassSource`'s own values, republished
 * unchanged. The wire contract (`domain/models/api/admin/design-system/
 * component-types.ts`) says so explicitly: the console's whole purpose here is
 * to say WHERE a class came from, so the wire word has to be the code word.
 *
 * ─── ONLY THE FLOOR IS LOCKED, AND IT SAYS WHY ─────────────────────────────
 *
 * `locked` is a property of the LAYER, not of the classes: the floor is applied
 * AFTER the operator's block and cannot be overridden from config at all, so a
 * reader who wants a different focus treatment needs to know that no amount of
 * `design.components` will get them one. The reason is stated in the words that
 * let them stop trying, and the ADR is cited so the decision is findable.
 */

import { recipeClassesFor } from '../../design/component-recipe-defaults'
import {
  resolveClassProvenance,
  resolveComponentClasses,
} from '../../design/resolve-component-classes'
import type { ClassProvenanceEntry } from '@/domain/models/api/admin/design-system/component-types'
import type { Design } from '@/domain/models/app/design'

/**
 * Why the accessibility floor cannot be overridden.
 *
 * Written for the operator who has just tried and failed, not for the reviewer:
 * it names what the layer protects and why config is the wrong tool, so the
 * next move is "leave it" rather than "try a stronger selector".
 */
const FLOOR_LOCK_REASON =
  'Applied after your `design.components` block, so no class list can remove it: an element that loses its keyboard-focus affordance loses every keyboard user with it.'

/** The decision the floor is anchored at. */
const FLOOR_LOCK_ADR = 'ADR-024'

/** What a provenance read is asked about. */
export interface ClassProvenanceInput {
  /** The app's `design` key, if any. */
  readonly design?: Design
  /** The engine component type being resolved. */
  readonly type: string
  /** Which part of it. Defaults to the element itself. */
  readonly part?: string
  /** The variant this instance renders in, when the type has one. */
  readonly variant?: string
}

/** The merged class list plus the same resolution, layer by layer. */
export interface ClassProvenanceReport {
  /** The part that was resolved — echoed so a defaulted `part` is visible. */
  readonly part: string
  /** The merged, de-conflicted list the renderer applies to this part. */
  readonly classes: string
  /** One entry per CONTRIBUTING layer, in precedence order. */
  readonly chain: readonly ClassProvenanceEntry[]
}

/**
 * Resolve one part's class list and report both halves of the answer.
 *
 * Both are published because neither answers the other's question: the merged
 * string cannot say where a class came from, and the chain cannot say which of
 * two conflicting declarations survived the merge.
 *
 * A layer contributing nothing is OMITTED rather than reported empty, so the
 * chain's LENGTH is itself readable — one entry means the recipe is untouched,
 * three means the operator styled a type that carries a floor.
 *
 * @param input - The design key, the engine type, and the part.
 * @returns The part, the merged list, and the contributing layers in order.
 */
export const buildClassProvenance = (input: ClassProvenanceInput): ClassProvenanceReport => {
  const part = input.part ?? 'root'
  const defaults = recipeClassesFor(input.type, part)
  const resolverInput = {
    ...(input.design === undefined ? {} : { design: input.design }),
    type: input.type,
    part,
    ...(input.variant === undefined ? {} : { variant: input.variant }),
    defaults,
  }

  const chain = resolveClassProvenance(resolverInput).map((entry): ClassProvenanceEntry =>
    entry.source === 'floor'
      ? {
          layer: 'floor',
          classes: entry.classes,
          locked: true,
          reason: FLOOR_LOCK_REASON,
          adr: FLOOR_LOCK_ADR,
        }
      : { layer: entry.source, classes: entry.classes, locked: false }
  )

  return { part, classes: resolveComponentClasses(resolverInput), chain }
}
