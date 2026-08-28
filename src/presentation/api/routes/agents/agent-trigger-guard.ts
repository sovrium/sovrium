/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may invoke — or read back — a declared agent.
 *
 * `agent.permissions.trigger` has been in `AppSchema` and in the published docs
 * since agents shipped, describing itself as "Who can trigger this agent",
 * `'all'` / `'authenticated'` / role array. Nothing read it. Every
 * `/api/agents/*` invocation and readback route was reachable with no caller
 * identity at all, which meant an anonymous request drove the operator's LLM on
 * the operator's key, and — worse — read back every agent's `systemPrompt`,
 * `taskPrompt` and tool allowlist: precisely the material needed to aim a prompt
 * injection at the unauthenticated execute path. This module is the gate that
 * grant always described.
 *
 * ## Three decisions the ladder itself does not make
 *
 * **1. Undeclared means `'authenticated'`, normalised HERE rather than through
 * an `UndeclaredPolicy`.** There are six named undeclared policies and not one
 * of them means "any session" — they are `deny`, `open`, `admin-only`,
 * `member-only`, `any-non-viewer` and a caller-computed grant. Rather than mint
 * a seventh variant for a single call site, the absent grant is normalised to
 * the `'authenticated'` rung before evaluation, so the ladder sees a declared
 * permission and the policy's undeclared branch is unreachable. Secure by
 * default without being a hard lock: an operator who wants a public agent says
 * so with `trigger: 'all'`.
 *
 * The default can never brick a deployment, because an app that declares
 * `agents` without `auth` is rejected at boot — there
 * is always a way to hold a session.
 *
 * **2. `evaluatePermission`, never `hasPermission`.** The predecessor's own
 * docstring says it is "ONLY VALID FOR AN ALREADY-AUTHENTICATED CALLER": its
 * signature carries a bare `userRole: string` with no way to express "no
 * session", so `'authenticated'` is satisfied unconditionally there. A gate
 * built on it would admit every anonymous caller at exactly the rung meant to
 * be the secure default. `evaluatePermission`'s optional caller is what makes
 * anonymity representable, which is the whole reason that module exists.
 *
 * **3. `unauthorized` and `denied` both collapse to 404.** The evaluator
 * deliberately splits them so a caller can answer 401 ("sign in") where that
 * leaks nothing. This surface must not: the agent NAME is in the URL, so a
 * distinguishable status would let an anonymous caller enumerate a deployment's
 * agents. Collapsing the two is the call site's job, and it is done here.
 */

import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  classifyPermissionRung,
  DENY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  SESSION_WITH_UNRESOLVED_ROLE,
} from '@/domain/models/shared/permission-evaluation'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { agentNotFound } from './agent-lookup'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { PermissionValue } from '@/domain/models/shared/permissions'
import type { Context } from 'hono'

/**
 * What an agent that declares no `permissions.trigger` grants: any signed-in
 * caller, and nobody else. Normalised into a declared rung — see the module
 * docstring, decision 1.
 */
const UNDECLARED_TRIGGER: PermissionValue = 'authenticated'

/**
 * `admin-outranks-role-list` mirrors the table-permission behaviour this path
 * already follows elsewhere: an admin satisfies any declared role array.
 *
 * `whenUndeclared` is unreachable — every value reaching the evaluator has been
 * normalised above — but the policy pair is required by design, so the
 * secure-by-default variant is named rather than an arbitrary one.
 */
const TRIGGER_POLICY = {
  whenUndeclared: DENY_WHEN_UNDECLARED,
  adminOverride: 'admin-outranks-role-list',
} as const

/**
 * Evaluate one permission against the request's caller.
 *
 * The `getUserRole` round-trip is deferred until the ladder will actually read
 * a role: `'all'`, `'authenticated'` and (post-normalisation) nothing else are
 * decidable from session presence alone, so a public or merely-signed-in agent
 * costs no database query. Same shape as the bucket-file gate.
 */
const isPermitted = async (c: Readonly<Context>, permission: PermissionValue): Promise<boolean> => {
  const session = getSessionContext(c as Context)
  if (classifyPermissionRung(permission) !== 'roles') {
    const caller = session ? SESSION_WITH_UNRESOLVED_ROLE : undefined
    return permits(evaluatePermission(permission, caller, TRIGGER_POLICY))
  }
  if (!session) return permits(evaluatePermission(permission, undefined, TRIGGER_POLICY))
  const role = await getUserRole(session.userId)
  return permits(evaluatePermission(permission, { role }, TRIGGER_POLICY))
}

/** May this request's caller invoke or read back this agent? */
export const mayTriggerAgent = (c: Readonly<Context>, agent: Agent): Promise<boolean> =>
  isPermitted(c, agent.permissions?.trigger ?? UNDECLARED_TRIGGER)

/**
 * The gate itself: a 404 refusal when the caller may not reach the agent,
 * `undefined` when the request may proceed.
 *
 * Placement is as load-bearing as existence. It must run FIRST — before the
 * inert-provider 503, before the disabled-agent 403, and before the rate and
 * budget limiters. Every one of those answers differently for a declared agent
 * than for an undeclared one, so any of them running ahead of the gate is the
 * enumeration oracle back again; and the two limiters RECORD the attempt they
 * admit, so a gate placed after them would let a refused caller burn a
 * legitimate agent's whole per-minute window — a denial of service reachable by
 * someone the gate had just refused ([internal ref] measures exactly
 * that ordering).
 */
export const checkTriggerPermission = async (
  c: Readonly<Context>,
  agent: Agent
): Promise<Response | undefined> =>
  (await mayTriggerAgent(c, agent)) ? undefined : agentNotFound(c)

/**
 * The gate for the agent COLLECTION (`GET /api/agents`), which names no agent
 * and so has no `trigger` grant to consult.
 *
 * Requires a session, full stop — including on a deployment that declares a
 * `trigger: 'all'` agent. `'all'` opens one agent to INVOCATION; it does not
 * open the deployment's inventory to enumeration, and the inventory is the
 * enumeration surface itself. Callers that clear this
 * gate still see only the agents they may individually trigger.
 */
export const checkAgentListPermission = async (
  c: Readonly<Context>
): Promise<Response | undefined> =>
  (await isPermitted(c, UNDECLARED_TRIGGER)) ? undefined : agentNotFound(c)
