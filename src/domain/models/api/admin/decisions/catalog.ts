/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/decisions` — the operator's read of the
 * architecture decision records an app declares beside the config they decided.
 *
 * Source story: [internal ref]
 *
 * ─── AUTHORISATION ──────────────────────────────────────────────────────────
 *
 * [internal ref] **amendment A6**. Same invariant as A1's two config-introspection
 * reads: reading the running configuration is observability, mutating it is
 * authoring. There is no request schema in this module because there is nothing
 * to write to — no edit affordance, no write endpoint, no draft, no history.
 *
 * ─── WHY THE COUNTS ARE FLAT ────────────────────────────────────────────────
 *
 * `total`, `accepted`, `proposed` and `superseded` are SIBLINGS of `decisions`
 * rather than members of a `totals` object, and that is a rendering constraint
 * rather than a style. A console `kpi` binds a flat scalar and `$record.`
 * addresses a flat key, so `$record.accepted` resolves where
 * `$record.totals.accepted` would print the literal `[object Object].accepted`
 * — a defect that leaves the status at 200 and that no status check catches.
 *
 * ─── WHY THE ORDER IS THE DECLARED ORDER ────────────────────────────────────
 *
 * The endpoint returns the register as the config states it. Ordering is a
 * reading choice and belongs to the surface that makes it; sorting here would
 * make the endpoint's answer depend on a decision the console has not taken yet,
 * and there is no way for a reader to recover the file's own order afterwards.
 *
 * @see src/domain/models/app/decisions — the `DecisionsSchema` this reflects
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * One decision, on the wire.
 *
 * Shaped explicitly rather than re-exporting the config schema: a response is a
 * contract with a client, and a config schema that gains a field would
 * otherwise widen the published API by accident (S4 — never return raw rows).
 * The two are kept deliberately identical today, and their agreement is a
 * decision each future field has to make again.
 */
export const decisionRecordSchema = Schema.Struct({
  /** Register identifier, unique within the register */
  id: Schema.String,
  /** One-line summary of what was decided */
  title: Schema.String,
  /** Whether the decision stands, is proposed, or has been superseded */
  status: Schema.Literals(['accepted', 'proposed', 'superseded']),
  /** The day the decision was taken, ISO-8601 calendar day */
  date: Schema.String,
  /** Who took it — one entry per person, never joined */
  deciders: Schema.Array(Schema.String),
  /** What it was about, verbatim as authored. Never resolved against the config. */
  touches: Schema.Array(Schema.String),
  /** The situation that forced a choice */
  context: Schema.String,
  /** What was chosen */
  decision: Schema.String,
  /** What follows from it */
  consequences: Schema.String,
  /** Id of the decision this one replaces */
  supersedes: optionalField(Schema.String),
  /** Id of the decision that replaced this one */
  supersededBy: optionalField(Schema.String),
}).annotate({
  identifier: 'AdminDecisionRecord',
  title: 'Decision Record',
  description: 'One architecture decision record as declared in app.decisions',
})

/** @public */
export type AdminDecisionRecord = typeof decisionRecordSchema.Type

/**
 * The register plus its four counts, flat.
 *
 * An app declaring no register answers 200 with an empty list and four zeroes —
 * never 404. An operator who declared no decisions is not an error case, the
 * console's empty state is drawn from this body, and a 404-when-absent is
 * indistinguishable from a route that was never mounted.
 */
export const decisionsCatalogResponseSchema = Schema.Struct({
  /** Every declared record, in the order the config states them */
  decisions: Schema.Array(decisionRecordSchema),
  /** How many records the register holds */
  total: Schema.Finite,
  /** How many of them stand */
  accepted: Schema.Finite,
  /** How many are still being proposed */
  proposed: Schema.Finite,
  /** How many have been replaced */
  superseded: Schema.Finite,
}).annotate({
  identifier: 'AdminDecisionsCatalogResponse',
  title: 'Decisions Catalog Response',
  description:
    'The architecture decision records an app declares, in declared order, with flat counts per status',
})

/** @public */
export type AdminDecisionsCatalogResponse = typeof decisionsCatalogResponseSchema.Type
