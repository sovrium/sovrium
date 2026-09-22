/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Identity of the agents an app exposes as CONVERSATION SOURCES, shared by the
 * admin agent index (`GET /api/admin/agents`) and the Conversations surface so
 * the sidebar can never enumerate a different set than the page renders.
 *
 * An agent here is a conversation SOURCE, not only a declaration. That is the
 * whole difference from {@link declaredBucketNames}, whose fallback is
 * exclusive — and the reason this one is INCLUSIVE.
 *
 * A bucket's `default` is a fallback: an app that declares three buckets never
 * writes into a phantom fourth prefix, so a fallback beside three declarations
 * would be a lie. Conversations do not behave that way. `POST /api/ai/chat` is
 * registered UNCONDITIONALLY (`api-routes.ts` — "Always registered") and is
 * reachable whether or not `app.agents` is declared, so a turn that names NO
 * agent persists `agent_name` NULL — and nothing about declaring agents stops
 * those turns from arriving.
 *
 * Measured, not reasoned (probe against an app that DECLARED
 * `support-assistant`):
 *
 *   /api/ai/chat  { message }                          → agent_name NULL
 *   /api/ai/chat  { message, agent: 'support-assistant' } → 'support-assistant'
 *   /api/agents/support-assistant/chat { message }     → 'support-assistant'
 *
 * HISTORY, because the middle row used to read NULL and the argument below was
 * built on it: the agent-bound branch of `/api/ai/chat` once persisted through
 * a writer with no `agentName` parameter, so naming a declared agent still
 * produced an unattributed row. That is fixed — attribution is now an optional
 * field of the SINGLE writer `persistChatTurnDurably`, and
 * `[internal ref]` pins it in both directions across both transports.
 *
 * The conclusion is unchanged, but it no longer rests on that row. It rests on
 * the FIRST row, which no fix can retire: an agent-less turn is always
 * reachable, so an app accumulates NULL-agent conversations continuously
 * regardless of what it declares. An EXCLUSIVE default would make every one of
 * those rows unreachable from the console the moment the operator declared
 * their first agent — hiding real operator data. So the default agent is
 * always present, alongside any declarations.
 *
 * The default agent's view is the `agent_name IS NULL` set. It is a REAL view
 * over real rows, not a placeholder, which is the other reason it is not
 * conditional on the app declaring nothing.
 */

/**
 * Name of the general-purpose agent that owns every conversation no declared
 * agent claimed — the `agent_name IS NULL` set.
 *
 * Reserved: an operator may NOT declare an agent with this name. A declared
 * `default` would carry rows stamped `agent_name = 'default'` while the virtual
 * default view carries rows with `agent_name IS NULL` — two different row sets
 * behind one name and one URL. Silently merging them is the very data-hiding
 * this module exists to prevent, and silently letting the declaration shadow the
 * virtual view hides more. Rejecting the name at config validation is the only
 * option that keeps both sets addressable.
 */
export const DEFAULT_AGENT_NAME = 'default'

/** Whether `name` is the reserved general-purpose agent name. */
export function isDefaultAgentName(name: string): boolean {
  return name === DEFAULT_AGENT_NAME
}

/**
 * The names of the agents an app exposes as conversation sources: the
 * general-purpose {@link DEFAULT_AGENT_NAME} FIRST, then every declaration in
 * `app.agents[]` in declaration order.
 *
 * INCLUSIVE — the default is always present, because the NULL-agent rows it
 * views accumulate regardless of what the app declares (see the module header).
 * Declaration order is preserved so the console lists agents in the order the
 * operator wrote them; the default leads because it is the landing view and the
 * only one guaranteed to exist.
 *
 * A declared agent named `default` is rejected upstream at config validation, so
 * this function never has to decide which of two same-named sets wins.
 */
export function declaredAgentNames(
  agents: ReadonlyArray<{ readonly name: string }> | undefined
): ReadonlyArray<string> {
  if (agents === undefined || agents.length === 0) return [DEFAULT_AGENT_NAME]
  return [DEFAULT_AGENT_NAME, ...agents.map((agent) => agent.name)]
}

/**
 * Is `name` an agent this app exposes as a conversation source — i.e. one of
 * {@link declaredAgentNames}?
 *
 * The per-agent anti-enum predicate for the admin `/api/admin/agents/:name/*`
 * reads. It replaces a bare `app.agents` membership test, which 404s the
 * reserved `default` because the general-purpose agent has no declaration to
 * find — while still 404ing a genuinely undeclared name, since it admits
 * exactly the set the index advertises and nothing more.
 *
 * Deriving it from `declaredAgentNames` rather than special-casing `default`
 * beside a second membership test is what makes "the sidebar can never
 * advertise an agent whose page 404s" a structural property instead of a pair
 * of lists someone must remember to keep in step.
 */
export function isConversationSourceAgent(
  agents: ReadonlyArray<{ readonly name: string }> | undefined,
  name: string
): boolean {
  return declaredAgentNames(agents).includes(name)
}
