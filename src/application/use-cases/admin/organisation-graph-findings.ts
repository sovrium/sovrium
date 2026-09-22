/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * "What the map found" — the findings list of the console's Organisation page,
 * derived from the same resolved graph the lenses draw.
 *
 * ─── DERIVED PER REQUEST, NEVER STORED ──────────────────────────────────────
 *
 * Storing a finding would mean a write on a read-only console plus
 * per-operator dismissal state. A finding is not an alert: nothing pages,
 * nothing is acknowledged, nothing persists, and two reads a second apart may
 * legitimately differ because the population they measure changed.
 *
 * ─── BLAST RADIUS IS A COUNT OR THE ABSENCE OF ONE ──────────────────────────
 *
 * `blastRadius` is the number of distinct principals the flagged path exposes,
 * and the list is ordered by it descending. An ANONYMOUS exposure carries the
 * string `"unbounded"` and sorts above every finite count, because it is not a
 * larger number — nothing counts the people who have not signed up yet.
 *
 * `severity` follows mechanically and totally: unbounded yields `critical`, a
 * bounded exposure yields `warning`, a structural observation yields `notice`.
 * An operator who cannot reproduce the ranking cannot trust it, which is why
 * nothing here is a judgement call.
 *
 * @see src/application/use-cases/admin/organisation-graph-projection.ts (the fold these read)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import {
  OP_ORDER,
  UNNAMED_PRINCIPAL_LABEL,
  principalLabel,
  unique,
  type OpLetter,
  type ResourceTarget,
} from '@/application/use-cases/admin/organisation-graph-projection'
import {
  classifyPermissionRung,
  isOpenToEveryone,
} from '@/domain/models/app/auth/permission-evaluation'
import type { OrganizationTeamMembershipRecord } from '@/application/ports/repositories/auth/organization-team-repository'
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
import type { AdminOrganisationGraphFinding } from '@/domain/models/api/admin/organisation/graph'

/** The letters that mean "this grant can change something". */
const WRITE_OPS: ReadonlySet<OpLetter> = new Set<OpLetter>(['C', 'U', 'D', 'W'])

/** The two rungs that grant without naming anybody. */
const OPEN_RUNGS: ReadonlySet<string> = new Set(['everyone', 'any-session'])

/** A resource's operations that sit at the ANONYMOUS rung, by letter. */
const anonymousOps = (target: ResourceTarget): readonly OpLetter[] =>
  OP_ORDER.filter((op) =>
    target.grants.some((grant) => grant.op === op && isOpenToEveryone(grant.permission))
  )

/** Whether this resource can be WRITTEN by a caller who never signed in. */
const acceptsAnonymousWrite = (target: ResourceTarget): boolean =>
  anonymousOps(target).some((op) => WRITE_OPS.has(op))

/** Whether this resource's read grant sits at either open rung. */
const readsAtOpenRung = (target: ResourceTarget): boolean =>
  target.grants.some(
    (grant) => grant.op === 'R' && OPEN_RUNGS.has(classifyPermissionRung(grant.permission))
  )

/** How the operator reads a resource kind in a sentence. */
const RESOURCE_NOUN: Readonly<Record<ResourceTarget['kind'], string>> = {
  table: 'table',
  page: 'page',
  form: 'form',
  bucket: 'bucket',
}

/**
 * A write path reachable WITHOUT authenticating.
 *
 * `blastRadius` is `"unbounded"` rather than a large number, because an
 * anonymous exposure is not a bigger count — it is the absence of one.
 */
const publicWriteFindings = (
  targets: readonly ResourceTarget[]
): readonly AdminOrganisationGraphFinding[] =>
  targets.filter(acceptsAnonymousWrite).map((target) => ({
    id: `finding:public-write:${target.nodeId}`,
    kind: 'public-write' as const,
    severity: 'critical' as const,
    blastRadius: 'unbounded' as const,
    subjects: [target.label],
    message: `The ${RESOURCE_NOUN[target.kind]} "${target.label}" accepts writes from callers who are not signed in.`,
  }))

/**
 * A DATA resource readable through the open rung.
 *
 * Bounded, and the bound is the principal count: every account can read it,
 * and unlike the anonymous case that population is knowable.
 *
 * Scoped to resources that CARRY DATA — a page or a form being publicly
 * readable is usually the point of publishing one, and a finding fired on every
 * public page would bury the one that matters. A resource already reported as a
 * public write is not reported twice: the write is the larger fact and the
 * operator is being asked to act once.
 */
const openRungReadFindings = (
  targets: readonly ResourceTarget[],
  principalCount: number
): readonly AdminOrganisationGraphFinding[] =>
  targets
    .filter(
      (target) => target.carriesData && readsAtOpenRung(target) && !acceptsAnonymousWrite(target)
    )
    .map((target) => ({
      id: `finding:open-rung-read:${target.nodeId}`,
      kind: 'open-rung-read' as const,
      severity: 'warning' as const,
      blastRadius: principalCount,
      subjects: [target.label],
      message: `The ${RESOURCE_NOUN[target.kind]} "${target.label}" is readable through the open rung rather than through a named role or team.`,
    }))

/** Every unordered pair of the teams that have at least one member. */
const teamPairs = (
  memberships: readonly OrganizationTeamMembershipRecord[]
): readonly { readonly left: string; readonly right: string }[] => {
  const teams = unique(memberships.map((membership) => membership.teamName))
  return teams.flatMap((left, index) => teams.slice(index + 1).map((right) => ({ left, right })))
}

/**
 * Exactly one principal joining two otherwise populated teams.
 *
 * Not a vulnerability — a CONTINUITY risk, which is why its severity is the
 * lowest of the three and its blast radius is the one person who would take the
 * connection with them. Both teams must have members of their own, or "the only
 * bridge" is just "the only member".
 */
const singleBridgeFindings = (
  memberships: readonly OrganizationTeamMembershipRecord[],
  principals: readonly DirectoryUserRow[]
): readonly AdminOrganisationGraphFinding[] =>
  teamPairs(memberships).flatMap(({ left, right }) => {
    const inLeft = memberships.filter((m) => m.teamName === left).map((m) => m.userId)
    const inRight = memberships.filter((m) => m.teamName === right).map((m) => m.userId)
    const shared = unique(inLeft.filter((userId) => inRight.includes(userId)))
    const bridge = shared[0]
    if (shared.length !== 1 || bridge === undefined) return []
    if (inLeft.length < 2 || inRight.length < 2) return []
    const row = principals.find((principal) => principal.id === bridge)
    const name = row === undefined ? UNNAMED_PRINCIPAL_LABEL : principalLabel(row)
    return [
      {
        id: `finding:single-bridge:${left}:${right}`,
        kind: 'single-bridge' as const,
        severity: 'notice' as const,
        blastRadius: 1,
        subjects: [name, left, right],
        message: `${name} is the only person standing in both "${left}" and "${right}".`,
      },
    ]
  })

/**
 * Rank a blast radius for ordering.
 *
 * `"unbounded"` ranks as positive infinity, which is exactly the rule: an
 * anonymous exposure sorts above every finite count, however large.
 */
const blastRank = (radius: AdminOrganisationGraphFinding['blastRadius']): number =>
  radius === 'unbounded' ? Number.POSITIVE_INFINITY : radius

/**
 * Everything the map found, ordered by blast radius descending.
 *
 * The sort is stable, so findings of equal radius keep the order their
 * producers emitted them in — which is what makes the list reproducible between
 * two reads of an unchanged instance.
 */
export const deriveFindings = (
  targets: readonly ResourceTarget[],
  principals: readonly DirectoryUserRow[],
  memberships: readonly OrganizationTeamMembershipRecord[]
): readonly AdminOrganisationGraphFinding[] =>
  [
    ...publicWriteFindings(targets),
    ...openRungReadFindings(targets, principals.length),
    ...singleBridgeFindings(memberships, principals),
  ].toSorted((left, right) => blastRank(right.blastRadius) - blastRank(left.blastRadius))
