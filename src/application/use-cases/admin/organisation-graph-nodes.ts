/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The NODES of the console's Organisation graph: resources, people, the role
 * and team vocabularies, the open rung, agents and automation lanes.
 *
 * The node-id vocabulary, the grant-source fold and the resource targets are
 * `organisation-graph-projection.ts`; the edges are
 * `organisation-graph-edges.ts`. The role and team vocabularies are closed
 * over what the EDGES name (they take the edges as input), which is what keeps
 * every edge endpoint drawable.
 */

import {
  OPEN_NODE_ID,
  ROLE_NODE_PREFIX,
  TEAM_NODE_PREFIX,
  agentNodeId,
  agentResourceNodeId,
  automationNodeId,
  personNodeId,
  principalLabel,
  principalRole,
  roleNodeId,
  stepNodeId,
  teamNodeId,
  unique,
  type AppAgent,
  type AppAutomation,
  type ResourceTarget,
} from '@/application/use-cases/admin/organisation-graph-projection'
import { BUILT_IN_ROLES, BUILT_IN_ROLE_LEVELS } from '@/domain/models/app/auth/roles/role'
import type { OrganizationTeamMembershipRecord } from '@/application/ports/repositories/auth/organization-team-repository'
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
import type { AdminOrganisationGraphEdge } from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'
import type { ProjectedNode } from '@/domain/models/app/admin/organisation-graph-denormalisation-service'

// ─── Resources and people ───────────────────────────────────────────────────

/** The drawable node for one resource target. */
export const resourceNodes = (targets: readonly ResourceTarget[]): readonly ProjectedNode[] =>
  targets.map((target) => ({
    id: target.nodeId,
    kind: target.kind,
    label: target.label,
    family: target.family,
  }))

export const personNodes = (rows: readonly DirectoryUserRow[]): readonly ProjectedNode[] =>
  rows.map((row) => ({
    id: personNodeId(row.id),
    kind: 'person' as const,
    label: principalLabel(row),
    detail: principalRole(row),
  }))

// ─── Vocabulary closure ─────────────────────────────────────────────────────

/** Every name an edge endpoint carries under one node-id prefix. */
const namesReferencedBy = (
  edges: readonly AdminOrganisationGraphEdge[],
  prefix: string
): readonly string[] =>
  edges
    .flatMap((edge) => [edge.from, edge.to])
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length))

/**
 * Every role name the graph must be able to draw.
 *
 * The union of the built-in ladder, the app's declared roles, every role named
 * in a grant or an escalation, and every role an account actually holds. The
 * last two are what keep the graph referential.
 */
const roleNamesOf = (
  app: App,
  principals: readonly DirectoryUserRow[],
  edges: readonly AdminOrganisationGraphEdge[]
): readonly string[] =>
  unique([
    ...BUILT_IN_ROLES,
    ...(app.auth?.roles ?? []).map((role) => role.name),
    ...(app.agents ?? []).map((agent) => agent.role),
    ...principals.map(principalRole),
    ...namesReferencedBy(edges, ROLE_NODE_PREFIX),
  ])

/** Every team name the graph must be able to draw — same closure, same reason. */
const teamNamesOf = (
  app: App,
  memberships: readonly OrganizationTeamMembershipRecord[],
  edges: readonly AdminOrganisationGraphEdge[]
): readonly string[] =>
  unique([
    ...(app.auth?.groups ?? []).map((group) => group.name),
    ...memberships.map((membership) => membership.teamName),
    ...namesReferencedBy(edges, TEAM_NODE_PREFIX),
  ])

/**
 * A role's rung on the ladder, when it has one the Matrix can sort by.
 *
 * Emitted only for a whole, non-negative level: the wire contract's `level` is
 * an `Int >= 0`, and a role declared at `12.5` must leave the key absent rather
 * than fail the response gate for everybody.
 */
const roleLevel = (app: App, name: string): number | undefined => {
  const declared = (app.auth?.roles ?? []).find((role) => role.name === name)?.level
  const level = declared ?? BUILT_IN_ROLE_LEVELS[name]
  return level !== undefined && Number.isInteger(level) && level >= 0 ? level : undefined
}

export const roleNodes = (
  app: App,
  principals: readonly DirectoryUserRow[],
  edges: readonly AdminOrganisationGraphEdge[]
): readonly ProjectedNode[] =>
  roleNamesOf(app, principals, edges).map((name) => {
    const level = roleLevel(app, name)
    return {
      id: roleNodeId(name),
      kind: 'role' as const,
      label: name,
      ...(level === undefined ? {} : { level }),
    }
  })

export const teamNodes = (
  app: App,
  memberships: readonly OrganizationTeamMembershipRecord[],
  edges: readonly AdminOrganisationGraphEdge[]
): readonly ProjectedNode[] =>
  teamNamesOf(app, memberships, edges).map((name) => {
    const members = memberships.filter((membership) => membership.teamName === name).length
    return {
      id: teamNodeId(name),
      kind: 'team' as const,
      label: name,
      // Omitted at zero rather than rendered as "0 members": `detail` may never
      // be the empty string, so absence has exactly one spelling and a count
      // that is not there is not a count of nothing.
      ...(members === 0 ? {} : { detail: members === 1 ? '1 member' : `${members} members` }),
    }
  })

/**
 * The `open` node, drawn only when something actually reaches through it.
 *
 * An instance whose every grant names a role or a team has no open rung, and a
 * node with no edges on it would invite the operator to look for a path that
 * does not exist.
 */
export const openNodes = (
  edges: readonly AdminOrganisationGraphEdge[]
): readonly ProjectedNode[] =>
  edges.some((edge) => edge.from === OPEN_NODE_ID)
    ? [
        {
          id: OPEN_NODE_ID,
          kind: 'open' as const,
          label: 'Everyone',
          detail: 'Reached without naming anybody in particular',
        },
      ]
    : []

// ─── Agents ─────────────────────────────────────────────────────────────────

/**
 * An agent is TWO nodes, and collapsing them would draw a self-loop where the
 * truth is a grant: `agent` is the principal that acts, `agent-resource` is the
 * same agent seen as a thing that can be invoked.
 */
export const agentNodes = (agents: readonly AppAgent[]): readonly ProjectedNode[] =>
  agents.flatMap((agent) => [
    { id: agentNodeId(agent.name), kind: 'agent' as const, label: agent.name, detail: agent.role },
    {
      id: agentResourceNodeId(agent.name),
      kind: 'agent-resource' as const,
      label: agent.name,
      family: 'agents' as const,
      state: agent.enabled === false ? ('disabled' as const) : ('active' as const),
    },
  ])

// ─── Automations ────────────────────────────────────────────────────────────

/**
 * A lane's operational state, on a read that actually saw the pause ledger.
 *
 * `active` is emitted explicitly rather than left absent, because "this
 * automation is running" and "this read could not tell" must not share a
 * spelling — which is exactly why the caller omits the key entirely when the
 * ledger was unreadable.
 */
const automationState = (
  automation: AppAutomation,
  paused: ReadonlySet<string>
): 'active' | 'paused' | 'disabled' => {
  if (paused.has(automation.name)) return 'paused'
  return automation.enabled === false ? 'disabled' : 'active'
}

/**
 * An automation lane and its stations.
 *
 * `paused` is `undefined` when the pause ledger could not be read, and the node
 * then ships with NO `state` key at all: emitting `active` would assert that
 * nothing is paused on the strength of a read that failed.
 */
export const automationNodes = (
  automations: readonly AppAutomation[],
  paused: ReadonlySet<string> | undefined
): readonly ProjectedNode[] =>
  automations.flatMap((automation) => [
    {
      id: automationNodeId(automation.name),
      kind: 'automation' as const,
      label: automation.name,
      ...(automation.label === undefined ? {} : { detail: automation.label }),
      ...(paused === undefined ? {} : { state: automationState(automation, paused) }),
    },
    ...automation.actions.map((action, index) => ({
      id: stepNodeId(automation.name, index),
      kind: 'step' as const,
      label: action.name,
    })),
  ])
