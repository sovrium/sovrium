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
 * This module holds what the two halves share: the node-id vocabulary, the
 * grant-source fold and the resource targets read off the config. The nodes
 * are `organisation-graph-nodes.ts`, the edges `organisation-graph-edges.ts`.
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
import type { DirectoryUserRow } from '@/application/ports/repositories/tables/users-directory-repository'
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

export const ROLE_NODE_PREFIX = 'role:'
export const TEAM_NODE_PREFIX = 'team:'

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

export const personNodeId = (userId: string): string => `person:${userId}`
export const agentNodeId = (name: string): string => `agent:${name}`
export const agentResourceNodeId = (name: string): string => `agent-resource:${name}`
export const automationNodeId = (name: string): string => `automation:${name}`
export const stepNodeId = (automation: string, index: number): string =>
  `step:${automation}:${index}`

export const edgeId = (kind: string, from: string, to: string): string => `${kind}:${from}->${to}`

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
export interface GrantSource {
  readonly kind: 'role' | 'team' | 'open'
  /** The role or team name; empty for the open rung, which names nobody. */
  readonly name: string
}

const OPEN_GRANT_SOURCE: GrantSource = { kind: 'open', name: '' }

/** The node a grant source is drawn as. */
export const grantSourceNodeId = (source: GrantSource): string => {
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
export const grantSourcesOf = (permission: PermissionValue | undefined): readonly GrantSource[] => {
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
export type AppAgent = NonNullable<App['agents']>[number]
export type AppAutomation = NonNullable<App['automations']>[number]

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

// ─── Principals ─────────────────────────────────────────────────────────────

/** The role an account acts under, with the platform default filled in. */
export const principalRole = (row: DirectoryUserRow): string =>
  typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_PRINCIPAL_ROLE

/** The display name an account is drawn by — never its address (S4). */
export const principalLabel = (row: DirectoryUserRow): string =>
  typeof row.name === 'string' && row.name.trim().length > 0 ? row.name : UNNAMED_PRINCIPAL_LABEL
