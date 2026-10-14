/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an agent turn is built from, the same on every surface: the system
 * prompt an agent runs under, the tools it is offered, and how a tool call the
 * model makes becomes an action the automation engine runs.
 *
 * A tool is named exactly after the agent action it runs (`record.create`), so
 * the advertised list mirrors the allowlist verbatim: an action outside the
 * allowlist simply has no tool.
 */

import { AgentActionSchema } from './tools'
import type { Agent } from './agent'
import type { ChatToolDefinition } from './ai-chat-tools'

/** The agent action names, as declared by `AgentActionSchema`. */
const AGENT_ACTIONS: ReadonlySet<string> = new Set(AgentActionSchema.literals)

/** Is this tool name one of the agent actions (`record.create`, `email.send`, …)? */
export const isAgentActionName = (name: string): boolean => AGENT_ACTIONS.has(name)

/**
 * Does this action keep its values per automation, so that it can only run
 * inside an automation run? `state.*` reads and writes a store keyed by the
 * run's automation; a chat turn, a scheduled run or a resumed approval has no
 * automation, and a key it wrote would belong to nobody.
 */
export const needsAutomationRun = (action: string): boolean => action.startsWith('state.')

/** An agent action as the automation engine names its handler: `record.create` → `record`/`create`. */
export const agentActionKey = (
  action: string
): { readonly type: string; readonly operator: string } => {
  const dot = action.indexOf('.')
  return dot < 0
    ? { type: action, operator: '' }
    : { type: action.slice(0, dot), operator: action.slice(dot + 1) }
}

/**
 * The capability block appended to an agent's prompt: the tables and actions
 * it may use, so the model knows the constraints it works within.
 */
const capabilityContext = (agent: Agent): readonly string[] =>
  agent.tools === undefined
    ? []
    : [
        '',
        'Your capabilities are restricted to the following allowlist:',
        `- Tables you may access: ${agent.tools.tables.join(', ')}`,
        `- Actions you may perform: ${agent.tools.actions.join(', ')}`,
      ]

/**
 * The agent's system prompt: its own prompt, its behavioural `instructions` as
 * a numbered list, then its capability block.
 */
export const buildAgentSystemPrompt = (agent: Agent): string => {
  const instructions = (agent.instructions ?? []).map(
    (rule, index) => `${String(index + 1)}. ${rule}`
  )
  return [
    agent.systemPrompt,
    ...(instructions.length > 0 ? ['', ...instructions] : []),
    ...capabilityContext(agent),
  ].join('\n')
}

/**
 * How each action is described to the model, where its name alone would leave
 * it guessing. `record.read` and `record.list` in particular would otherwise
 * read alike, and a model that picks the wrong one sweeps a table or is refused.
 */
const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'record.read':
    'Fetch exactly ONE record by its id. Requires `table` and `id`. ' +
    'Cannot filter, sort, or return multiple records — use record.list for that.',
  'record.list':
    'Fetch a SET of records matching conditions. Takes `table`, and optionally ' +
    '`filter`, `sort` and `limit`; returns zero or more records. ' +
    'Use record.read instead when you already know the exact record id.',
  'record.create': 'Create a record. Takes `table` and `fields`, an object of field values.',
  'record.update':
    'Update a record. Takes `table`, `id`, and `fields`, an object of the values to change.',
  'record.delete': 'Delete a record. Takes `table` and `id`.',
  'http.request':
    'Send an HTTP request. Takes `method`, `url`, and optionally `headers` and `body`.',
  'email.send': 'Send an email. Takes `to`, `subject`, and `body` (plain text or HTML).',
}

/** The tools an agent is offered: one per allowlisted action, scoped to its tables. */
export const buildAgentActionTools = (agent: Agent): readonly ChatToolDefinition[] => {
  const { tools } = agent
  if (tools === undefined) return []
  const tableList = tools.tables.join(', ')
  return tools.actions.map((action) => ({
    type: 'function' as const,
    function: {
      name: action,
      description: `${
        ACTION_DESCRIPTIONS[action] ?? `Perform the "${action}" operation.`
      } Allowlisted tables: ${tableList}.`,
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', description: `One of the allowlisted tables: ${tableList}.` },
        },
        additionalProperties: true,
      },
    },
  }))
}

/** The table a tool call names, when it names one. */
export const toolCallTable = (args: Readonly<Record<string, unknown>>): string | undefined =>
  typeof args['table'] === 'string' ? args['table'] : undefined

/** A record id however the model named it, as the string the record actions read. */
const withRecordId = (
  args: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const rawId = args['id'] ?? args['recordId']
  return typeof rawId === 'string' || typeof rawId === 'number'
    ? { ...args, id: String(rawId) }
    : args
}

/** An email's text however the model named it, as the `body` the email action reads. */
const withEmailBody = (
  args: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  if (args['body'] !== undefined) return args
  const body = args['text'] ?? args['html']
  return typeof body === 'string' ? { ...args, body } : args
}

/**
 * A model's tool arguments as the action's props.
 *
 * Models name the same thing in more than one way: a record's id as `id` or
 * `recordId`, numeric or not; an email's content as `body`, `text` or `html`.
 * Each is folded onto the prop its action reads.
 */
export const toActionProps = (
  action: string,
  args: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  action === 'email.send' ? withEmailBody(args) : withRecordId(args)
