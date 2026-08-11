/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-approval cross-validation for AppSchema.
 *
 * **Bundled into a single `validateAllAgentApprovalRules` helper** to keep the
 * AppSchema `.pipe()` chain short (TypeScript's deep-instantiation depth limit
 * is hit when too many `Schema.filter` calls stack on top of `Schema.Struct`).
 * Same pattern as `validateAllFormsReferences` and `validateAllAiAccessRules`.
 *
 * The helper uses loose-typed parameters (rather than the App type) to prevent
 * `Schema.filter` from narrowing the App type to `never` via predicate
 * type-guard inference.
 *
 * Rules enforced:
 * - [internal ref]: declaring `agents` requires `auth` to be
 *    configured (agents depend on auth for RBAC).
 * - [internal ref]: agent `name` must be unique across all agents.
 * - [internal ref]: agent `role` must reference an `auth.roles` entry
 *    (or a built-in role).
 * - [internal ref]: `mode: 'selective'` requires a `required` list.
 * - [internal ref]: `required` must be a subset of `tools.actions`.
 * - [internal ref]: `escalation.to` must reference an `auth.roles`
 *    entry.
 * - [internal ref]: `escalation.after` must be less than `timeout`.
 * - [internal ref]: every `tools.tables` entry must reference a table
 *    declared in `app.tables[]`.
 */

interface LooseEscalation {
  readonly after?: number
  readonly to?: string
}

interface LooseApproval {
  readonly mode?: string
  readonly required?: ReadonlyArray<string>
  readonly timeout?: number
  readonly escalation?: LooseEscalation
}

interface LooseTools {
  readonly tables?: ReadonlyArray<string>
  readonly actions?: ReadonlyArray<string>
}

interface LooseAgent {
  readonly name?: string
  readonly role?: string
  readonly approval?: LooseApproval
  readonly tools?: LooseTools
}

interface LooseRole {
  readonly name?: string
}

interface LooseTable {
  readonly name?: string
}

interface LooseAppForApproval {
  readonly agents?: ReadonlyArray<LooseAgent>
  readonly auth?: { readonly roles?: ReadonlyArray<LooseRole> }
  readonly tables?: ReadonlyArray<LooseTable>
}

/**
 * [internal ref]: agents depend on `auth` for RBAC (every agent
 * operates under an auth role and approval decisions are role-gated). A
 * schema that declares `agents` but omits `auth` is therefore invalid.
 */
const validateAgentsRequireAuth = (app: LooseAppForApproval): string | undefined => {
  const { agents } = app
  if (!agents || agents.length === 0) return undefined
  if (app.auth) return undefined
  return 'AI agents require auth configuration: agents operate under auth roles and approval decisions are role-gated. Configure app.auth to use agents.'
}

/**
 * [internal ref]: every agent `name` must be unique across the schema —
 * the name is the agent's API identifier and a duplicate would make the
 * `/api/agents/:name` surface ambiguous.
 */
const validateAgentNamesUnique = (agents: ReadonlyArray<LooseAgent>): string | undefined => {
  const names = agents
    .map((agent) => agent.name)
    .filter((name): name is string => name !== undefined)
  const duplicate = names.find((name, index) => names.indexOf(name) !== index)
  if (duplicate === undefined) return undefined
  return `Agent name '${duplicate}' is not unique: agent names must be unique across all agents in the schema.`
}

/**
 * [internal ref]: every agent `role` must reference a role declared in
 * `auth.roles` (or a built-in role). An agent operating under an orphan role
 * could never be RBAC-gated, so the schema is rejected at decode time.
 */
const validateAgentRolesExist = (
  agents: ReadonlyArray<LooseAgent>,
  roleNames: ReadonlySet<string | undefined>
): string | undefined => {
  const orphan = agents.find((agent) => agent.role !== undefined && !roleNames.has(agent.role))
  if (orphan === undefined) return undefined
  return `Agent '${orphan.name ?? '<unnamed>'}' references role '${orphan.role ?? ''}' which is not defined in auth.roles.`
}

/** Default approval timeout (seconds) when not explicitly configured. */
export const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 3600

/**
 * Built-in roles always available regardless of `auth.roles`. Escalation
 * targets may reference these even when no custom roles are declared.
 */
const BUILT_IN_ROLE_NAMES: ReadonlyArray<string> = ['admin', 'member', 'viewer']

/** Set of role names valid for an app (built-ins + declared `auth.roles`). */
const collectRoleNames = (app: LooseAppForApproval): ReadonlySet<string | undefined> =>
  new Set<string | undefined>([
    ...BUILT_IN_ROLE_NAMES,
    ...(app.auth?.roles ?? []).map((r) => r.name),
  ])

/** Set of table names declared in `app.tables[]`. */
const collectTableNames = (app: LooseAppForApproval): ReadonlySet<string> =>
  new Set(
    (app.tables ?? [])
      .map((table) => table.name)
      .filter((name): name is string => name !== undefined)
  )

/**
 * [internal ref]: every `tools.tables` entry must reference a table
 * declared in `app.tables[]`. An agent scoped to a phantom table could never
 * pass its allowlist gate, so the schema is rejected at decode time.
 */
const validateAgentToolTables = (
  agents: ReadonlyArray<LooseAgent>,
  app: LooseAppForApproval
): string | undefined => {
  const tableNames = collectTableNames(app)
  const orphan = agents
    .flatMap((agent) =>
      (agent.tools?.tables ?? [])
        .filter((table) => !tableNames.has(table))
        .map((table) => ({ agent: agent.name ?? '<unnamed>', table }))
    )
    .at(0)
  if (orphan === undefined) return undefined
  return `Agent '${orphan.agent}' tools.tables references table '${orphan.table}' which is not defined in app.tables[].`
}

/**
 * Validate every agent's `approval` block against the first matching rule.
 * Returns a descriptive string on the first violation, or `undefined` when all
 * agents' approval blocks pass.
 */
const validateAllApprovalBlocks = (
  agents: ReadonlyArray<LooseAgent>,
  roleNames: ReadonlySet<string | undefined>
): string | undefined =>
  agents
    .flatMap((agent) => {
      const { approval } = agent
      if (!approval) return []
      const agentName = agent.name ?? '<unnamed>'
      const violation = validateApproval(agentName, approval, agent.tools?.actions, roleNames)
      return violation === undefined ? [] : [violation]
    })
    .at(0)

/**
 * Validate every agent's `approval` block. Returns a descriptive string on the
 * first violation, or `true` when all agents pass.
 */
export const validateAllAgentApprovalRules = (app: LooseAppForApproval): string | true => {
  const { agents } = app
  if (!agents) return true

  const roleNames = collectRoleNames(app)

  // Each helper returns a descriptive string on its first violation; the first
  // defined result short-circuits the chain.
  const error =
    validateAgentsRequireAuth(app) ??
    validateAgentNamesUnique(agents) ??
    validateAgentRolesExist(agents, roleNames) ??
    validateAgentToolTables(agents, app) ??
    validateAllApprovalBlocks(agents, roleNames)

  return error ?? true
}

const validateApproval = (
  agentName: string,
  approval: LooseApproval,
  capabilityActions: ReadonlyArray<string> | undefined,
  roleNames: ReadonlySet<string | undefined>
): string | undefined => {
  const selectiveError = validateSelectiveRequired(agentName, approval, capabilityActions)
  if (selectiveError !== undefined) return selectiveError

  return validateEscalation(agentName, approval, roleNames)
}

const validateSelectiveRequired = (
  agentName: string,
  approval: LooseApproval,
  capabilityActions: ReadonlyArray<string> | undefined
): string | undefined => {
  if (approval.mode !== 'selective') return undefined

  if (!approval.required || approval.required.length === 0) {
    return `Agent '${agentName}' uses approval mode 'selective' but no 'required' actions list is configured. 'required' is mandatory when mode is selective.`
  }

  const actions = new Set(capabilityActions ?? [])
  const outsider = approval.required.find((action) => !actions.has(action))
  if (outsider !== undefined) {
    return `Agent '${agentName}' approval 'required' action '${outsider}' is not a subset of capabilities.actions. Every required action must also appear in tools.actions.`
  }

  return undefined
}

const validateEscalation = (
  agentName: string,
  approval: LooseApproval,
  roleNames: ReadonlySet<string | undefined>
): string | undefined => {
  const { escalation } = approval
  if (!escalation) return undefined

  if (escalation.to !== undefined && !roleNames.has(escalation.to)) {
    return `Agent '${agentName}' approval escalation.to references role '${escalation.to}' which is not defined in auth.roles.`
  }

  const timeout = approval.timeout ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS
  if (escalation.after !== undefined && escalation.after >= timeout) {
    return `Agent '${agentName}' approval escalation.after (${escalation.after.toString()}) must be less than timeout (${timeout.toString()}). Escalation must happen before the approval expires.`
  }

  return undefined
}
