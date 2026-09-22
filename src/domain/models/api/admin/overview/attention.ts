/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/attention` — the Welcome page's "what needs
 * me?" read.
 *
 * This is the companion of `GET /api/admin/overview`, not a replacement. The
 * overview answers *"how big is this instance?"* with one headline scalar per
 * domain; attention answers *"what is wrong with it right now?"* with the six
 * pulse cells the console's landing page renders above its tile grid, plus the
 * per-tile SUB-LINE figures the same page renders under each headline number.
 * Both back the one surface (`apps/admin/config/pages/home.ts`), which is why
 * this schema lives beside `overview.ts` rather than in a family of its own.
 *
 * WHY THE BODY IS FLAT
 * --------------------
 * The consumer is a DECLARATIVE page, not a React component. Its cells and
 * sub-lines are authored as `$record.<key>` bindings, and a `$record.` path is
 * a FLAT key — it cannot reach into a nested object. A nested
 * `{ failedRuns: { count, detail } }` would decode perfectly and then bind to
 * nothing, silently rendering an empty strip. So every value here is a scalar
 * or a string at the top level, and the grouping that would have been nesting
 * is carried by the NAME (`failedRuns` / `failedRunsDetail`).
 *
 * That flatness is also the S4 response gate doing its job: a body that cannot
 * express a nested object cannot accidentally carry a raw DB row.
 *
 * THE ANCHOR: `since` IS THE PROCESS BOOT
 * ---------------------------------------
 * The strip is headed "Since this instance started", and `since` is exactly
 * `GET /api/admin/config/version`'s `startedAt` — the module-import timestamp
 * frozen for the process lifetime (`PROCESS_STARTED_AT` in
 * `presentation/api/admin/overview-routes.ts`). It is deliberately NOT a
 * "since you last looked" figure: no per-operator last-visit state exists
 * anywhere in the admin surface, and inventing one would mean a write on a
 * read-only console. Anchoring on the boot instead gives every
 * operator the same number, needs no storage, and is self-explaining — a
 * restart is a thing an operator does on purpose and can therefore reason
 * about.
 *
 * TWO CLASSES OF CELL, AND THE HEADER IS HONEST ABOUT ONLY ONE
 * ------------------------------------------------------------
 * The six cells do not all mean the same kind of thing, and implementing them
 * as though they did is the likeliest way to get this wrong:
 *
 *  - **Since-boot EVENT counts** — `failedRuns`, `recentSubmissions`. These
 *    count rows created after `since`. A restart RESETS them to `0`.
 *  - **Current-STATE counts** — `variablesUnset`, `tokensExpired`,
 *    `invitationsPending`, `automationsPaused`. These count what is true right
 *    now. A restart does NOT reset them; an automation paused last week is
 *    still paused, and must still be reported.
 *
 * Both are truthfully "since this instance started" — a state that holds now
 * has held for the whole process lifetime — but only the first pair is
 * *windowed* by `since`. Do not add a `created_at > since` predicate to the
 * four state cells: it would hide exactly the long-standing problems the strip
 * exists to surface.
 *
 * DETAIL STRINGS NAME SUBJECTS, NEVER VALUES (S4)
 * -----------------------------------------------
 * Each cell carries a short human-readable `…Detail` rendered under its number
 * — "deal-won-invoice ×2 · quote-to-pdf ×2". A detail names the SUBJECTS that
 * make up the count (an automation name, a variable NAME, a connection name)
 * and never their contents. `variablesUnsetDetail` in particular carries the
 * variable's NAME and must never carry its value — the cell counts variables
 * that are unset, so there is no value to leak, but a later "expiring secret"
 * cell reusing this shape would have one.
 *
 * ZERO AND ITS DETAIL
 * -------------------
 * A cell reporting `0` carries an EMPTY detail: there are no subjects to name,
 * and the page renders the number with no sub-line. A cell reporting a
 * non-zero count names at least one subject. This is a contract rather than a
 * convention because the page has no other way to decide whether to reserve
 * the sub-line's row.
 *
 * A DEGRADED SOURCE IS NOT A ZERO — SEE {@link attentionDegradedField}
 * --------------------------------------------------------------------
 * `overview.ts` learned this the expensive way (see the `degraded` marker
 * section of the source story): a `0` emitted because a source could not be
 * read is indistinguishable from a `0` emitted because there is genuinely
 * nothing wrong, and the operator reads calm where the truth is an outage.
 * The same rule holds here, adapted to a flat body: an unreadable source
 * contributes its zero AND names itself in `degraded`.
 *
 * WHAT EACH FIGURE IS SOURCED FROM (all reductions the config layer cannot do)
 * ---------------------------------------------------------------------------
 * Only `failedRuns` has a scalar available today (automations-overview
 * `totals.failures_24h`, and even that is a fixed-24h window rather than a
 * since-boot one). Every other figure is a LIST REDUCTION over an existing
 * admin read — which is the whole reason this endpoint exists rather than the
 * page binding nine `kpi` islands:
 *
 *  - `failedRuns`          ← automation runs with a failed result, since `since`
 *  - `variablesUnset`      ← `/api/admin/env` variables where `required ∧ !isSet`
 *  - `tokensExpired`       ← `/api/admin/connections` rows whose derived status is `expired`
 *  - `invitationsPending`  ← `/api/admin/invitations` items whose status is `pending`
 *  - `recentSubmissions`   ← form submissions created since `since`
 *  - `automationsPaused`   ← automations whose state is `paused`
 *  - `tableFields`         ← sum of declared field counts across `app.tables[]`
 *  - `automationsDisabled` ← automations whose state is `disabled`
 *  - `agentsDefault`       ← agents flagged as the default (`0` or `1`)
 *  - `bucketsS3` / `bucketsLocal` ← buckets grouped by resolved provider
 *  - `linksConfig` / `linksDb`    ← links grouped by source (config-declared vs stored)
 *  - `usersBanned`         ← users whose `banned` flag is set
 *  - `teams`               ← configured teams
 *
 * @see src/domain/models/api/admin/overview/overview.ts (the sibling headline roll-up)
 * @see src/domain/models/api/admin/config/version.ts (`startedAt` — the `since` anchor)
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * A non-negative count, described at its call site.
 *
 * The description is a PARAMETER rather than a shared string because each of
 * these becomes an OpenAPI field description, and one generic sentence across
 * sixteen fields would document none of them. `annotate` runs BEFORE `check`
 * deliberately: a trailing `annotate` after a `check` lands on the check node,
 * not on the schema, and the description silently vanishes from the published
 * document.
 */
const attentionCount = (description: string) =>
  Schema.Int.annotate({ description }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))

/**
 * A cell's human-readable sub-line — a `·`-joined list of the subjects behind
 * the number, or the empty string when the count is `0`.
 *
 * Deliberately a rendered STRING rather than an array of structured subjects.
 * The consumer is a `$record.` binding on a declarative page: it can print a
 * string and cannot format a list, so shipping an array would push the join —
 * separator, truncation, ordering — into a config layer that has no way to
 * express it. Formatting server-side also bounds the body: a thousand failed
 * runs still produce one short line.
 */
const attentionDetail = (description: string) => Schema.String.annotate({ description })

/**
 * Names the sources that could not be read, so their zeros are a FALLBACK
 * rather than a measurement.
 *
 * PRESENT MEANS DEGRADED; there is no `degraded: ''` for a healthy read. One
 * spelling per state, so a client cannot read the empty string as "unknown" or
 * treat the key's absence as a third case. Absent is the healthy case, which
 * also makes the field additive: every decoder written before it existed keeps
 * working.
 *
 * It is a `·`-joined list of SOURCE names (`connections · invitations`) rather
 * than a boolean, because the flat body has nowhere to put a per-cell marker —
 * the overview's one-marker-per-block granularity is unavailable here. Naming
 * the sources recovers what that granularity bought: the operator can tell
 * which zeros to distrust.
 *
 * A degraded cell still emits `0` with an EMPTY detail, exactly like a
 * genuinely empty one. That is deliberate: the zero/empty-detail contract
 * stays single-meaning, and `degraded` is the ONE channel that says a figure
 * was not measured.
 */
const attentionDegradedField = optionalField(
  Schema.String.annotate({
    description:
      'Present only when at least one source could not be read: a "·"-joined list of those source names (e.g. "connections · invitations"), whose figures are therefore the zero fallback rather than a measurement. Absent when every source was read. Never the empty string.',
  }).pipe(Schema.check(Schema.isMinLength(1)))
)

/**
 * Response shape of `GET /api/admin/attention`.
 *
 * One flat envelope: the `since` anchor, six pulse cells as a
 * count + rendered-detail pair each, ten tile sub-line counts, and the
 * per-request `generatedAt`. Every value is a scalar or a short string, so the
 * body can never carry a raw DB row or a secret (S4).
 *
 * Invariants (asserted by the E2E specs):
 *  - `since` === `GET /api/admin/config/version`.`startedAt`, byte-identical,
 *    and stable across every call within one process lifetime
 *  - `generatedAt` >= `since`, and advances between two reads
 *  - for each of the six cells: count `0` ⟺ detail `''`
 *  - `automationsPaused` is BOTH the sixth pulse cell's count and the
 *    Automations tile's "paused" sub-line figure — one key, one reduction, so
 *    the strip and the tile can never disagree
 *  - `agentsDefault` is `0` or `1` (an app declares at most one default agent)
 *  - a `degraded` naming a source means that source's figures are fallbacks
 *
 * Exposed under the OpenAPI name `AdminAttentionResponse`.
 */
export const adminAttentionResponseSchema = Schema.Struct({
  // ---- The anchor ------------------------------------------------------
  since: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp this report is anchored on — the process boot, byte-identical to `GET /api/admin/config/version`.`startedAt` and identical across every call within one process lifetime. The two event cells (`failedRuns`, `recentSubmissions`) count only what happened after it; the four state cells report what is true now.',
  }),

  // ---- Pulse cell 1: failed runs (EVENT, windowed by `since`) -----------
  failedRuns: attentionCount(
    'Automation runs that ended in failure since `since`. `0` when no run has failed since boot.'
  ),
  failedRunsDetail: attentionDetail(
    'The failing automations with their counts, e.g. "deal-won-invoice ×2 · quote-to-pdf ×2". Empty when `failedRuns` is 0.'
  ),

  // ---- Pulse cell 2: unset required variables (STATE) ------------------
  variablesUnset: attentionCount(
    'Environment variables the app declares as required that currently have no value (`required ∧ !isSet`). `0` when every required variable is set.'
  ),
  variablesUnsetDetail: attentionDetail(
    'The variable NAMES, e.g. "WORKSHOP_TZ" — never their values (S4). Empty when `variablesUnset` is 0.'
  ),

  // ---- Pulse cell 3: expired connection tokens (STATE) -----------------
  tokensExpired: attentionCount(
    'Connections whose derived status is `expired` (NOT `expiring-soon`, which is still usable). `0` when no connection has expired.'
  ),
  tokensExpiredDetail: attentionDetail(
    'The connection names and their owners, e.g. "slack-notify · Paul Girard" — never the token itself (S4). Empty when `tokensExpired` is 0.'
  ),

  // ---- Pulse cell 4: pending invitations (STATE) -----------------------
  invitationsPending: attentionCount(
    'Invitations still awaiting acceptance. `0` when none is outstanding, and when the app declares no organization.'
  ),
  invitationsPendingDetail: attentionDetail(
    'How long the oldest has waited, e.g. "oldest 4 days". Empty when `invitationsPending` is 0.'
  ),

  // ---- Pulse cell 5: recent submissions (EVENT, windowed by `since`) ---
  recentSubmissions: attentionCount(
    'Form submissions received since `since`. `0` when none has arrived since boot — NOT the lifetime figure, which is `GET /api/admin/overview`.`submissions.total`.'
  ),
  recentSubmissionsDetail: attentionDetail(
    'The receiving forms with their counts, e.g. "quote-request · 6 today". Empty when `recentSubmissions` is 0.'
  ),

  // ---- Pulse cell 6 AND the Automations tile sub-line (STATE) ----------
  automationsPaused: attentionCount(
    'Automations whose state is `paused`. Serves BOTH the sixth pulse cell and the Automations tile sub-line — one key so the two can never disagree. `0` when none is paused.'
  ),
  automationsPausedDetail: attentionDetail(
    'The paused automations and since when, e.g. "lead-enrich · since 9 Sep 16:20". Empty when `automationsPaused` is 0.'
  ),

  // ---- Tile sub-lines (STATE; no detail strings — the tiles render the
  //      figures inline, e.g. "2 s3 · 1 local") ---------------------------
  tableFields: attentionCount(
    'Declared fields summed across every configured table — the Tables tile sub-line. `0` when no table is configured.'
  ),
  automationsDisabled: attentionCount(
    'Automations whose state is `disabled` — the second half of the Automations tile sub-line. Disjoint from `automationsPaused`: an automation is disabled OR paused, never both.'
  ),
  agentsDefault: attentionCount(
    'Agents flagged as the default — the Agents tile sub-line. `0` or `1`: an app declares at most one default agent.'
  ),
  bucketsS3: attentionCount(
    'Buckets resolving to the S3 provider — the first half of the Buckets tile sub-line.'
  ),
  bucketsLocal: attentionCount(
    'Buckets resolving to the local-filesystem provider — the second half of the Buckets tile sub-line.'
  ),
  linksConfig: attentionCount(
    'Links declared in the app config — the first half of the Links tile sub-line.'
  ),
  linksDb: attentionCount(
    'Links stored in the database — the second half of the Links tile sub-line. `linksConfig + linksDb` equals `GET /api/admin/links`.`total`.'
  ),
  usersBanned: attentionCount(
    'Users whose `banned` flag is set — the Users tile sub-line. Never exceeds `GET /api/admin/overview`.`users.total`.'
  ),
  teams: attentionCount(
    'Configured teams — the Roles / teams tile sub-line. `0` when the app declares no organization.'
  ),

  // ---- Freshness + honesty --------------------------------------------
  generatedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of when this report was computed. Per-request (unlike `since`, which timestamps the process), so it advances between two reads and is always >= `since`.',
  }),
  degraded: attentionDegradedField,
}).annotate({ identifier: 'AdminAttentionResponse' })

/** @public */
export type AdminAttentionResponse = typeof adminAttentionResponseSchema.Type
