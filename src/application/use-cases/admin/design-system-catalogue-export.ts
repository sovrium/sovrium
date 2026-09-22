/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE COMPONENT CATALOGUE, as the design-system EXPORT publishes it.
 *
 * ─── WHY THE DOCUMENT CARRIES IT AT ALL ────────────────────────────────────
 *
 * Every other group in that document describes what the app looks like. This
 * one describes what an agent may WRITE — which types exist, at what spelling,
 * with what variant axis, and which of them will silently render nothing. The
 * last is the part a consumer cannot get anywhere else: `tab-panel` is accepted
 * by AppSchema with no renderer behind it, so an agent building from tokens
 * alone writes it, gets a bare `div`, and is told nothing.
 *
 * ─── ONE RESOLUTION, TWO SURFACES ──────────────────────────────────────────
 *
 * The refusal sentences come from {@link specimenFor} — the same lookup the
 * console's own cards resolve through — rather than from a second read of the
 * specimen tables. A document and a console page that disagreed about which
 * types are drawn, or about why one is not, would be the exact drift this
 * catalogue exists to remove for the agent reading it.
 *
 * ─── WHY IT IS HERE AND NOT UNDER `dashboard-surfaces/` ────────────────────
 *
 * It sat beside the console builders because a builder read the same lookup.
 * Every one of those is gone, and this projection was never about a page: its
 * consumer is the export document. A page BUILDER is not a place a document
 * generator can import from, which is the rule that moved it up one level.
 */

import { specimensOf } from '@/domain/models/app/design/catalog-specimens'
import { introspectType } from '@/domain/models/app/design/type-introspection'
import {
  CATALOG_COMPONENT_CATEGORIES,
  EXCLUDED_TYPES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import type { SovriumDesignExtension } from '@/domain/models/api/admin/design-system'
import type { CatalogSpecimen } from '@/domain/models/app/design/catalog-specimens'
import type { CatalogComponentCategory } from '@/domain/models/app/pages/components/component-types/catalog'

/**
 * One published entry, derived from the extension's own schema rather than
 * restated here — so a field added to the contract is a type error in this
 * projection rather than a key the document quietly stops carrying.
 */
type CatalogueEntry = NonNullable<SovriumDesignExtension['catalogue']>[number]

/**
 * The refusal a type carries when the registry publishes it and no specimen
 * table names it.
 *
 * The type is interpolated so the sentence is distinct per type BY
 * CONSTRUCTION. Two gaps sharing one sentence would trip
 * `[internal ref]` — correctly: a reader meeting the same line on two
 * entries learns that something is missing and not which.
 */
const uncatalogued = (type: string): CatalogSpecimen => ({
  type,
  refusal: {
    state: 'not-previewable',
    note: `${type} ships in this build and has no specimen in the catalogue yet, so there is nothing here to draw it from.`,
  },
})

/** The catalogue's specimen for one type, or a named gap. */
const specimenFor = (type: string, category: CatalogComponentCategory): CatalogSpecimen =>
  specimensOf(category).find((specimen) => specimen.type === type) ?? uncatalogued(type)

/**
 * The sentence an entry publishes when the type is refused to its consumer.
 *
 * ─── TWO REFUSALS, AND THE DOCUMENT OWES BOTH ──────────────────────────────
 *
 * `EXCLUDED_TYPES` is the DECLARATION-time exclusion — the types an author may
 * not point a `specimen` at — while a catalogue {@link CatalogSpecimen} refusal
 * says only that nothing is DRAWN. They named the same types for as long as one
 * type could have one answer, and `form` is where they came apart: its bound
 * modes emit a live submit control and stay undeclarable, while its bare mode
 * carries no action and no submit path, so the catalogue draws it and holds no
 * refusal for it.
 *
 * Sourcing this field from the refusal alone therefore stopped telling a
 * consumer that `form` is excluded at all, the moment the catalogue learnt to
 * draw it — silently, because a drawn type legitimately carries no sentence.
 * The listing endpoint never lost it (`listComponentTypes` reads
 * `EXCLUDED_TYPES` ungated), so the document and the console came to disagree
 * about the one fact this catalogue exists to carry: what an agent may write.
 *
 * The declaration-time exclusion wins where both exist. It is the stronger
 * claim — a type nobody may declare is refused whether or not something can be
 * drawn of it — and it is the one an agent building config acts on.
 */
const exclusionOf = (type: string, refusal: CatalogSpecimen['refusal']): string | undefined =>
  EXCLUDED_TYPES[type] ?? refusal?.note

/**
 * Every catalogued type, with its category, its variant axis and its refusal.
 *
 * `variants` is ABSENT rather than empty for the types that declare no axis: an
 * empty array reads as "a variant axis with nothing in it", which is a different
 * and false claim. `excludedReason` is absent for a type nothing refuses, for
 * the mirror reason — a sentence on every entry would make the refusals
 * invisible.
 */
export const projectCatalogue = (): readonly CatalogueEntry[] =>
  CATALOG_COMPONENT_CATEGORIES.flatMap((category) =>
    catalogedTypesOf(category).map((type) => {
      const { refusal } = specimenFor(type, category)
      const variants = introspectType(type).variant?.members ?? []
      const excludedReason = exclusionOf(type, refusal)
      return {
        type,
        category,
        ...(variants.length === 0 ? {} : { variants: [...variants] }),
        ...(excludedReason === undefined ? {} : { excludedReason }),
      }
    })
  )
