/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cross-record rules of `app.decisions[]` — everything a single record
 * cannot see about itself.
 *
 * Pure, no I/O, human-readable messages, empty when the register is
 * well-formed: the same contract every other decode-rule module in the domain
 * keeps. Called from one `Schema.check` on `DecisionsSchema`.
 *
 * ─── WHAT IS CHECKED, AND WHAT DELIBERATELY IS NOT ─────────────────────────
 *
 * The LINEAGE links are checked because they are DEREFERENCED: the console
 * paints `supersedes` as a chip a reader clicks, so a link naming no declared
 * record is a control that navigates nowhere — a defect no status code reports.
 *
 * `touches` is NOT checked against the config, and that is the register's
 * central design decision rather than an omission. A decision outlives what it
 * decided; a superseded record names config that is gone by definition. A
 * cross-reference rule there would refuse a boot for the register being honest
 * about its own history, and would teach operators to delete the record.
 */

/** The subset of a decision these rules read. */
interface LineageRecord {
  readonly id: string
  readonly status: string
  readonly supersedes?: string | undefined
  readonly supersededBy?: string | undefined
}

/**
 * Every violation in one register, in a stable order.
 *
 * All of them are collected rather than stopping at the first, because the
 * caller takes `[0]` and an operator fixing a register one boot at a time is
 * better served by a deterministic sequence than by whichever rule happened to
 * run first.
 */
export const collectDecisionRegisterViolations = (
  decisions: readonly LineageRecord[]
): readonly string[] => [
  ...duplicateIdViolations(decisions),
  ...selfReferenceViolations(decisions),
  ...danglingLinkViolations(decisions),
  ...oneSidedLinkViolations(decisions),
  ...supersededStatusViolations(decisions),
  ...cycleViolations(decisions),
]

/**
 * Two records claiming one id.
 *
 * Uniqueness is the ONLY property the register needs from an id — which is why
 * the format is left free — and it is the property every lineage link resolves
 * by. With a duplicate, `supersedes: '[internal ref]'` names two different decisions
 * and the console paints whichever the lookup happens to find first.
 */
const duplicateIdViolations = (decisions: readonly LineageRecord[]): readonly string[] => {
  const seen = decisions.map((decision) => decision.id)
  return [...new Set(seen.filter((id, index) => seen.indexOf(id) !== index))].map(
    (id) =>
      `app.decisions declares the id "${id}" more than once — a register resolves every supersedes/supersededBy link by id, so a duplicate makes a lineage link name two different decisions`
  )
}

/** A record naming itself. A decision cannot replace the decision it is. */
const selfReferenceViolations = (decisions: readonly LineageRecord[]): readonly string[] =>
  decisions.flatMap((decision) =>
    decision.supersedes === decision.id || decision.supersededBy === decision.id
      ? [
          `app.decisions declares "${decision.id}" as superseding or superseded by itself — a decision cannot replace the decision it is`,
        ]
      : []
  )

/** A link naming an id the register does not declare. */
const danglingLinkViolations = (decisions: readonly LineageRecord[]): readonly string[] => {
  const declared = new Set(decisions.map((decision) => decision.id))
  return decisions.flatMap((decision) =>
    (
      [
        ['supersedes', decision.supersedes],
        ['supersededBy', decision.supersededBy],
      ] as const
    ).flatMap(([field, target]) =>
      target === undefined || declared.has(target)
        ? []
        : [
            `app.decisions declares "${decision.id}" with ${field}: "${target}", which no decision in the register declares — the console paints a lineage link a reader can follow, and this one navigates nowhere`,
          ]
    )
  )
}

/**
 * A link declared at one end and not the other.
 *
 * Both fields are authored rather than one being derived from the other,
 * because `app.ts` is a file a human reads and a derived field puts a row on
 * the console's panel that is in no file. The price is that they can disagree,
 * and a disagreement renders a lineage chip on one screen and a dash on the
 * other. The message names BOTH ends: an operator handed one id still has to go
 * looking for the other to know what to write.
 */
const oneSidedLinkViolations = (decisions: readonly LineageRecord[]): readonly string[] => {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]))
  return decisions.flatMap((decision) => [
    ...missingCounterpart(decision, byId, 'supersededBy', 'supersedes'),
    ...missingCounterpart(decision, byId, 'supersedes', 'supersededBy'),
  ])
}

/** One direction of the pairing: `field` points at a record whose `mirror` must point back. */
const missingCounterpart = (
  decision: LineageRecord,
  byId: ReadonlyMap<string, LineageRecord>,
  field: 'supersedes' | 'supersededBy',
  mirror: 'supersedes' | 'supersededBy'
): readonly string[] => {
  const target = decision[field]
  if (target === undefined || target === decision.id) return []
  const other = byId.get(target)
  if (other === undefined || other[mirror] === decision.id) return []
  return [
    `app.decisions declares "${decision.id}" with ${field}: "${target}", but "${target}" does not declare ${mirror}: "${decision.id}" — both ends of a supersession are authored, so both must agree`,
  ]
}

/**
 * `supersededBy` on a record whose status says it still stands.
 *
 * The reverse is allowed and left alone: `status: superseded` with no
 * `supersededBy` is the honest record of a decision that was simply abandoned,
 * which is not the same thing as one that was replaced.
 */
const supersededStatusViolations = (decisions: readonly LineageRecord[]): readonly string[] =>
  decisions.flatMap((decision) =>
    decision.supersededBy !== undefined && decision.status !== 'superseded'
      ? [
          `app.decisions declares "${decision.id}" with supersededBy: "${decision.supersededBy}" but status: "${decision.status}" — a decision that has been replaced is superseded, and the console counts it under that heading`,
        ]
      : []
  )

/**
 * A supersession chain that closes on itself.
 *
 * `A supersedes B supersedes A` is a lineage the console walks forever and a
 * history that cannot be read in either direction. Detected by following each
 * record's `supersedes` chain no further than the register is long: a chain
 * that has not ended by then has revisited something.
 */
const cycleViolations = (decisions: readonly LineageRecord[]): readonly string[] => {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]))
  return decisions
    .filter((decision) => closesOnItself(decision, byId, decisions.length))
    .map(
      (decision) =>
        `app.decisions declares a supersession cycle reaching "${decision.id}" — a chain that closes on itself has no first decision and no last, so neither end of the history can be read`
    )
}

/** Whether walking `supersedes` from `start` comes back to `start` within `bound` steps. */
const closesOnItself = (
  start: LineageRecord,
  byId: ReadonlyMap<string, LineageRecord>,
  bound: number
): boolean =>
  Array.from({ length: bound }).reduce<{ readonly at: string | undefined; readonly hit: boolean }>(
    (state) => {
      if (state.hit || state.at === undefined) return state
      const next = byId.get(state.at)?.supersedes
      return { at: next, hit: next === start.id }
    },
    { at: start.supersedes, hit: start.supersedes === start.id }
  ).hit
