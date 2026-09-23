/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/organisation/graph` — the one read behind the
 * console's Organisation page.
 *
 * The page draws five lenses (Map, Matrix, Reach, Processes, Agents) plus a
 * findings list. They are not five reads: they are five PROJECTIONS of one
 * access graph — `principals -> grant sources -> resources` — plus two side
 * graphs (automations, agents). So the endpoint returns the graph once and the
 * lens stays a client concern.
 *
 * THE ONE QUERY PARAMETER, AND WHY IT IS NOT A SIXTH LENS
 * ------------------------------------------------------
 * `?node=<id>` narrows the graph to one node's reach. It was deliberately
 * absent from the first cut, and the reason it is here now is not that the lens
 * argument was wrong — it still is: the parameter does not choose a projection,
 * it chooses a SUBJECT, and every lens draws the narrowed graph the same way it
 * draws the whole one.
 *
 * It exists because three shipped surfaces cannot work without it, and each one
 * says so in its own file rather than in a plan:
 *
 *  - The `graph` component publishes the selected node's id on the shared-filter
 *    bus, which is a REQUEST-PARAM bus: a subscriber merges the published bag
 *    into its own HTTP request. With no parameter to merge into, the subscriber
 * re-requested this identical body, so `[internal ref]` stays pinned on
 *    an endpoint that ignores what the publisher publishes. That component's own
 *    module names the fix — "an O1 widening of the endpoint (a `?node=`
 *    parameter), not a change to this component".
 *  - The Reach lens's "Structural position" block is per-principal and had
 *    nothing to select with (`src/admin/config/pages/data/organisation-reach.ts`).
 *  - A record-bound drawer binds an endpoint with an id slot and fetches; there
 *    is no `…/graph/:id`, so it would open on a 404.
 *
 * A path read — `GET …/graph/nodes/:id` — would satisfy the drawer and NOT the
 * bus, because the bus merges into a query string and cannot write a path
 * segment. One parameter on the existing route satisfies both, and keeps one
 * route, one response schema, one auth gate and one cost bound where two reads
 * would have had two of each. That is the whole argument for the smaller shape.
 *
 * What it narrows, and what it deliberately does not: it filters `nodes`,
 * `edges` and `exceptions`, which are facts ABOUT the subject. It leaves
 * `findings` and `degraded` whole, because those describe the instance and the
 * read's health rather than the node — a findings list that shrank when an
 * operator clicked a person would be reporting that the exposure went away.
 *
 * WHY THIS BODY MAY NEST, WHERE `attention.ts` MAY NOT
 * ----------------------------------------------------
 * The sibling `GET /api/admin/attention` is deliberately FLAT because its
 * consumer is a declarative page binding `$record.<key>`, and a `$record.` path
 * cannot reach into a nested object. This body's consumer is an island that
 * fetches and renders, so it may nest — and it must, because a graph is not
 * expressible as a flat key set. That is the one structural difference between
 * the two contracts, and it is the whole reason a graph is expressible at all.
 *
 * The findings list is the exception that proves it: it is bound declaratively,
 * which is why {@link organisationFindingSchema} carries `message` as an
 * already-rendered sentence rather than as parts a config layer would have to
 * join.
 *
 * WHY THERE IS NO `since`
 * -----------------------
 * The sibling attention read anchors on `since` — the frozen process boot — and
 * the first sketch of this contract copied that field. It is deliberately absent
 * here, for three reasons that all point the same way:
 *
 *  - **Nothing in this body is windowed.** `since` earns its place on attention
 *    because two of its six cells COUNT EVENTS after it. There is no event count
 *    here: every figure is a fact about the configuration and the current
 *    population, both of which are read now.
 *  - **The config half is not frozen at boot.** The handler resolves the LIVE
 *    app, not the boot one, because `tables`, `pages` and `buckets` are outside
 *    the restart set (`classify-config-change.ts`) and therefore hot-swap under
 *    `--watch` and after a draft publish. A boot-anchored `since` would assert a
 *    provenance the body does not have, on a page whose entire job is to explain
 *    the configuration the server is actually running.
 *  - **The strip that needed the anchor moved.** The pulse strip and the nine
 *    count tiles live on the console's Welcome page (`/`) bound to
 *    `/api/admin/attention`; Organisation (`/organisation`) carries the findings
 *    list and the lenses only. The anchor went with the strip.
 *
 * `generatedAt` remains, because a derived-per-request body needs to say when it
 * was derived, and it pairs with the route's `Cache-Control: no-store`.
 *
 * FINDINGS ARE DERIVED PER REQUEST, NEVER STORED
 * ----------------------------------------------
 * Storing them would mean a write on a read-only console plus
 * per-operator dismissal state — the same reasoning that made attention's anchor
 * the process boot rather than "since you last looked". A finding is not an
 * alert: nothing pages, nothing is acknowledged, nothing persists. Two reads a
 * second apart may legitimately return different findings, because the
 * population they measure changed.
 *
 * S4 — WHAT THIS BODY IS ALLOWED TO CARRY
 * ---------------------------------------
 * An allow-list of scalars, closed enums, and short rendered strings. Every
 * string field is a NAME or a sentence ABOUT names: a table name, a role name, a
 * person's display name. Never a field value, never a token, never a variable's
 * value, never a raw DB row. Every struct here is `strictKeys`, so a producer
 * that grows an extra key fails its own response gate rather than publishing it.
 *
 * `email` is deliberately absent from a `person` node. `GET /api/admin/users`
 * already exposes it to admin-tier callers, so carrying it would widen nothing
 * legally — but the graph needs a display name and nothing more, and the
 * narrower body is the one to ship.
 *
 * No GDPR surface is added (S5): the graph is derived and never stored, so there
 * is nothing to export and nothing to erase that the `user` row does not already
 * own.
 *
 * @see src/domain/models/api/admin/overview/attention.ts (the flat sibling, and why it is flat)
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '@/domain/models/api/combinators/schema-defaults'

/**
 * A stable identifier for a node, an edge or a finding.
 *
 * Opaque to the client: its only contract is that it is non-empty, unique within
 * its own collection, and stable for as long as the thing it names keeps the
 * same identity in the configuration. Edges address nodes BY this id, so the
 * referential invariant — every `from` and every `to` resolves to a node in the
 * same body — is what makes the graph a graph. A schema cannot express a
 * cross-field reference, so that invariant is asserted by the E2E specs rather
 * than here; do not mistake its absence for its unimportance.
 */
const graphId = (description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isMinLength(1)))

/**
 * What a node IS. Closed, and closed on purpose: a lens decides a node's column,
 * its glyph and its accessible name from this one field, so an unrecognised
 * kind is a node that cannot be drawn.
 *
 * Three groups, in the order the Map lays them out left to right:
 *
 *  - **Principals** — `person`, `agent`. Who or what acts.
 *  - **Grant sources** — `role`, `team`, `open`. What an act is authorised BY.
 *    `open` is the open rung: the `*` / `everyone` / `any-session` grant that
 *    authorises without naming anybody, and it is a node rather than a flag so
 *    that "reached through `*`" is a path on the map rather than a footnote.
 *  - **Resources** — `table`, `page`, `form`, `bucket`, `agent-resource`. What
 *    is acted upon. `agent-resource` is an agent seen as a THING that can be
 *    invoked, as distinct from `agent` the principal; the same agent is both,
 *    and collapsing them would draw a self-loop where the truth is a grant.
 *
 * Plus two that belong to the Processes lens rather than the access graph:
 * `automation` (a lane) and `step` (a station in it).
 */
export const organisationNodeKindSchema = Schema.Literals([
  'person',
  'agent',
  'role',
  'team',
  'open',
  'table',
  'page',
  'form',
  'bucket',
  'agent-resource',
  'automation',
  'step',
]).annotate({
  description:
    'What the node is. Principals: `person`, `agent`. Grant sources: `role`, `team`, `open` (the `*` / everyone / any-session rung, modelled as a node so a grant through it is a visible path). Resources: `table`, `page`, `form`, `bucket`, `agent-resource` (an agent seen as an invocable thing, distinct from `agent` the principal). Process graph: `automation` (a lane), `step` (a station in one).',
})

/**
 * Which resource family a resource node belongs to — the Matrix's row grouping.
 *
 * TOTAL over the five resource kinds, deliberately: `form` maps to `forms`
 * rather than being folded into `pages`, so `groupBy: 'family'` never produces
 * an unlabelled bucket. Absent on every non-resource node, which is what makes
 * "has a family" a usable test for "is a resource".
 */
export const organisationNodeFamilySchema = Schema.Literals([
  'tables',
  'pages',
  'forms',
  'buckets',
  'agents',
]).annotate({
  description:
    'The resource family a resource node groups under (the Matrix row grouping). Present on `table` / `page` / `form` / `bucket` / `agent-resource` nodes and on no other kind, so its presence is the test for "this node is a resource".',
})

/**
 * A node's operational state, where it has one.
 *
 * Only `automation` and `agent-resource` nodes carry it today. It drives WEIGHT,
 * never colour: a paused lane is dashed, a disabled one is grey. Kind by shape,
 * state by weight — colour is reserved for the platform's own role tokens.
 *
 * `active` is emitted explicitly rather than left absent, because "this
 * automation is running" and "this build does not report state" must not share a
 * spelling. Absent means the kind has no state to report.
 */
export const organisationNodeStateSchema = Schema.Literals([
  'active',
  'paused',
  'disabled',
]).annotate({
  description:
    'Operational state, on the kinds that have one (`automation`, `agent-resource`). Rendered as weight (dashed = paused, grey = disabled), never as colour. Emitted explicitly as `active` when running — an absent key means the kind reports no state, not that the thing is healthy.',
})

/**
 * One of the four figures the Reach lens's "Structural position" block reads —
 * `Holds · Reaches · Writes · Duplicate routes`.
 *
 * FLAT ON THE NODE, and both halves of that are decisions.
 *
 * FLAT, because the consumer is a `key-value` / `record-detail` binding that
 * resolves `$record.<key>` as a single segment. A nested `position: { holds }`
 * would decode, render `[object Object]`, and be discovered in a browser rather
 * than at a gate — the same trap `attention.ts` is flat to avoid.
 *
 * ON THE NODE rather than behind `?node=`, because these are folds over edges
 * this body already carries: a consumer that has the graph has the arithmetic,
 * and publishing the fold is what `viaOpenRung` already does for exactly the
 * same reason — a lens that does not draw the `open` node would otherwise lose
 * it. Making the figures a second round trip would make selection a REQUEST,
 * where it is a rendering decision.
 *
 * Present on `person` and `agent` nodes and on no other kind, and ABSENT rather
 * than zero elsewhere. A `table` carrying `holds: 0` would assert a fact about a
 * thing that has no such fact, and a principal genuinely holding nothing would
 * then be indistinguishable from a resource — the same distinction `state`
 * spells out by emitting `active` explicitly instead of leaving it absent.
 */
const principalFigure = (description: string) =>
  optionalField(
    Schema.Int.annotate({ description }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  )

/**
 * One node of the access graph.
 *
 * `label` is the load-bearing S4 field: it is a NAME — `invoices`, `Sales`,
 * `Lea Fontaine` — and never a value read out of a record. `detail` is one short
 * rendered line under it, subject to the same rule.
 */
export const organisationNodeSchema = Schema.Struct({
  id: graphId(
    'Stable identifier for this node, unique within `nodes`. Edges address nodes by this value, so every `edges[].from` and `edges[].to` resolves to one of these.'
  ),
  kind: organisationNodeKindSchema,
  label: Schema.String.annotate({
    description:
      'The display name of the thing — a table name, a role name, a person’s display name (S4: a NAME, never a field value, a token or a variable’s value). Never empty: a node the operator cannot name is a node they cannot act on.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  family: optionalField(organisationNodeFamilySchema),
  level: optionalField(
    Schema.Int.annotate({
      description:
        'Rung on the role ladder, for `role` nodes only — higher is more privileged. Orders the Map’s middle column and the Matrix’s columns (`sortBy: ’level’`). Absent on every other kind, and on a role the ladder does not rank.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  state: optionalField(organisationNodeStateSchema),
  detail: optionalField(
    Schema.String.annotate({
      description:
        'One short rendered line under the label, naming SUBJECTS only (e.g. "4 members" or "since 9 Sep 16:20") — never a field value or a secret (S4). Absent when the node has nothing to add; never the empty string, so absence has one spelling.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  holds: principalFigure(
    'How many distinct grant sources this principal stands in — the roles and teams its `member` edges leave for. The open rung is NOT counted: nobody holds `*`, which is exactly what makes it open.'
  ),
  reaches: principalFigure(
    'How many distinct resources this principal can reach through the sources it holds — the two-hop count `member` then `grant`. Counts each resource ONCE however many routes lead to it, which is what makes it comparable with `duplicateRoutes` rather than a restatement of it.'
  ),
  writes: principalFigure(
    'How many of those resources it can CHANGE — the subset whose grant `ops` carries at least one of `C`, `U`, `D`, `W`. `R` is not a write and neither is `AI`: an AI-access grant is its own rung, and folding it in here would report a principal as a writer on the strength of a tool permission.'
  ),
  duplicateRoutes: principalFigure(
    'How many of those resources it reaches through MORE THAN ONE grant source — a role and a team that both lead to the same table. Not a fault: a duplicate route is what makes revoking one grant fail to remove an access, which is the thing an operator cannot see by reading either grant alone.'
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphNode',
})

/**
 * What an edge MEANS. Closed, like the node kinds, and for the same reason: an
 * edge whose kind a lens does not recognise is an edge it cannot draw.
 *
 *  - `member`     — a principal stands in a role or a team.
 *  - `grant`      — a grant source reaches a resource. The Matrix is entirely
 *                   these, and `ops` says what the grant permits.
 *  - `trigger`    — a role may invoke an agent, or an automation fires.
 *  - `escalation` — an agent escalates to an approver.
 *  - `step`       — one station of an automation to the next (Processes lanes).
 */
export const organisationEdgeKindSchema = Schema.Literals([
  'member',
  'grant',
  'trigger',
  'escalation',
  'step',
]).annotate({
  description:
    'What the edge means: `member` (a principal stands in a role or team), `grant` (a grant source reaches a resource — the Matrix is entirely these), `trigger` (a role may invoke an agent, or an automation fires), `escalation` (an agent escalates to an approver), `step` (one station of an automation to the next).',
})

/**
 * The display NAME of one of an edge's two endpoints — byte-identical to the
 * `label` of the node that endpoint's id resolves to.
 *
 * WHY A REDUNDANT COPY IS THE RIGHT ANSWER
 * ----------------------------------------
 * It is redundant only to a consumer that can join. A declarative `table`
 * binding `rowsKey: 'edges'` renders one edge per row and CANNOT reach into a
 * sibling array to look a label up — the flat-binding constraint this module's
 * header documents. So the shipped Reach lens renders ids, and most read
 * acceptably because they are namespaced (`page:home`, `role:admin`,
 * `table:waitlist`, the bare `open`). One does not: a `person:` id is the
 * account's opaque key, and the lens prints
 * `person:mg7czPiGzxoGDBGMBqhp9ovF9R0sB8hx` where a human expects a name. That
 * is not a leak — an id is not an email, and S4 keeps addresses off this body
 * entirely — but it is the one cell on that page an operator cannot act on.
 *
 * The alternative considered and refused was a lookup table in the config layer,
 * which would rot on the first rename and would have to be written once per
 * lens.
 *
 * WHY `fromLabel` / `toLabel` AND NOT `source` / `resource`
 * ---------------------------------------------------------
 * The proposal's Reach sketch names its columns `source · kind · resource · ops
 * · route`, and those words are right for a `grant` edge and wrong for the other
 * four kinds: a `member` edge's `to` is a role, not a resource, and a `step`
 * edge joins two stations of one automation. Naming the wire after one edge
 * kind's reading would put a lie in four of the five rows. `from` -> `fromLabel`
 * is mechanical and total, and the lens-specific word belongs to the config
 * layer, which is the layer that knows which lens it is.
 *
 * S4: a NAME, under exactly the rule `label` carries — and the person case is
 * the one that matters, because the fallback for an account with no display name
 * is the node's own `UNNAMED_PRINCIPAL_LABEL`, never the address. There is no
 * second fallback path here to get that wrong in: the value IS the node's label.
 */
const edgeEndpointLabel = (endpoint: 'from' | 'to') =>
  optionalField(
    Schema.String.annotate({
      description: `The display name of the node \`${endpoint}\` resolves to — byte-identical to that node's \`label\`. Carried on the edge because a declarative row binding cannot join \`edges\` to \`nodes\`, and a \`person:\` id is otherwise an opaque account key in front of an operator. A NAME, never an address (S4): for an unnamed account this is the same "Unnamed account" fallback the node uses. Never the empty string.`,
    }).pipe(Schema.check(Schema.isMinLength(1)))
  )

/**
 * One edge of the access graph.
 *
 * `viaOpenRung` is not cosmetic. A grant reached through `*` is the single most
 * consequential fact this page publishes — it is what turns "15 principals" into
 * "everybody, including nobody in particular" — so it is a field on the edge
 * rather than something a client re-derives by walking back to an `open` node it
 * might not have drawn.
 */
export const organisationEdgeSchema = Schema.Struct({
  id: graphId('Stable identifier for this edge, unique within `edges`.'),
  from: graphId('The `nodes[].id` this edge starts at.'),
  to: graphId('The `nodes[].id` this edge ends at.'),
  fromLabel: edgeEndpointLabel('from'),
  toLabel: edgeEndpointLabel('to'),
  kind: organisationEdgeKindSchema,
  ops: optionalField(
    Schema.String.annotate({
      description:
        'What a `grant` edge permits, as letters from the closed alphabet `RCUDWAI`: `R` read, `C` create, `U` update, `D` delete, `W` write, `AI` an AI-access grant. Canonical spellings are `RCUD`, `RW`, `AI`, `R`, `W`. The Matrix reads the letters to fill its quadrant glyph, so the alphabet is constrained rather than free text. Present on `grant` edges; absent on every other kind.',
    }).pipe(
      Schema.check(
        Schema.makeFilter((value: string) =>
          /^[RCUDWAI]+$/.test(value)
            ? undefined
            : 'one or more letters from the closed alphabet RCUDWAI'
        )
      )
    )
  ),
  viaOpenRung: optionalField(
    Schema.Boolean.annotate({
      description:
        'True when this grant is reached through the open rung (`*` / everyone / any-session) rather than through a named role or team — the fact that turns a finite principal count into an unbounded exposure. A field rather than a client-side re-derivation, because a lens that does not draw the `open` node would otherwise lose it. Absent means the grant is named.',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphEdge',
})

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
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphFinding',
})

/**
 * Names a source that could not be resolved, so the graph it should have
 * contributed is MISSING rather than empty.
 *
 * The rule the sibling reads learned the expensive way: an absence produced by
 * an unreadable source is indistinguishable from an absence produced by there
 * being nothing there, and the operator reads calm where the truth is an outage.
 * Here the stakes are higher than a wrong tile — a missing `team_member` read
 * silently turns "Lea Fontaine bridges Sales and Office" into "nobody bridges
 * anything", which is a FINDING that quietly disappears.
 *
 * So a source that fails degrades to contributing nothing AND names itself. The
 * three names v1 can emit are `principals`, `team-membership` and
 * `automation-state` — one per runtime query.
 *
 * Deliberately an OPEN string rather than a closed enum. Closing it would mean
 * that adding a fourth source, or renaming one, turns a degraded read into a 500
 * at the response gate: degradation must never escalate into an outage, which is
 * the one thing this field exists to prevent.
 */
export const organisationDegradedSourceSchema = Schema.String.annotate({
  description:
    'The name of a source that could not be resolved; its contribution to the graph is missing rather than empty. v1 emits `principals`, `team-membership` or `automation-state` — one per runtime query. Open rather than a closed enum on purpose: a new or renamed source must not turn a degraded read into a 500.',
}).pipe(Schema.check(Schema.isMinLength(1)))

/**
 * Whether an exception narrows WHICH COLUMNS a grant covers or WHICH ROWS it
 * covers. Closed at two because AppSchema declares exactly two narrowings, in
 * two unrelated places:
 *
 *  - `field` — `tables[].permissions.fields[] = { field, read?, write? }`
 *  - `row`   — `tables[].rowLevelPermissions.{read,write,create,delete}.when`
 *
 * The second is NOT inside `permissions`; it is a sibling key on the table, and
 * the two were written years apart. Publishing them under one `scope` is the
 * first place in the product they are read as one idea — "the grid's cell is not
 * the whole truth for this table" — which is exactly what the Matrix needs to
 * say beneath its grid.
 */
export const organisationExceptionScopeSchema = Schema.Literals(['field', 'row']).annotate({
  description:
    'Which axis the exception narrows: `field` (a per-column read/write restriction from `tables[].permissions.fields`) or `row` (a per-record predicate from `tables[].rowLevelPermissions`). Two, because AppSchema declares two — and they live in two unrelated places, which is why this is the first surface that reads them as one idea.',
})

/**
 * The operation an exception narrows.
 *
 * Four, and the set is the UNION of two smaller ones rather than the table's own
 * five. A field restriction has two verbs (`read`, `write`); a row predicate has
 * four (`read`, `write`, `create`, `delete`). Neither has `comment`, and neither
 * splits `write` into `create`/`update` the way `tables[].permissions` does.
 *
 * So `update` is deliberately NOT a member: a field restriction on updating is
 * spelled `write`, and inventing an `update` spelling here would make a consumer
 * hunt for rows that can never exist.
 */
export const organisationExceptionOpSchema = Schema.Literals([
  'read',
  'write',
  'create',
  'delete',
]).annotate({
  description:
    'The operation narrowed. The union of the two declaring vocabularies: a field restriction spells `read` / `write`, a row predicate spells `read` / `write` / `create` / `delete`. Deliberately NOT the table op set — there is no `update` (a field write covers it) and no `comment` (neither axis narrows it).',
})

/**
 * The SHAPE of a declared grant, as `classifyPermissionRung` reports it.
 *
 * Three members where the domain's own enum has four: `undeclared` is absent,
 * because an exception IS a declaration. A row reading "nothing was declared
 * here" would be a row for every field of every table that has no restriction —
 * the exceptions list would become a census of the config, and the one thing it
 * is for is telling an operator which cells of the Matrix are lying.
 */
export const organisationExceptionRungSchema = Schema.Literals([
  'everyone',
  'any-session',
  'roles',
]).annotate({
  description:
    'The shape of the declared grant, as the domain’s `classifyPermissionRung` reports it: `everyone` (declared `all`), `any-session` (declared `authenticated`), or `roles` (a declared role list, carried in `roles`). The domain’s fourth rung `undeclared` is absent by construction — an undeclared restriction is not an exception, and emitting it would turn this list into a census of every field in the app.',
})

/**
 * One declared narrowing of a grant, beneath the Matrix's grid.
 *
 * FLAT, for the reason `findings` is flat: its consumer is a declarative `table`
 * over `rowsKey: 'exceptions'` — the accessible twin the Matrix's own story
 * names — and a `$record.` path resolves one segment. `detail` is therefore a
 * rendered SENTENCE like `findings[].message`, because a config layer can print
 * a string and cannot format one.
 *
 * WHAT IS PUBLISHED, AND THE ONE THING THAT IS NOT
 * ------------------------------------------------
 * Field names, role names and the grant's shape — all NAMES, the class this body
 * already carries everywhere.
 *
 * A row predicate's `value` is NOT published, in any form. `rowLevelPermissions`
 * predicates are `{ field, operator, value }` where `value` may be a literal —
 * `'published'`, `42`, a list of ids — or a `$currentUser` reference. Those
 * literals are CONFIGURED values, and an admin-tier caller can already read them
 * through `GET /api/admin/config/schema`, so carrying them would widen nothing
 * legally. It would still be the first VALUE on a body whose S4 rule is "every
 * string is a NAME or a sentence about names", and the narrower body is the one
 * to ship — the identical argument that keeps `email` off a `person` node.
 *
 * What an operator needs from a row predicate is not the literal but the
 * SCOPING: this table's reads are filtered, and they are filtered on these
 * fields. That is what a row-scope exception says, one row per keyed field.
 *
 * `resourceNodeId` addresses and `resource` displays, which is the same pairing
 * as `from` / `fromLabel` and for the same reason: the Matrix highlights a row
 * by node id, and a declarative table prints a name.
 */
export const organisationExceptionSchema = Schema.Struct({
  id: graphId(
    'Stable identifier for this exception, unique within `exceptions`. Derived per request like everything else here; a row identity for the list that renders it, never a persisted key.'
  ),
  resourceNodeId: graphId(
    'The `nodes[].id` of the resource this exception narrows — the Matrix row it belongs under. Resolves to a node in the same body, exactly as an edge endpoint does.'
  ),
  resource: Schema.String.annotate({
    description:
      'The display name of that resource — the table name. Carried beside the id for the same reason `fromLabel` is carried beside `from`: the consuming row binding cannot join this list to `nodes`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  scope: organisationExceptionScopeSchema,
  op: organisationExceptionOpSchema,
  field: Schema.String.annotate({
    description:
      'The field NAME the exception is about: the restricted column for a `field` scope, the column the predicate filters on for a `row` scope. Required on both — a field restriction names its field and every row predicate keys on one, so an exception without a field is a producer bug rather than a broader exception. May be a relation path (`project.client_id`), which a predicate is allowed to declare.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  rung: optionalField(organisationExceptionRungSchema),
  roles: optionalField(
    Schema.Array(
      Schema.String.annotate({ description: 'One declared role name.' }).pipe(
        Schema.check(Schema.isMinLength(1))
      )
    )
      .annotate({
        description:
          'The role names the restriction declares, verbatim — including any `group:<name>` entry, because `group:` is a convention the evaluator decodes at runtime and NOT part of the declared type, so stripping it here would publish a role that does not exist. Present exactly when `rung` is `roles`; absent on `everyone`, on `any-session`, and on every `row` scope, where a predicate names no role at all.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  detail: Schema.String.annotate({
    description:
      'The exception as ONE rendered sentence, e.g. "Only engineer may read amount." or "Reads are filtered on owner_id." Rendered server-side because the consuming table binding can print a string but cannot format one. Names fields and roles, never a predicate’s configured value (S4).',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphException',
})

/**
 * Query parameters of `GET /api/admin/organisation/graph`.
 *
 * One optional parameter. Deliberately NOT `strictKeys`: a console page carries
 * its own `?tab=` in the same URL, and a read that 400s because the page it is
 * embedded in remembered which tab was open would be a self-inflicted outage.
 *
 * `optionalField` rather than `Schema.optionalKey`, and the difference is not
 * stylistic: a handler assembling an explicit allow-list object passes every
 * declared key, so an unsupplied parameter arrives as a PRESENT `undefined`,
 * which exact-optional rejects with a 400. That is the measured failure the
 * repo's own combinator exists to prevent.
 */
export const adminOrganisationGraphQuerySchema = Schema.Struct({
  node: optionalField(
    Schema.String.annotate({
      description:
        'A `nodes[].id` to narrow the graph to. The body then carries that node together with every node it reaches and every node that reaches it, the edges between the survivors, and their exceptions — `findings` and `degraded` are untouched, because they describe the instance rather than the node. A well-formed id that names nothing yields an empty graph and a 200, never a 404: this route already answers 404 to a non-admin, so a second meaning for that status would leave a caller unable to tell "you may not read this" from "no such node". Omitted returns the whole graph.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
})

/**
 * Response shape of `GET /api/admin/organisation/graph`.
 *
 * One resolved access graph, the findings derived from it, and an honest list of
 * what could not be read.
 *
 * Invariants (asserted by the E2E specs, because a schema cannot express a
 * cross-field reference or an ordering):
 *  - every `edges[].from` and `edges[].to` resolves to a `nodes[].id`, and so
 *    does every `exceptions[].resourceNodeId`
 *  - `nodes[].id` is unique within `nodes`; likewise `edges`, `findings` and
 *    `exceptions`
 *  - `fromLabel` and `toLabel` equal the `label` of the node each id resolves to
 *  - `findings` is ordered by `blastRadius` descending, every `"unbounded"`
 *    before every finite count
 *  - `severity` is `critical` exactly when `blastRadius` is `"unbounded"`
 *  - `family` is present on exactly the resource kinds
 *  - `holds` / `reaches` / `writes` / `duplicateRoutes` are present on exactly
 *    the principal kinds, and agree with the edges in the same body
 *  - `ops` is present on exactly the `grant` edges
 *  - `roles` is present on exactly the exceptions whose `rung` is `roles`
 *  - `degraded` is EMPTY on a healthy read; a named source means the graph is
 *    missing that source's contribution
 *  - no `label`, `detail`, `message`, `subjects`, `fromLabel`, `toLabel`,
 *    `resource`, `field` or `roles` entry contains an `@` from an account
 *    address: the body names people, never their emails
 *  - no `exceptions` entry carries a row predicate's configured VALUE in any
 *    field, including inside `detail`
 *  - the read costs THREE database queries regardless of how many teams, tables
 *    or principals the instance has — and regardless of whether `?node=` was
 *    supplied, since the narrowing is a fold over a graph already in memory
 *
 * `degraded` is REQUIRED and empty-when-healthy, where attention's is an
 * OPTIONAL string absent-when-healthy. The difference is that an array has a
 * canonical empty value and a string does not: `degraded: ''` would have been a
 * third spelling competing with absence, whereas `degraded: []` says "every
 * source was read" in exactly one way.
 *
 * Exposed under the OpenAPI name `AdminOrganisationGraphResponse`.
 */
export const adminOrganisationGraphResponseSchema = Schema.Struct({
  nodes: Schema.Array(organisationNodeSchema).annotate({
    description:
      'Every node of the access graph — principals, grant sources, resources — plus the automation lanes and their steps. Empty only on an instance that declares no tables, pages, buckets, agents or automations AND has no accounts.',
  }),
  edges: Schema.Array(organisationEdgeSchema).annotate({
    description:
      'Every edge of the access graph. Each `from` / `to` resolves to a `nodes[].id` in this same body; an edge whose endpoint is absent is a producer bug, not a client-side lookup miss.',
  }),
  findings: Schema.Array(organisationFindingSchema).annotate({
    description:
      'What the map found, ordered by `blastRadius` descending with every `"unbounded"` finding above every finite one. Derived per request and never stored (ADR-022: the console is read-only) — nothing pages, nothing is acknowledged, nothing persists. Empty when the configuration exposes nothing structural.',
  }),
  exceptions: Schema.Array(organisationExceptionSchema)
    .annotate({
      description:
        'Every declared narrowing of a grant — the per-field restrictions and the per-row predicates the Matrix draws beneath its grid, which a cell glyph cannot show. Empty when no table declares `permissions.fields` or `rowLevelPermissions`. Filtered by `?node=` along with the graph, since an exception is a fact about a resource.',
    })
    .pipe(withDefault([])),
  appliedNode: optionalField(
    graphId(
      'The `?node=` value this body was narrowed to; absent on an unfiltered read. An ECHO rather than a courtesy: a client cannot otherwise tell a server that honoured the filter from one that ignored an unknown parameter, and on this page the two look identical in the worst direction — an older binary would render "this principal reaches everything". Echoed even when the id matched nothing, so an empty graph still says what it was empty OF.'
    )
  ),
  degraded: Schema.Array(organisationDegradedSourceSchema).annotate({
    description:
      'Sources that could not be resolved, so their contribution to the graph is MISSING rather than empty. EMPTY on a healthy read — required and empty rather than optional and absent, because an array has one canonical empty value where a string would have had two. NOT narrowed by `?node=`: it reports the read’s health, not the node’s.',
  }),
  generatedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of when this graph was derived. Per-request — the whole body is computed on every call, which is why the route sends `Cache-Control: no-store`. There is deliberately no `since`: nothing here is windowed, and the config half is read live rather than frozen at boot.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminOrganisationGraphResponse',
})

/** @public */
export type AdminOrganisationGraphNode = typeof organisationNodeSchema.Type

/** @public */
export type AdminOrganisationGraphEdge = typeof organisationEdgeSchema.Type

/** @public */
export type AdminOrganisationGraphFinding = typeof organisationFindingSchema.Type

/** @public */
export type AdminOrganisationGraphException = typeof organisationExceptionSchema.Type

/** @public */
export type AdminOrganisationGraphQuery = typeof adminOrganisationGraphQuerySchema.Type

/** @public */
export type AdminOrganisationGraphResponse = typeof adminOrganisationGraphResponseSchema.Type
