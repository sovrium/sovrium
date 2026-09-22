/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The PURE half of the console's Organisation read: the fold from the live app
 * config plus the three resolved runtime populations onto the nodes and edges
 * of one access graph.
 *
 * Split from `organisation-graph.ts` because the two halves fail differently.
 * Everything here is total — it reads values that are already in hand and
 * cannot throw, cannot hang and needs no service — while its caller owns the
 * three reads that can do all three. Keeping the fold testable without a
 * database is the point.
 *
 * ─── THE GRANT FOLD IS NOT REIMPLEMENTED HERE ───────────────────────────────
 *
 * `permission-evaluation.ts` already owns what a permission value MEANS, and
 * this module reads it through that module's own predicates rather than
 * comparing against the ladder literals. A second grant-resolution path would
 * be a second answer to "who can reach what", and the two would drift — which
 * is the defect `sovrium/no-inline-permission-ladder` exists to make
 * impossible.
 *
 * ─── REFERENTIAL INTEGRITY IS THIS MODULE'S JOB ─────────────────────────────
 *
 * Every `from` and every `to` must resolve to a node in the same body. A schema
 * cannot express a cross-field reference, so the invariant lives here: the role
 * and team vocabularies are closed over what the edges actually NAME, not only
 * over what the config declares. An edge pointing at an id that was filtered
 * out draws a line to nowhere, which a lens renders as a silently missing
 * relationship rather than as an error.
 *
 * @see src/application/use-cases/admin/organisation-graph.ts (the reads and the assembly)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import {
  isOpenToEveryone,
  requiresOnlyASession,
} from '@/domain/models/app/auth/permission-evaluation'
import { BUILT_IN_ROLES, BUILT_IN_ROLE_LEVELS } from '@/domain/models/app/auth/roles/role'
import type { OrganizationTeamMembershipRecord } from '@/application/ports/repositories/auth/organization-team-repository'
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
import type {
  AdminOrganisationGraphEdge,
  AdminOrganisationGraphNode,
} from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'

// ─── Identity ───────────────────────────────────────────────────────────────

/**
 * The single `open` node — the `*` / everyone / any-session rung.
 *
 * A NODE rather than a flag so that "reached without being anybody in
 * particular" is a visible path on the map instead of a footnote.
 */
export const OPEN_NODE_ID = 'open'

const ROLE_NODE_PREFIX = 'role:'
const TEAM_NODE_PREFIX = 'team:'

export const roleNodeId = (name: string): string => `${ROLE_NODE_PREFIX}${name}`
export const teamNodeId = (name: string): string => `${TEAM_NODE_PREFIX}${name}`

/**
 * The node a table is drawn as.
 *
 * EXPORTED rather than spelled inline in {@link tableTarget}, because the
 * exceptions projection addresses the same node from a different module: an
 * `exceptions[].resourceNodeId` must resolve to a `nodes[].id`, and two
 * independent spellings of one id is how that invariant breaks on the first
 * rename — silently, since a dangling reference is a missing highlight rather
 * than an error.
 */
export const tableNodeId = (name: string): string => `table:${name}`

const personNodeId = (userId: string): string => `person:${userId}`
const agentNodeId = (name: string): string => `agent:${name}`
const agentResourceNodeId = (name: string): string => `agent-resource:${name}`
const automationNodeId = (name: string): string => `automation:${name}`
const stepNodeId = (automation: string, index: number): string => `step:${automation}:${index}`

const edgeId = (kind: string, from: string, to: string): string => `${kind}:${from}->${to}`

/**
 * The fallback role for an account whose `auth.user.role` column is NULL or
 * empty — the platform's default registration role. Mirrors the users
 * directory's own coalescing so the two surfaces never disagree about what an
 * unlabelled account is.
 */
const DEFAULT_PRINCIPAL_ROLE = 'member'

/**
 * What a `person` node is labelled when the account carries no display name.
 *
 * Deliberately NOT the email address. Falling back to the address is the single
 * likeliest way an account identifier reaches this body (S4), and it would do
 * so exactly on the accounts nobody bothered to name.
 */
export const UNNAMED_PRINCIPAL_LABEL = 'Unnamed account'

/** Unique, order-preserving. */
export const unique = (values: readonly string[]): readonly string[] => [...new Set(values)]

// ─── Grant sources ──────────────────────────────────────────────────────────

/** Where a grant comes FROM: a named role, a named team, or the open rung. */
interface GrantSource {
  readonly kind: 'role' | 'team' | 'open'
  /** The role or team name; empty for the open rung, which names nobody. */
  readonly name: string
}

const OPEN_GRANT_SOURCE: GrantSource = { kind: 'open', name: '' }

/** The node a grant source is drawn as. */
const grantSourceNodeId = (source: GrantSource): string => {
  if (source.kind === 'open') return OPEN_NODE_ID
  return source.kind === 'role' ? roleNodeId(source.name) : teamNodeId(source.name)
}

/** Prefix marking a `group:<name>` reference inside a declared role array. */
const GROUP_REFERENCE_PREFIX = 'group:'

/**
 * Resolve one permission value into the grant sources that satisfy it.
 *
 * An UNDECLARED permission yields nothing at all: secure-by-default is the only
 * reading that does not invent a grant the operator never wrote, and a drawn
 * edge is a claim that somebody can reach something.
 */
const grantSourcesOf = (permission: PermissionValue | undefined): readonly GrantSource[] => {
  if (permission === undefined) return []
  // Both open rungs collapse to the one `open` node: `viaOpenRung` is about
  // "no named principal stands behind this", which `authenticated` shares.
  if (isOpenToEveryone(permission) || requiresOnlyASession(permission)) return [OPEN_GRANT_SOURCE]
  return permission.map((entry) =>
    entry.startsWith(GROUP_REFERENCE_PREFIX)
      ? { kind: 'team' as const, name: entry.slice(GROUP_REFERENCE_PREFIX.length) }
      : { kind: 'role' as const, name: entry }
  )
}

// ─── Operations ─────────────────────────────────────────────────────────────

/**
 * The closed alphabet a `grant` edge's `ops` is spelled in, in CANONICAL order.
 *
 * The Matrix fills its quadrant glyph by reading these letters, so the order is
 * part of the contract rather than an accident of iteration: `RCU` and `URC`
 * would draw the same permission two ways.
 */
export const OP_ORDER = ['R', 'C', 'U', 'D', 'W', 'AI'] as const

export type OpLetter = (typeof OP_ORDER)[number]

/** One declared operation on one resource, before it is folded by source. */
interface OperationGrant {
  readonly op: OpLetter
  readonly permission: PermissionValue | undefined
}

/** A resource node plus every operation grant declared against it. */
export interface ResourceTarget {
  readonly nodeId: string
  readonly label: string
  readonly kind: 'table' | 'page' | 'form' | 'bucket'
  readonly family: 'tables' | 'pages' | 'forms' | 'buckets'
  readonly grants: readonly OperationGrant[]
  /** Whether an exposure on this resource is a DATA exposure worth reporting. */
  readonly carriesData: boolean
}

// ─── Config projection ──────────────────────────────────────────────────────

type AppTable = NonNullable<App['tables']>[number]
type AppPage = NonNullable<App['pages']>[number]
type AppForm = NonNullable<App['forms']>[number]
type AppBucket = NonNullable<App['buckets']>[number]
type AppAgent = NonNullable<App['agents']>[number]
type AppAutomation = NonNullable<App['automations']>[number]

const tableTarget = (table: AppTable): ResourceTarget => {
  // Destructured rather than read as `table.permissions.delete`: the Drizzle
  // lint rule that guards against an unfiltered `DELETE` matches any `.delete`
  // member access, and a permission key is not a query.
  const { read, create, update, delete: remove } = table.permissions ?? {}
  return {
    nodeId: tableNodeId(table.name),
    label: table.name,
    kind: 'table',
    family: 'tables',
    grants: [
      { op: 'R', permission: read },
      { op: 'C', permission: create },
      { op: 'U', permission: update },
      { op: 'D', permission: remove },
    ],
    carriesData: true,
  }
}

/**
 * A page's access, with the documented default applied.
 *
 * `access` accepts a bare permission value OR `{ require, redirectTo }`, and an
 * omitted `access` means public — which is stated in the page schema and is
 * what the renderer actually does, so the graph would be lying if it drew an
 * undeclared page as ungranted.
 */
const pagePermission = (page: AppPage): PermissionValue => {
  const { access } = page
  if (access === undefined) return 'all'
  // `'require' in access` rather than `Array.isArray`: the extended form is the
  // only member of the union carrying that key, and `Array.isArray` narrows a
  // `readonly string[]` to a mutable `any[]`, which loses the element type the
  // role-array branch needs.
  return typeof access === 'object' && 'require' in access ? access.require : access
}

const pageTarget = (page: AppPage): ResourceTarget => ({
  nodeId: `page:${page.name}`,
  label: page.name,
  kind: 'page',
  family: 'pages',
  grants: [{ op: 'R', permission: pagePermission(page) }],
  // A page being public is usually the POINT of a page, so an open read here is
  // not a finding. A public WRITE still is, which is why `carriesData` gates the
  // read finding alone.
  carriesData: false,
})

const formTarget = (form: AppForm): ResourceTarget => ({
  nodeId: `form:${form.name}`,
  label: form.name,
  kind: 'form',
  family: 'forms',
  // An omitted `access` means the form is public — the same default the admin
  // forms catalogue reports as `accessLevel: 'public'`. Viewing is the read,
  // submitting is the write, and one grant governs both.
  grants: [
    { op: 'R', permission: form.access?.require ?? 'all' },
    { op: 'W', permission: form.access?.require ?? 'all' },
  ],
  carriesData: false,
})

const bucketTarget = (bucket: AppBucket): ResourceTarget => {
  const { download, upload, sign, delete: remove } = bucket.permissions ?? {}
  return {
    nodeId: `bucket:${bucket.name}`,
    label: bucket.name,
    kind: 'bucket',
    family: 'buckets',
    grants: [
      { op: 'R', permission: download },
      { op: 'W', permission: upload },
      // Minting a signed URL hands out a bypass of every gate above, so it is
      // folded into the WRITE letter rather than given a quieter one of its own.
      { op: 'W', permission: sign },
      { op: 'D', permission: remove },
    ],
    carriesData: true,
  }
}

export const resourceTargets = (app: App): readonly ResourceTarget[] => [
  ...(app.tables ?? []).map(tableTarget),
  ...(app.pages ?? []).map(pageTarget),
  ...(app.forms ?? []).map(formTarget),
  ...(app.buckets ?? []).map(bucketTarget),
]

/** The drawable node for one resource target. */
export const resourceNodes = (
  targets: readonly ResourceTarget[]
): readonly AdminOrganisationGraphNode[] =>
  targets.map((target) => ({
    id: target.nodeId,
    kind: target.kind,
    label: target.label,
    family: target.family,
  }))

// ─── Edges ──────────────────────────────────────────────────────────────────

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

/** `trigger` edges from whoever may invoke a thing to the thing itself. */
const triggerEdgesFor = (
  permission: PermissionValue | undefined,
  targetNodeId: string
): readonly AdminOrganisationGraphEdge[] =>
  grantSourcesOf(permission).map((source) => ({
    id: edgeId('trigger', grantSourceNodeId(source), targetNodeId),
    from: grantSourceNodeId(source),
    to: targetNodeId,
    kind: 'trigger' as const,
  }))

// ─── Principals ─────────────────────────────────────────────────────────────

/** The role an account acts under, with the platform default filled in. */
const principalRole = (row: DirectoryUserRow): string =>
  typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_PRINCIPAL_ROLE

/** The display name an account is drawn by — never its address (S4). */
export const principalLabel = (row: DirectoryUserRow): string =>
  typeof row.name === 'string' && row.name.trim().length > 0 ? row.name : UNNAMED_PRINCIPAL_LABEL

export const personNodes = (
  rows: readonly DirectoryUserRow[]
): readonly AdminOrganisationGraphNode[] =>
  rows.map((row) => ({
    id: personNodeId(row.id),
    kind: 'person' as const,
    label: principalLabel(row),
    detail: principalRole(row),
  }))

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
): readonly AdminOrganisationGraphNode[] =>
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
): readonly AdminOrganisationGraphNode[] =>
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
): readonly AdminOrganisationGraphNode[] =>
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
export const agentNodes = (agents: readonly AppAgent[]): readonly AdminOrganisationGraphNode[] =>
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
): readonly AdminOrganisationGraphNode[] =>
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
