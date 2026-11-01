/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who can reach an agent, and what that forbids it to hold.
 *
 * An agent is addressable by people unless its `permissions.trigger` is
 * `'none'`: then no one may chat with it, call it or decide for it, and it runs
 * only from automation `ai/agent` steps and its own `schedule`. Code is the one
 * action an addressable agent may not hold: code an operator writes into an
 * automation step is the operator's, while code a model writes in reply to a
 * person is that person's, run on the server with its files.
 */

/** The action that runs code on the server. */
const CODE_ACTION = 'code.runTypescript'

/** The part of an agent this rule reads. */
interface AgentReach {
  readonly name: string
  readonly tools?: { readonly actions: ReadonlyArray<string> } | undefined
  readonly permissions?: { readonly trigger?: unknown } | undefined
}

/** Is the agent reachable only by automations and its schedule, by no person? */
export const isAutomationOnlyAgent = (agent: Pick<AgentReach, 'permissions'>): boolean =>
  agent.permissions?.trigger === 'none'

/**
 * Why the agent may not be declared as it is, or `undefined` when it may: an
 * agent people can reach that lists the code action.
 */
export const codeOnAddressableAgentMessage = (agent: AgentReach): string | undefined =>
  agent.tools?.actions.includes(CODE_ACTION) === true && !isAutomationOnlyAgent(agent)
    ? `Agent '${agent.name}' lists '${CODE_ACTION}' in tools.actions, but people can reach it (permissions.trigger is not 'none'). An agent people can address may not run code: run the code in an automation's code/runTypescript step, or set permissions.trigger: 'none' so only automations and its schedule use this agent.`
    : undefined
