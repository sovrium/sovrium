/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '@/domain/models/api/combinators/schema-defaults'

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

/**
 * The query a provenance read carries.
 *
 * `part` defaults to `root` because every engine type has one and none of them
 * has any other part universally — asking for provenance without naming a part
 * is asking about the element itself, which is what `root` means.
 */
export const provenanceQuerySchema = Schema.Struct({
  type: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'The engine component type to resolve',
      examples: ['button'],
    })
  ),
  part: Schema.String.pipe(
    withDefault('root'),
    Schema.annotate({
      description: 'Which part of the component to resolve. Defaults to the element itself.',
      examples: ['root', 'label'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ProvenanceQuery',
})

/**
 * Why a class is — or is not — on one part of one engine component.
 *
 * `classes` is the merged, de-conflicted result the renderer actually applies;
 * `chain` is the same resolution reported layer by layer. Both are published
 * because neither answers the other's question: the merged string cannot say
 * where a class came from, and the chain cannot say which of two conflicting
 * declarations survived the merge.
 *
 * A layer contributing nothing is OMITTED from the chain rather than reported
 * as an empty string, so the chain's length is itself readable: one entry means
 * the recipe is untouched, three means the operator styled a type that carries
 * a floor.
 */
export const provenanceResponseSchema = Schema.Struct({
  type: Schema.String.annotate({ description: 'The engine component type that was resolved' }),
  part: Schema.String.annotate({ description: 'The part that was resolved' }),
  classes: Schema.String.annotate({
    description: 'The merged, de-conflicted class list the renderer applies to this part',
  }),
  chain: Schema.Array(classProvenanceEntrySchema).annotate({
    description: 'One entry per CONTRIBUTING layer, in precedence order. Empty layers are omitted.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ProvenanceResponse',
})

/** @public */
export type ClassProvenanceLayer = typeof classProvenanceLayerSchema.Type
/** @public */
export type ClassProvenanceEntry = typeof classProvenanceEntrySchema.Type
/** @public */
export type ProvenanceQuery = typeof provenanceQuerySchema.Type
/** @public */
export type ProvenanceResponse = typeof provenanceResponseSchema.Type
