/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { checkModelLocator } from '@/domain/models/app/automations/actions/browser/browser-locator-service'
import type { ChatToolCall, ChatToolDefinition } from '@/application/ports/services/ai-service'
import type { BrowserLocator } from '@/application/ports/services/browser-driver'

/**
 * The tools a browser agent is offered: the gestures of a
 * `browser/run` step, naming elements with the same locators, and
 * `browser_done` to report the goal reached. Plus `browser_use`, the one tool
 * a declared agent granted `browser.use` is offered in a chat.
 *
 * A tool call is checked here before the driver sees it — an unknown tool, a
 * missing argument, a locator outside the grammar — and answered as an error
 * the model reads, never acted on.
 */

/** The types an agent's result field may take. */
export type OutputType = 'string' | 'number' | 'boolean'

/** One action a model asked for, checked. */
export type AgentAction =
  | { readonly tool: 'browser_goto'; readonly url: string }
  | { readonly tool: 'browser_click'; readonly target: BrowserLocator }
  | {
      readonly tool: 'browser_fill'
      readonly target: BrowserLocator
      readonly fill: { readonly value: string } | { readonly credential: string }
    }
  | { readonly tool: 'browser_select'; readonly target: BrowserLocator; readonly option: string }
  | { readonly tool: 'browser_check'; readonly target: BrowserLocator; readonly checked: boolean }
  | { readonly tool: 'browser_press'; readonly key: string; readonly target?: BrowserLocator }
  | {
      readonly tool: 'browser_done'
      readonly summary: string
      readonly output: Readonly<Record<string, unknown>> | undefined
    }

const LOCATOR_PARAMETERS = {
  type: 'object',
  description:
    'The element, as a browser/run locator: exactly one of "role" (with an optional "name"), "label", "text", "placeholder", "testId" or "selector"; "exact" and "nth" refine it.',
  properties: {
    role: { type: 'string' },
    name: { type: 'string' },
    label: { type: 'string' },
    text: { type: 'string' },
    placeholder: { type: 'string' },
    testId: { type: 'string' },
    selector: { type: 'string' },
    exact: { type: 'boolean' },
    nth: { type: 'integer', minimum: 0 },
  },
} as const

const tool = (
  name: string,
  description: string,
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[]
): ChatToolDefinition => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: { type: 'object', properties, required: [...required] },
  },
})

/** The JSON schema of the result a goal must report. */
export const outputParameters = (
  output: Readonly<Record<string, OutputType>> | undefined
): Readonly<Record<string, unknown>> =>
  output === undefined
    ? { type: 'object', description: 'Nothing is asked for: omit it.' }
    : {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(output).map(([field, type]) => [field, { type }])
        ),
        required: Object.keys(output),
      }

/** The tools of the browser agent. `credentials` are the names it may type, never their values. */
export const browserAgentTools = (input: {
  readonly credentials: readonly string[]
  readonly output: Readonly<Record<string, OutputType>> | undefined
}): readonly ChatToolDefinition[] => [
  tool(
    'browser_goto',
    'Open an address. Only the hosts the operator listed are reachable.',
    { url: { type: 'string' } },
    ['url']
  ),
  tool('browser_click', 'Click an element.', { target: LOCATOR_PARAMETERS }, ['target']),
  tool(
    'browser_fill',
    'Type into a field: give exactly one of "value" (text you choose) or "credential" (the NAME of a secret the browser types for you; you never see its value).',
    {
      target: LOCATOR_PARAMETERS,
      value: { type: 'string' },
      ...(input.credentials.length === 0
        ? {}
        : { credential: { type: 'string', enum: [...input.credentials] } }),
    },
    ['target']
  ),
  tool(
    'browser_select',
    'Choose an option of a list by its visible text.',
    { target: LOCATOR_PARAMETERS, option: { type: 'string' } },
    ['target', 'option']
  ),
  tool(
    'browser_check',
    'Tick (or untick, with "checked": false) a box.',
    { target: LOCATOR_PARAMETERS, checked: { type: 'boolean' } },
    ['target']
  ),
  tool(
    'browser_press',
    'Press a key, such as "Enter", in an element or in the focused one.',
    { key: { type: 'string' }, target: LOCATOR_PARAMETERS },
    ['key']
  ),
  tool(
    'browser_done',
    'Report the goal reached, with a one-sentence summary and the result fields asked for.',
    { summary: { type: 'string' }, output: outputParameters(input.output) },
    ['summary']
  ),
]

/** The one tool of a declared agent granted `browser.use`. */
export const BROWSER_USE_TOOL: ChatToolDefinition = tool(
  'browser_use',
  'Drive a web browser towards a goal, on the hosts you are allowed, and get back what it found. Nothing that sends data (a form posting data, a script POST) is ever sent.',
  {
    goal: { type: 'string', description: 'What to find or do, in plain words.' },
    startUrl: { type: 'string', description: 'The address to start from.' },
    session: { type: 'string', description: 'A stored sign-in you are allowed to start from.' },
    output: {
      type: 'object',
      description:
        'The result fields to return, by name and type ("string", "number" or "boolean").',
      additionalProperties: { type: 'string', enum: ['string', 'number', 'boolean'] },
    },
  },
  ['goal', 'startUrl']
)

const text = (args: Readonly<Record<string, unknown>>, key: string): string | undefined =>
  typeof args[key] === 'string' && args[key] !== '' ? args[key] : undefined

/** The locator argument, checked, or why it is refused. */
const targetOf = (
  args: Readonly<Record<string, unknown>>
): { readonly target: BrowserLocator } | { readonly error: string } => {
  const checked = checkModelLocator(args['target'])
  return checked.ok ? { target: checked.locator } : { error: `invalid target: ${checked.reason}` }
}

/** A fill's one value: text the model chose, or a credential name it may use. */
const fillOf = (
  args: Readonly<Record<string, unknown>>,
  credentials: readonly string[]
): { readonly value: string } | { readonly credential: string } | { readonly error: string } => {
  const credential = text(args, 'credential')
  const value = typeof args['value'] === 'string' ? args['value'] : undefined
  if ((credential === undefined) === (value === undefined)) {
    return { error: 'give exactly one of "value" and "credential"' }
  }
  if (credential === undefined) return { value: value ?? '' }
  return credentials.includes(credential)
    ? { credential }
    : {
        error: `there is no credential named "${credential}"${credentials.length === 0 ? '' : `; the names are ${credentials.join(', ')}`}`,
      }
}

type Args = Readonly<Record<string, unknown>>
type Parsed = AgentAction | { readonly error: string }

/** Parse the calls that act on one element, once their `target` is checked. */
const withTarget =
  (parse: (args: Args, target: BrowserLocator, credentials: readonly string[]) => Parsed) =>
  (args: Args, credentials: readonly string[]): Parsed => {
    const found = targetOf(args)
    return 'error' in found ? found : parse(args, found.target, credentials)
  }

const PARSERS: Readonly<Record<string, (args: Args, credentials: readonly string[]) => Parsed>> = {
  browser_done: (args) => {
    const { output } = args
    return {
      tool: 'browser_done',
      summary: text(args, 'summary') ?? '',
      output:
        typeof output === 'object' && output !== null && !Array.isArray(output)
          ? (output as Args)
          : undefined,
    }
  },
  browser_goto: (args) => {
    const url = text(args, 'url')
    return url === undefined
      ? { error: 'browser_goto needs a "url"' }
      : { tool: 'browser_goto', url }
  },
  browser_press: (args) => {
    const key = text(args, 'key')
    if (key === undefined) return { error: 'browser_press needs a "key"' }
    if (args['target'] === undefined) return { tool: 'browser_press', key }
    const found = targetOf(args)
    return 'error' in found ? found : { tool: 'browser_press', key, target: found.target }
  },
  browser_click: withTarget((_args, target) => ({ tool: 'browser_click', target })),
  browser_check: withTarget((args, target) => ({
    tool: 'browser_check',
    target,
    checked: args['checked'] !== false,
  })),
  browser_select: withTarget((args, target) => {
    const option = text(args, 'option')
    return option === undefined
      ? { error: 'browser_select needs an "option"' }
      : { tool: 'browser_select', target, option }
  }),
  browser_fill: withTarget((args, target, credentials) => {
    const fill = fillOf(args, credentials)
    return 'error' in fill ? fill : { tool: 'browser_fill', target, fill }
  }),
}

/** The action a tool call asks for, or why it cannot be acted on. */
export const agentActionOf = (call: ChatToolCall, credentials: readonly string[]): Parsed => {
  const parse = PARSERS[call.name]
  return parse === undefined
    ? { error: `there is no tool named "${call.name}"` }
    : parse(call.arguments, credentials)
}
