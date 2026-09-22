/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Which layers of the system the operator actually declared
// ---------------------------------------------------------------------------

/**
 * One layer of the design system, and whether this operator authored it.
 *
 * ─── WHY THIS IS NOT DERIVABLE FROM THE EXPORTED DOCUMENT ──────────────────
 *
 * The DTCG document publishes the system as it SHIPS — inherited defaults and
 * authored values merged, which is the point of it. Only the shadow ramp
 * carries a per-value `provenance`, so a reader of the export cannot tell "the
 * operator chose these colours" from "the platform's defaults are showing".
 * That distinction is the entire subject of the overview page, and it is
 * answerable only against the `App`, where `declaredNamesOf` already computes
 * it for the token groups and a key's presence answers it for the rest.
 *
 * ─── ONE READ SERVES BOTH THINGS THE OVERVIEW SAYS ─────────────────────────
 *
 * `[internal ref]` prints how MUCH is declared — *2 font families*,
 * *N principles* — and `[internal ref]` prints WHETHER each layer is
 * declared at all, linking the undeclared ones to the config key that would
 * declare them. Those are the same ledger read twice, so they are one endpoint:
 * splitting them would let a count say "2 font families" beside a coverage row
 * reporting fonts undeclared.
 *
 * ─── `count` IS NOT `declared` ─────────────────────────────────────────────
 *
 * They separate on the layers that have an inherited half. `count` is how many
 * entries this layer publishes, defaults included — twelve colours ship whether
 * or not anyone chose them — while `declared` is whether the operator wrote
 * any. A single number would make an untouched palette read as a decision.
 *
 * ─── `label`, AND WHY IT IS PUBLISHED RATHER THAN WRITTEN IN THE PAGE ──────
 *
 * The overview prints the count and its subject as one phrase, from one bound
 * row, and a bound row cannot interleave literal text between its fields. The
 * same reasoning that puts `title` on a component-type summary applies: this is
 * the product's only name for the subject, so publishing it beats inventing a
 * second one in the page. `key` stays the machine handle — it is what
 * `data-design-coverage` carries — and the two never merge.
 */
/**
 * Where a layer's content came from — the closed vocabulary the console renders
 * into `data-design-coverage-state`.
 *
 *  - `declared`     the operator authored something here.
 *  - `inherited`    nobody declared it, and it still publishes values — the
 *                   platform's defaults are showing, which is a legitimate
 *                   resting state rather than a gap to fill.
 *  - `not-declared` nobody declared it and it publishes nothing.
 */
export const designCoverageStateSchema = Schema.Literals([
  'declared',
  'inherited',
  'not-declared',
]).annotate({
  identifier: 'DesignCoverageState',
  description:
    'Whether this layer was authored by the operator, is showing inherited values, or is empty',
})

export const designCoverageRowSchema = Schema.Struct({
  key: Schema.String.annotate({
    description: 'The layer, as a stable slug. The value `data-design-coverage` carries.',
    examples: ['color-scheme', 'writing-rules', 'type-scale'],
  }),
  label: Schema.String.annotate({
    description:
      'What this layer is called in a reader’s words — the product’s only name for it, so the count and its subject can render as one phrase',
    examples: ['font families', 'writing rules'],
  }),
  declared: Schema.Boolean.annotate({
    description:
      'Whether the operator authored anything in this layer. False means what ships here is entirely the platform’s.',
  }),
  count: Schema.Int.annotate({
    description:
      'How many entries this layer publishes, inherited ones included. Zero for a layer with no inherited half that nobody declared.',
  }),
  configPath: Schema.String.annotate({
    description:
      'Where an operator would declare this layer. Published for every row, declared or not — a reader who wants to CHANGE a declared layer needs the same address as one who wants to add it.',
    examples: ['design.typeScale', 'design.logo'],
  }),
  // ─── A TRI-STATE BESIDE THE BOOLEAN, NOT A REPLACEMENT FOR IT ────────────
  //
  // `declared` answers "did the operator author this", which is the question
  // the ledger exists for and is not going anywhere. The overview needs a THIRD
  // answer that the boolean cannot give: a layer nobody declared may still
  // publish inherited values, and another may publish none at all. Collapsing
  // those two into "not declared" tells a reader to go and add twelve colours
  // that already ship.
  //
  // Derived from the two fields it sits beside rather than measured separately,
  // so the three can never disagree: `declared` wins; otherwise a layer that
  // publishes values is `inherited` and one that publishes none is
  // `not-declared`.
  state: designCoverageStateSchema,
  // ─── THE FIELD THAT ANSWERS THE QUESTION `count` ONLY MEASURES ───────────
  //
  // A count is not an answer. "21" beside "documented colour roles" tells a
  // reader how much is there and nothing about WHAT is there, and the overview
  // exists to answer the second question. Five of the six values that page
  // draws have no field to come from without this one: the ramp a palette
  // follows, the address form a charter uses, whether a spacing scale is
  // compact — none of them is a number.
  //
  // COMPUTED, NEVER AUTHORED, and that is what stops it becoming a second copy
  // surface. It is derived per layer by `COVERAGE_LAYERS.summarise` in
  // `design-system-coverage.ts` — the same table that already owns `label` and
  // `configPath` — so the API keeps the ownership of a layer's words that
  // `label` already documents ("the product's only name for it"). There is no
  // config key an operator could use to write one, and `strictKeys` above is
  // what keeps a page from smuggling one in.
  //
  // A WHOLE string rather than a suffix appended to `{count} {label}`: a
  // suffix absorbs four of the six shapes and not the other two, because
  // "0 of 87 types restyled" does not lead with the layer's own count and
  // "9 steps · 2 families" spans two layers.
  summary: Schema.String.annotate({
    description:
      'What this layer actually holds, in a reader’s words — computed from the running config, never authored. The EMPTY string for a layer with nothing to characterise beyond its count, so a row template never prints a placeholder.',
    examples: ['21 roles, neutral ramp', '9 steps · 2 families', '15 writing rules · tu'],
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignCoverageRow',
})

/**
 * The query a coverage read carries.
 *
 * An unknown `key` returns zero rows rather than a 404, for the reason the
 * usage read does: the ledger names the layers, and a second endpoint entitled
 * to disagree about which exist is a bug waiting for a rename.
 */
export const designCoverageQuerySchema = Schema.Struct({
  key: optionalField(
    Schema.String.annotate({
      description:
        'Restrict to one layer. Omit for the whole ledger, which is what the page draws.',
      examples: ['color-scheme'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignCoverageQuery',
})

/** The declaration ledger — the shared envelope, plus how much of it is theirs. */
export const designCoverageResponseSchema = Schema.Struct({
  items: Schema.Array(designCoverageRowSchema).annotate({
    description: 'One row per layer of the system, in the order the overview reads them',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
  // ─── ONE SCALAR PER STATE, BECAUSE A ROWS ENVELOPE CANNOT COUNT ITSELF ────
  //
  // The overview heads the ledger with the shape of the config — `15 keys · 5
  // declared · 4 inherited · 6 not declared` — so a reader gets it before
  // reading a row. A bound rows list renders a template per row and has no way
  // to aggregate, so a headline that is not published beside the rows has to be
  // typed beside them, which is exactly the drift this console exists to
  // remove. All three are counted off the rows this response carries, so a
  // filtered read tallies what it published.
  declared: Schema.Int.annotate({
    description:
      'How many of those layers the operator authored. A scalar so the headline can bind it without indexing the rows.',
  }),
  inherited: Schema.Int.annotate({
    description:
      'How many of those layers nobody authored and the platform answers anyway. Not a gap — a resting state.',
  }),
  notDeclared: Schema.Int.annotate({
    description:
      'How many of those layers nobody authored and nothing supplies. The only figure of the three that counts real gaps.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignCoverageResponse',
})

/** @public */
export type DesignCoverageRow = typeof designCoverageRowSchema.Type
/** @public */
export type DesignCoverageState = typeof designCoverageStateSchema.Type
/** @public */
export type DesignCoverageQuery = typeof designCoverageQuerySchema.Type
/** @public */
export type DesignCoverageResponse = typeof designCoverageResponseSchema.Type
