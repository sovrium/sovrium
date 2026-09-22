/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `app.decisions[]` — the architecture decision records an app declares beside
 * the configuration they decided.
 *
 * ─── WHY THE REGISTER LIVES IN THE CONFIG ──────────────────────────────────
 *
 * An operator who inherits a running app can read every property of it and
 * still not know why any of them is the way it is. Why Postgres and not the
 * SQLite default? Why is the margin column hidden from the workshop? The config
 * answers WHAT, and the reasoning traditionally lives somewhere the config does
 * not travel to — a wiki, a thread, a person who has left.
 *
 * Declaring the records beside the properties they decided makes the reasoning
 * part of the artefact: it is versioned with the config, it ships with it, and
 * it is readable from the operator console without a second system.
 *
 * ─── THE FOUR NYGARD PARTS ─────────────────────────────────────────────────
 *
 * `context`, `decision` and `consequences` are the three prose parts of the
 * classic ADR, and `status` is what makes a REGISTER out of a pile of them: a
 * decision that was superseded is still a decision, and deleting it deletes
 * the reason the current one exists.
 *
 * @see src/domain/models/app/decisions/decisions-validation.ts — the lineage rules
 */

import { Schema } from 'effect'
import { collectDecisionRegisterViolations } from './decisions-validation'

/**
 * The three states a record can be in.
 *
 * `proposed` is included, and it is the one that makes the register usable
 * while a decision is still being made: a record an operator can read and
 * disagree with before it becomes the way the app works.
 */
export const DECISION_STATUSES = ['accepted', 'proposed', 'superseded'] as const

/** One decision status from the closed set. */
export const DecisionStatusSchema = Schema.Literals([...DECISION_STATUSES]).annotate({
  identifier: 'DecisionStatus',
  title: 'Decision Status',
  description: 'Whether the decision stands, is still being proposed, or has been superseded',
})

/** @public */
export type DecisionStatus = Schema.Schema.Type<typeof DecisionStatusSchema>

/** A calendar day, ISO-8601. */
const ISO_CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * One architecture decision record.
 *
 * ─── `id` IS FREE-FORM, AND UNIQUE ─────────────────────────────────────────
 *
 * Deliberately not pattern-pinned. `[internal ref]`, `[internal ref]`, `GD-092` and `RFC-12`
 * are all conventions teams actually use, and a schema that refused three of
 * them would be refusing a register for its house style. Uniqueness is the only
 * property the register needs from an id, because it is the property the
 * lineage links resolve by — and that IS enforced.
 *
 * ─── `date` IS PATTERN-PINNED, AND THAT IS NOT INCONSISTENT ────────────────
 *
 * The console orders a register newest-first with a `localeCompare` over the
 * raw string. That is chronological for ISO-8601 calendar days and silently
 * wrong for everything else: `01/06/2026` sorts beside `01/02/2025`, and the
 * page still renders, still returns 200, and lies about which decision came
 * last. An id has no such reader; a date does.
 *
 * ─── `deciders` IS AN ARRAY, NOT A JOINED STRING ───────────────────────────
 *
 * A single name joined is the bare string `'Thomas'`, which is structurally
 * indistinguishable from a correct value until something iterates it — at
 * which point it yields six characters instead of one name.
 *
 * ─── `touches` IS A DISPLAY STRING WITH NO CROSS-CHECK ─────────────────────
 *
 * It names what the decision was ABOUT — `engine › DATABASE_URL`,
 * `tables › quotes`, `auth` — as the author wrote it, and is never resolved
 * against the config. A decision necessarily outlives what it decided: a
 * superseded record names config that is gone BY DEFINITION, so a
 * cross-reference rule here would refuse a boot because the register was honest
 * about its own history, and would teach operators to delete the record instead.
 * The ` › ` is a separator the console renders, not a path the schema splits on.
 *
 * ─── `supersedes` / `supersededBy` ARE BOTH AUTHORED ───────────────────────
 *
 * Deriving one from the other would put a row on the console's record panel
 * that is in no file, and `app.ts` is a file a human reads. The price of
 * authoring both is that they can disagree — which is exactly why the
 * disagreement is refused at boot rather than rendered as a lineage chip on one
 * screen and a dash on the other.
 */
export const DecisionSchema = Schema.Struct({
  /** Register identifier, unique within the register. Any convention. */
  id: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        'Register identifier, unique within app.decisions. Free-form: ADR-007, DEC-083, RFC-12 are all accepted',
      examples: ['ADR-007', 'DEC-083'],
    })
  ),
  /** One-line summary of what was decided */
  title: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'One-line summary of what was decided',
      examples: ['Postgres for the shared instance'],
    })
  ),
  /** Whether the decision stands, is proposed, or has been superseded */
  status: DecisionStatusSchema,
  /** The day the decision was taken, as an ISO-8601 calendar day */
  date: Schema.String.pipe(
    // The annotation goes FIRST. A trailing `Schema.annotate` after a custom
    // `makeFilter` lands on the CHECK rather than on the node, and the emitted
    // JSON Schema for this field collapses to a bare `{"type":"string"}` —
    // measured, and the reason this pipe reads in the opposite order to its
    // neighbours, which carry a built-in check the emitter knows how to nest.
    Schema.annotate({
      description:
        'The day the decision was taken, as an ISO-8601 calendar day (YYYY-MM-DD). Ordered by string comparison, so any other format sorts wrongly while still rendering',
      examples: ['2026-06-01'],
    }),
    Schema.check(
      Schema.makeFilter((value: string) =>
        ISO_CALENDAR_DAY.test(value)
          ? true
          : `decision 'date' must be an ISO-8601 calendar day (YYYY-MM-DD), got "${value}" — the register is ordered by string comparison, which is chronological for that format and silently wrong for any other`
      )
    )
  ),
  /** Who took the decision — one entry per person */
  deciders: Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Who took the decision — one entry per person, never a joined string',
      examples: [['Léa Fontaine', 'Thomas']],
    })
  ),
  /** What the decision was about, as the author wrote it. Never resolved against the config. */
  touches: Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))).pipe(
    Schema.annotate({
      description:
        'What the decision was about, as free display text. Deliberately NOT resolved against the config: a superseded decision names config that is gone by definition',
      examples: [['engine › DATABASE_URL', 'tables › quotes']],
    })
  ),
  /** The situation that forced a choice */
  context: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({ description: 'The situation that forced a choice' })
  ),
  /** What was chosen, stated in the active voice */
  decision: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({ description: 'What was chosen, stated in the active voice' })
  ),
  /** What follows from it, good and bad */
  consequences: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({ description: 'What follows from the decision, good and bad' })
  ),
  /** The id of the decision this one replaces */
  supersedes: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          'Id of the decision this one replaces. The replaced record must declare supersededBy pointing back',
        examples: ['ADR-002'],
      })
    )
  ),
  /** The id of the decision that replaced this one */
  supersededBy: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          'Id of the decision that replaced this one. Requires status: superseded, and the replacing record must declare supersedes pointing back',
        examples: ['ADR-007'],
      })
    )
  ),
}).annotate({
  identifier: 'Decision',
  title: 'Decision',
  description:
    'One architecture decision record: its four Nygard parts, who took it and when, what it was about, and its place in the supersession chain',
})

/** @public */
export type Decision = Schema.Schema.Type<typeof DecisionSchema>

/**
 * The declared register.
 *
 * The annotation is piped BEFORE the trailing cross-record check, deliberately:
 * a `Schema.check` wraps the node it guards, so a `Schema.annotate` after it
 * lands on the CHECK and the published JSON Schema silently loses this array's
 * `title` and `description`.
 */
export const DecisionsSchema = Schema.Array(DecisionSchema).pipe(
  Schema.annotate({
    identifier: 'Decisions',
    title: 'Decisions',
    description:
      'The architecture decision records this app declares, in the order the config states them',
  }),
  Schema.check(
    Schema.makeFilter((decisions) => {
      const violations = collectDecisionRegisterViolations(decisions)
      return violations[0] ?? true
    })
  )
)

/** @public */
export type Decisions = Schema.Schema.Type<typeof DecisionsSchema>
