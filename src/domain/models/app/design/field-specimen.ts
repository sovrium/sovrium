/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The FIELD SPECIMEN contract — a render-time-only component descriptor.
 *
 * ─── WHY THIS TYPE EXISTS AT ALL ────────────────────────────────────────────
 *
 * A field type is a table COLUMN type, not a page component, so it has no
 * renderer of its own. Its visual surface is a control that some OTHER surface
 * draws for it, and `src/presentation/utils/field-type-behavior.ts` names three
 * such surfaces which *"legitimately differ"*. The design-system catalog
 * therefore cannot show "the" rendering of a field type; it shows ONE named
 * surface's control and says which.
 *
 * The catalog that shows it is composed OUTSIDE the domain, and drawing that
 * control requires presentation-layer rendering code. Rather than have the
 * composing layer reach across the boundary for it, that layer emits THIS
 * DESCRIPTOR — inert data naming what to draw — and a presentation-layer
 * resolver expands it at render time
 * (`src/presentation/rendering/field-specimen-resolver.ts`). Same relationship
 * every other component already has with its renderer; only the vocabulary is
 * private.
 *
 * ─── WHY IT IS NOT A PAGE-COMPONENT SCHEMA ─────────────────────────────────
 *
 * Both sides of the seam must name the same shape or they drift silently, so
 * the shape is declared once — here, in the `design` slug the catalogue that
 * composes it belongs to — and both layers import it. (It was `domain/types/`
 * until the layout programme dissolved that directory; `SessionInfo`, which
 * crosses the same two layers, landed in `auth/` in the same wave.)
 *
 * It is deliberately NOT under `domain/models/app/pages/components/`, beside
 * the `field-specimen` COMPONENT schema that shares its name: this is not a
 * config option. Putting it there would publish an admin-console-internal
 * vocabulary into `AppSchema`, the generated JSON Schema, and the documented
 * config surface — a public contract for something no operator may ever write.
 *
 * Sitting under `domain/models/app/design/` does not publish it either. A file
 * becomes a config option when the slug's `index.ts` re-exports it into the
 * manifest, and this one is not re-exported; the Public JSON Schema snapshot is
 * the standing proof, since it did not move when this file did.
 *
 * The corollary is that a descriptor is UNDECODABLE: `AppSchema` rejects it. It
 * is only ever synthesized AFTER decode, into a surface app that is handed
 * straight to `renderPage` (see `mounted-app-routes.ts`, which never
 * re-decodes). A schema author can no more supply one than they can supply
 * `customHTML.trustedContent`, and for exactly the same reason.
 *
 * ─── THE ANCHOR RULE, WHICH IS LOAD-BEARING ────────────────────────────────
 *
 * `name` is not decoration. A specimen is verified by comparing its control
 * against the same field type drawn by a REAL crud-form, and the comparison is
 * anchored on the `[name]` element — because for `rich-text` the first
 * DESCENDANT control is a `div[role=status]` placeholder (or, post-hydration, a
 * toolbar button), not the hidden mirror input the oracle side reads. Anchoring
 * on a wrapper compares two different elements as if they were one.
 *
 * So the caller CHOOSES `name`, the resolver reports back the anchor it
 * actually found in the emitted markup (`data-field-specimen-anchor`), and no
 * control-like attribute is ever placed on the specimen wrapper.
 */

/** The component-type tag a descriptor carries. Not an `AppSchema` value. */
export const FIELD_SPECIMEN_COMPONENT_TYPE = '_fieldSpecimen'

/**
 * Which of the three field-drawing surfaces a specimen documents.
 *
 * A single member today, and spelled as a union anyway: the whole reason the
 * label exists is that there are three surfaces and they differ, so the type
 * that carries the label must be able to say so. The other two — the crud-form
 * SSR skeleton and the data-table's inline cell editor — are addable here
 * without touching the descriptor's shape.
 */
export type FieldSpecimenSurface = 'crud-form-island'

/**
 * How faithfully the emitted specimen represents what a user actually sees.
 *
 * Measured from the produced markup, never from a hand-maintained table (see
 * `field-specimen-renderer.tsx`), so a newly-deferred control cannot silently
 * keep claiming exactness.
 *
 * - `exact`    — the control is fully server-renderable; the specimen's markup
 *                is the markup the real form shows.
 * - `deferred` — the real control is code-split and loads on mount
 *                (`useDeferredComponent`). A specimen is a static string that
 *                never mounts, so it shows the PRE-MOUNT placeholder
 *                permanently. `rich-text` and `code` are the two today.
 */
export type FieldSpecimenFidelity = 'exact' | 'deferred'

/** A field-type specimen to draw, as inert data. */
export interface FieldSpecimenDescriptor {
  readonly type: typeof FIELD_SPECIMEN_COMPONENT_TYPE
  /** The catalogued field type, e.g. `'long-text'`. Free-form: the renderer degrades unknown types. */
  readonly fieldType: string
  /** The `name` the drawn control carries — the comparison anchor. See the anchor rule above. */
  readonly name: string
  /** Which surface's control this documents. Rendered as a label, never inferred. */
  readonly surface: FieldSpecimenSurface
  /** Visible label; falls back to `name` in the drawn control. */
  readonly displayLabel?: string
  /** Option values for choice-shaped types. Absent ones render an empty `<select>`. */
  readonly options?: readonly string[]
  readonly placeholder?: string
  readonly description?: string
  /** Illustrative value. Defaults to empty — a specimen documents the control, not a record. */
  readonly value?: string
  /**
   * Suppress the per-specimen surface caption.
   *
   * ─── WHY A COMPOSED FORM NEEDS THIS AND A CATALOG DOES NOT ────────────────
   *
   * The caption is load-bearing on a CATALOG page: one control per heading,
   * where omitting it would let the page assert that this is THE rendering of
   * the field type — which the existence of three differing surfaces disproves.
   *
   * The UI kit's composed form draws every field type at once, and the surface
   * they all document is stated ONCE above the form. Repeating the same two
   * sentences under forty-nine controls would not add a fact; it would bury the
   * form under nine hundred words of the same word.
   *
   * So the caption moves from per-control to per-form, and this flag is how the
   * descriptor says which of the two shapes it is in. It never suppresses the
   * DEFERRED note's underlying fact — a deferred control still reports
   * `data-field-specimen-fidelity="deferred"` on the wrapper, so the honesty is
   * in the markup either way.
   */
  readonly compact?: boolean
}

/** Build a descriptor. The `type` tag is stamped here so no call site spells it. */
export function fieldSpecimen(
  spec: Omit<FieldSpecimenDescriptor, 'type'>
): FieldSpecimenDescriptor {
  return { ...spec, type: FIELD_SPECIMEN_COMPONENT_TYPE }
}

/**
 * True for a field-specimen descriptor.
 *
 * Checks `name` as well as the tag: an anchorless specimen is not comparable
 * against anything, so a descriptor missing one is not a descriptor. It falls
 * through the resolver unchanged and renders as the dispatcher's bare `<div>` —
 * visibly empty, which is the correct outcome for a malformed specimen.
 */
export function isFieldSpecimenDescriptor(value: unknown): value is FieldSpecimenDescriptor {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly type?: unknown; readonly name?: unknown }
  return (
    candidate.type === FIELD_SPECIMEN_COMPONENT_TYPE &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0
  )
}
