/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { StepLogEntry } from './shared'

/**
 * The messages a code step and the server exchange across the worker thread
 * the step runs on ([internal ref] D3). Pure: no worker, no clock, no I/O, so every
 * shape is unit-tested.
 *
 * - The server starts the worker with a `CodeStepStart` as its `workerData`:
 *   the JavaScript to run (already transpiled) and the step's DATA context —
 *   `inputData`, `env`, `run` — copied by structured clone. It is never a
 *   message: the worker runs what it was CREATED with, and treats the message
 *   channel as answers to its own calls, so nothing posted to it later can
 *   become code.
 * - The step's FUNCTION members cross as messages: an `action` call is
 *   answered by an `action-result` with the same id; `log` entries and
 *   `console` output are one-way.
 * - The step ends with `done`.
 */

/** The data half of a code step's `context`, copied into the worker. */
export interface CodeStepData {
  readonly inputData: Readonly<Record<string, unknown>>
  readonly env: Readonly<Record<string, string>>
  readonly run: { readonly attempt: number }
}

/** What a worker is created with (`workerData`): the code to run and its data context. */
export interface CodeStepStart {
  readonly source: string
  readonly data: CodeStepData
}

/** Server → worker: the answer to one `action` call. */
export type ToWorker = {
  readonly type: 'action-result'
  readonly id: string
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: string
}

/** Which action a step called: a template by name, or a native type and operator. */
export type ActionTarget =
  | { readonly kind: 'ref'; readonly name: string }
  | { readonly kind: 'native'; readonly type: string; readonly operator: string }

/** Worker → server. */
export type FromWorker =
  | {
      readonly type: 'action'
      readonly id: string
      readonly target: ActionTarget
      readonly props: Readonly<Record<string, unknown>> | undefined
    }
  | {
      readonly type: 'log'
      readonly level: StepLogEntry['level']
      readonly args: readonly unknown[]
    }
  | {
      readonly type: 'console'
      readonly level: 'log' | 'info' | 'warn' | 'error' | 'debug'
      readonly text: string
    }
  | {
      readonly type: 'done'
      readonly ok: boolean
      readonly output?: Readonly<Record<string, unknown>>
      readonly error?: string
    }

const LOG_LEVELS: ReadonlySet<string> = new Set(['debug', 'info', 'warn', 'error'])
const CONSOLE_LEVELS: ReadonlySet<string> = new Set(['log', 'info', 'warn', 'error', 'debug'])

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const decodeTarget = (value: unknown): ActionTarget | undefined => {
  if (!isRecord(value)) return undefined
  if (value['kind'] === 'ref' && typeof value['name'] === 'string') {
    return { kind: 'ref', name: value['name'] }
  }
  if (
    value['kind'] === 'native' &&
    typeof value['type'] === 'string' &&
    typeof value['operator'] === 'string'
  ) {
    return { kind: 'native', type: value['type'], operator: value['operator'] }
  }
  return undefined
}

const decodeAction = (message: Readonly<Record<string, unknown>>): FromWorker | undefined => {
  const target = decodeTarget(message['target'])
  const { id, props } = message
  if (typeof id !== 'string' || target === undefined) return undefined
  if (props !== undefined && !isRecord(props)) return undefined
  return { type: 'action', id, target, props }
}

const decodeDone = (message: Readonly<Record<string, unknown>>): FromWorker | undefined => {
  if (typeof message['ok'] !== 'boolean') return undefined
  const { output, error } = message
  return {
    type: 'done',
    ok: message['ok'],
    ...(isRecord(output) ? { output } : {}),
    ...(typeof error === 'string' ? { error } : {}),
  }
}

/**
 * Read a message a worker posted, or `undefined` for anything that is not one
 * of the four shapes — the server ignores it rather than trusting it.
 */
const decodeLog = (message: Readonly<Record<string, unknown>>): FromWorker | undefined =>
  LOG_LEVELS.has(String(message['level'])) && Array.isArray(message['args'])
    ? {
        type: 'log',
        level: message['level'] as StepLogEntry['level'],
        args: message['args'] as readonly unknown[],
      }
    : undefined

const decodeConsole = (message: Readonly<Record<string, unknown>>): FromWorker | undefined =>
  CONSOLE_LEVELS.has(String(message['level'])) && typeof message['text'] === 'string'
    ? {
        type: 'console',
        level: message['level'] as 'log' | 'info' | 'warn' | 'error' | 'debug',
        text: message['text'],
      }
    : undefined

const DECODERS: Readonly<
  Record<string, (message: Readonly<Record<string, unknown>>) => FromWorker | undefined>
> = { action: decodeAction, log: decodeLog, console: decodeConsole, done: decodeDone }

/**
 * Read a message a worker posted, or `undefined` for anything that is not one
 * of the four shapes — the server ignores it rather than trusting it.
 */
export const decodeFromWorker = (message: unknown): FromWorker | undefined => {
  if (!isRecord(message)) return undefined
  const decode = DECODERS[String(message['type'])]
  return decode === undefined ? undefined : decode(message)
}

/** The answer to an `action` call: its output, or the reason it failed. */
export const actionResult = (
  id: string,
  settled:
    { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown }
): ToWorker =>
  settled.ok
    ? { type: 'action-result', id, ok: true, value: settled.value }
    : {
        type: 'action-result',
        id,
        ok: false,
        error: settled.error instanceof Error ? settled.error.message : String(settled.error),
      }

/** The class of an object that is not plain data (a list or a plain object), or `undefined`. */
const classKind = (value: object): string | undefined => {
  const prototype: unknown = Object.getPrototypeOf(value)
  if (Array.isArray(value) || prototype === Object.prototype || prototype === null) return undefined
  return value.constructor?.name ?? 'object'
}

/** The kind of a value structured clone refuses, as the refusal names it. */
const uncloneableKind = (value: unknown): string | undefined => {
  if (typeof value === 'function' || typeof value === 'symbol') return typeof value
  if (value === null || typeof value !== 'object' || value instanceof Date) return undefined
  return classKind(value)
}

/**
 * The first path of a value structured clone cannot copy — a function, a
 * symbol, an object whose prototype is a class with methods — or `undefined`.
 * Plain data (text, numbers, booleans, `null`, lists, objects, dates) passes.
 */
const firstUncloneable = (
  value: unknown,
  path: string,
  seen: ReadonlySet<unknown>
): { readonly path: string; readonly kind: string } | undefined => {
  const kind = uncloneableKind(value)
  if (kind !== undefined) return { path, kind }
  if (value === null || typeof value !== 'object' || value instanceof Date || seen.has(value)) {
    return undefined
  }
  const next = new Set([...seen, value])
  return Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => firstUncloneable(child, `${path}.${key}`, next))
    .find((found) => found !== undefined)
}

/**
 * Why the step's data context cannot be copied into the worker, naming the
 * path and the kind of value, never its content — or `undefined`.
 */
export const contextCloneRefusal = (data: CodeStepData): string | undefined => {
  const found = (['inputData', 'env', 'run'] as const)
    .map((key) => firstUncloneable(data[key], key, new Set()))
    .find((entry) => entry !== undefined)
  return found === undefined
    ? undefined
    : `code action context: ${found.path} cannot be passed to the code step (${found.kind})`
}

/** The message a step stopped at its budget fails with. */
export const timeoutMessage = (timeoutMs: number): string =>
  `code action exceeded timeout of ${String(timeoutMs)}ms`
