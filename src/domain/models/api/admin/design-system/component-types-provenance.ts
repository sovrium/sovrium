/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Class provenance
// ---------------------------------------------------------------------------

/**
 * The three layers a resolved class list can come from, in precedence order.
 *
 * ─── THE VOCABULARY IS THE RESOLVER'S, NOT A PARALLEL ONE ─────────────────
 *
 * These are exactly the values `ClassSource` in
 * `presentation/utils/design/resolve-component-classes.ts` emits — `default`,
 * `app`, `floor`. Publishing a prettier synonym (`operator` for `app`, say)
 * would put a second name on one concept and hand every reader the job of
 * mapping between them; the console's whole purpose here is to say WHERE a
 * class came from, so the wire word has to be the code word.
 *
 *  - `default` — Sovrium's own recipe for the type.
 *  - `app`     — the operator's `design.components` block.
 *  - `floor`   — the accessibility floor, applied last and non-overridable.
 *
 * The AUTHOR layer is deliberately absent: provenance answers "which of
 * Sovrium's three layers put this here", and a per-instance `className` is the
 * author's own text, already visible in their config.
 */
export const classProvenanceLayerSchema = Schema.Literals(['default', 'app', 'floor']).annotate({
  description: 'Which of the three resolver layers contributed these classes',
})

/**
 * One layer of a resolved class list.
 *
 * `locked` is the fact the console draws a padlock from, and it is a property
 * of the LAYER rather than of the classes: the floor is applied after the
 * operator's block and cannot be overridden from config at all, so a reader
 * who wants a different focus treatment needs to know that no amount of
 * `design.components` will get them one. `reason` and `adr` carry the WHY and
 * the citation, and are present only where there is one to give — an
 * unlocked layer needs no justification.
 */
export const classProvenanceEntrySchema = Schema.Struct({
  layer: classProvenanceLayerSchema,
  classes: Schema.String.annotate({
    description:
      'The classes this layer contributed, verbatim. Never empty — a layer that contributes nothing is omitted.',
  }),
  locked: Schema.Boolean.annotate({
    description: 'Whether config can override this layer. True for the floor, false otherwise.',
  }),
  reason: optionalField(
    Schema.String.annotate({
      description: 'Why this layer is locked, in the words a reader needs to stop trying',
    })
  ),
  adr: optionalField(
    Schema.String.annotate({
      description: 'The decision this layer is anchored at, when it has one',
      examples: ['ADR-024'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ClassProvenanceEntry',
})

/** @public */
export type ClassProvenanceLayer = typeof classProvenanceLayerSchema.Type
/** @public */
export type ClassProvenanceEntry = typeof classProvenanceEntrySchema.Type
