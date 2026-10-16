/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The findings half of the `GET /api/admin/organisation/graph` contract: what
 * the map found, and the findings counted by severity.
 *
 * A sibling of `./graph`, which composes these into the response body. Split
 * out by size only — the wire shape, every schema name and every OpenAPI
 * identifier are those of the graph response.
 */

import { Schema } from 'effect'

/**
 * A stable, non-empty identifier — the same contract as the graph's own ids
 * (see `graphId` in `./graph`): a finding's `id`, and each `nodes[].id` it
 * concerns.
 */
const graphId = (description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isMinLength(1)))

/**
 * What kind of structural exposure a finding reports. Closed at three in v1,
 * extensible by a later schema change.
 *
 *  - `public-write`   — a write path reachable without authenticating.
 *  - `open-rung-read` — a resource readable through the open rung.
 *  - `single-bridge`  — exactly one principal joins two otherwise separate parts
 *                       of the graph. Not a vulnerability: a continuity risk,
 *                       which is why its severity is the lowest of the three.
 */
export const organisationFindingKindSchema = Schema.Literals([
  'public-write',
  'open-rung-read',
  'single-bridge',
]).annotate({
  description:
    'The structural exposure reported: `public-write` (a write path reachable without authenticating), `open-rung-read` (a resource readable through the `*` rung), `single-bridge` (exactly one principal joins two otherwise separate parts of the graph — a continuity risk, not a vulnerability).',
})

/**
 * How loudly a finding reads.
 *
 * DERIVED, never judged. The mapping is total and mechanical —
 * `unbounded` blast radius yields `critical`, a bounded exposure yields
 * `warning`, a structural observation yields `notice` — for the same reason the
 * blast radius itself is a count rather than an opinion: an operator who cannot
 * reproduce the ranking cannot trust it. A future `kind` inherits the rule
 * rather than choosing a severity.
 */
export const organisationFindingSeveritySchema = Schema.Literals([
  'critical',
  'warning',
  'notice',
]).annotate({
  description:
    'Derived from the exposure, never judged: `critical` when `blastRadius` is `"unbounded"`, `warning` for a bounded exposure, `notice` for a structural observation such as `single-bridge`. Mechanical so the ranking is reproducible by the operator.',
})

/**
 * How many distinct principals the flagged path exposes — the ordering key of
 * the findings list, descending.
 *
 * A UNION rather than a count beside an `unbounded: boolean`, and the difference
 * is not stylistic. Anonymous exposure is not a larger number, it is the absence
 * of one: nothing counts the people who have not signed up yet. Two fields would
 * make `{ blastRadius: 7, unbounded: true }` representable, and nothing could say
 * what it meant. One field with two spellings makes the illegal state
 * unrepresentable, and encodes the sort rule directly — `"unbounded"` sorts above
 * every finite count, however large.
 */
export const organisationBlastRadiusSchema = Schema.Union([
  Schema.Int.annotate({
    description: 'The number of distinct principals the flagged path exposes.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  Schema.Literal('unbounded').annotate({
    description:
      'The exposure is anonymous, so no principal count exists. Sorts ABOVE every finite count.',
  }),
]).annotate({
  description:
    'Blast radius: the number of distinct principals the flagged path exposes, or the string `"unbounded"` when the exposure is anonymous and therefore uncountable. The findings list is ordered by this value descending, with every `"unbounded"` finding above every finite one. A union rather than a count plus a flag, so `{ blastRadius: 7, unbounded: true }` cannot be expressed.',
})

/**
 * One thing the map found.
 *
 * `message` is a rendered SENTENCE, not parts. The findings list is bound
 * declaratively (`type: 'list'`, `rowsKey: 'findings'`), and a config layer can
 * print a string but cannot format one — so the join, the truncation and the
 * ordering belong on this side of the wire. `subjects` carries the same facts
 * structurally for a consumer that wants to link them; the two are the same
 * information at two resolutions, and the sentence is the one the operator
 * reads.
 */
export const organisationFindingSchema = Schema.Struct({
  id: graphId(
    'Stable identifier for this finding, unique within `findings`. Not a persisted key — findings are derived per request and nothing acknowledges or dismisses them — but a stable row identity for the list that renders them.'
  ),
  kind: organisationFindingKindSchema,
  severity: organisationFindingSeveritySchema,
  blastRadius: organisationBlastRadiusSchema,
  subjects: Schema.Array(
    Schema.String.annotate({
      description: 'One subject NAME.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  )
    .annotate({
      description:
        'The subjects the finding is about, as NAMES only (a table name, a role name, a person’s display name) — never a value, a token or an email (S4). Never empty: a finding naming no subject gives the operator nothing to act on, so an empty list is a producer bug rather than a quieter finding.',
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
  message: Schema.String.annotate({
    description:
      'The finding as ONE rendered sentence, e.g. "The widest write in the app is unauthenticated." Rendered server-side because the consuming list binding can print a string but cannot format one — the join, the truncation and the ordering therefore live here. Names subjects, never values (S4).',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  nodes: Schema.Array(graphId('One `nodes[].id` this finding concerns.'))
    .annotate({
      description:
        'The `nodes[].id`s this finding concerns, so a lens can mark them: the resource node for `public-write` and `open-rung-read` (e.g. `table:invoices`); the person node and the two team nodes it joins for `single-bridge`. On an unfiltered read every entry resolves to a node in the same body. NOT narrowed by `?node=`, like the finding itself: an entry may then name a node the narrowed graph left out.',
    })
    .pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphFinding',
})

/** One severity's count, a non-negative integer. */
const severityCount = (description: string) =>
  Schema.Int.annotate({ description }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))

/**
 * The findings counted by severity. The three counts sum to `findingsCount`;
 * each is zero, never absent, when no finding has that severity, so a reader
 * never has to tell "none" from "not reported".
 */
export const organisationFindingsBySeveritySchema = Schema.Struct({
  critical: severityCount('How many findings are `critical`.'),
  warning: severityCount('How many findings are `warning`.'),
  notice: severityCount('How many findings are `notice`.'),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphFindingsBySeverity',
  description:
    'The findings counted by severity — `critical`, `warning`, `notice` — summing to `findingsCount`. Each count is zero rather than absent when no finding has that severity. NOT narrowed by `?node=`.',
})
