/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The EDGES of the console's Organisation graph: grants, triggers,
 * memberships, escalations and automation stations.
 *
 * The nodes, the node-id vocabulary and the grant-source fold they share are
 * `organisation-graph-projection.ts`; both halves are total, and the caller
 * (`organisation-graph.ts`) owns the reads. Every edge endpoint is spelled with
 * the projection's id builders, so referential integrity — every `from` and
 * `to` resolving to a drawn node — stays one module's vocabulary.
 */

import {
  OP_ORDER,
  agentNodeId,
  agentResourceNodeId,
  automationNodeId,
  edgeId,
  grantSourceNodeId,
  grantSourcesOf,
  personNodeId,
  principalRole,
  roleNodeId,
  stepNodeId,
  teamNodeId,
  type AppAgent,
  type AppAutomation,
  type GrantSource,
  type ResourceTarget,
} from '@/application/use-cases/admin/organisation-graph-projection'
import type { OrganizationTeamMembershipRecord } from '@/application/ports/repositories/auth/organization-team-repository'
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
import type { AdminOrganisationGraphEdge } from '@/domain/models/api/admin/organisation/graph'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'

// ─── Grants and triggers ────────────────────────────────────────────────────

/** Fold every operation grant on one resource into ONE edge per grant source. */
const grantEdgesFor = (target: ResourceTarget): readonly AdminOrganisationGraphEdge[] => {
  const pairs = target.grants.flatMap((grant) =>
    grantSourcesOf(grant.permission).map((source) => ({ source, op: grant.op }))
  )
  const sources = pairs.reduce<readonly GrantSource[]>(
    (acc, pair) =>
      acc.some((known) => grantSourceNodeId(known) === grantSourceNodeId(pair.source))
        ? acc
        : [...acc, pair.source],
    []
  )
  return sources.flatMap((source) => {
    const from = grantSourceNodeId(source)
    const ops = OP_ORDER.filter((op) =>
      pairs.some((pair) => pair.op === op && grantSourceNodeId(pair.source) === from)
    ).join('')
    // An edge with no letters claims a permission nobody declared, so it is not
    // drawn at all — which is also what keeps `ops` present on exactly the
    // `grant` edges.
    if (ops.length === 0) return []
    return [
      {
        id: edgeId('grant', from, target.nodeId),
        from,
        to: target.nodeId,
        kind: 'grant' as const,
        ops,
        ...(source.kind === 'open' ? { viaOpenRung: true } : {}),
      },
    ]
  })
}

export const grantEdges = (
  targets: readonly ResourceTarget[]
): readonly AdminOrganisationGraphEdge[] => targets.flatMap(grantEdgesFor)

/**
 * `trigger` edges from whoever may invoke a thing to the thing itself. An
 * agent's `'none'` admits no person, so it draws no edge.
 */
const triggerEdgesFor = (
  permission: PermissionValue | 'none' | undefined,
  targetNodeId: string
): readonly AdminOrganisationGraphEdge[] =>
  (permission === 'none' ? [] : grantSourcesOf(permission)).map((source) => ({
    id: edgeId('trigger', grantSourceNodeId(source), targetNodeId),
    from: grantSourceNodeId(source),
    to: targetNodeId,
    kind: 'trigger' as const,
  }))

// ─── Principals ─────────────────────────────────────────────────────────────

export const personEdges = (
  rows: readonly DirectoryUserRow[],
  memberships: readonly OrganizationTeamMembershipRecord[]
): readonly AdminOrganisationGraphEdge[] => [
  ...rows.map((row) => ({
    id: edgeId('member', personNodeId(row.id), roleNodeId(principalRole(row))),
    from: personNodeId(row.id),
    to: roleNodeId(principalRole(row)),
    kind: 'member' as const,
  })),
  ...memberships.map((membership) => ({
    id: edgeId('member', personNodeId(membership.userId), teamNodeId(membership.teamName)),
    from: personNodeId(membership.userId),
    to: teamNodeId(membership.teamName),
    kind: 'member' as const,
  })),
]

// ─── Agents ─────────────────────────────────────────────────────────────────

/** The escalation an agent's approval workflow declares, when it declares one. */
const escalationEdges = (agent: AppAgent): readonly AdminOrganisationGraphEdge[] => {
  const escalation = agent.approval?.escalation
  if (escalation === undefined) return []
  return [
    {
      id: edgeId('escalation', agentNodeId(agent.name), roleNodeId(escalation.to)),
      from: agentNodeId(agent.name),
      to: roleNodeId(escalation.to),
      kind: 'escalation' as const,
    },
  ]
}

export const agentEdges = (agents: readonly AppAgent[]): readonly AdminOrganisationGraphEdge[] =>
  agents.flatMap((agent) => [
    {
      id: edgeId('member', agentNodeId(agent.name), roleNodeId(agent.role)),
      from: agentNodeId(agent.name),
      to: roleNodeId(agent.role),
      kind: 'member' as const,
    },
    ...triggerEdgesFor(agent.permissions?.trigger, agentResourceNodeId(agent.name)),
    ...escalationEdges(agent),
  ])

// ─── Automations ────────────────────────────────────────────────────────────

/** The lane and its stations: automation -> step 1 -> step 2 -> ... */
const stepEdgesFor = (automation: AppAutomation): readonly AdminOrganisationGraphEdge[] =>
  automation.actions.map((_action, index) => {
    const from =
      index === 0 ? automationNodeId(automation.name) : stepNodeId(automation.name, index - 1)
    const to = stepNodeId(automation.name, index)
    return { id: edgeId('step', from, to), from, to, kind: 'step' as const }
  })

export const automationEdges = (
  automations: readonly AppAutomation[]
): readonly AdminOrganisationGraphEdge[] =>
  automations.flatMap((automation) => [
    ...stepEdgesFor(automation),
    ...triggerEdgesFor(automation.permissions?.trigger, automationNodeId(automation.name)),
  ])
