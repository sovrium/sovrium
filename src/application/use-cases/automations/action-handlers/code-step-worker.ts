/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The thread a `code/runTypescript` step runs on: one fresh Bun
 * `Worker` per step, terminated when the step ends, so a step that computes
 * for minutes never holds the server's own thread.
 *
 * It is created with the step's JavaScript (already transpiled by the server)
 * and the data half of its `context` as its `workerData` — never as a
 * message, so the message channel carries only answers to the step's own
 * calls and nothing posted to it can become code. It runs `execute(context)` in a `vm` context
 * with the same restricted globals as before, and talks back through
 * `code-step-protocol.ts`: `context.actions.*` calls and `context.log`
 * entries become messages, `console.*` output is forwarded to the server's
 * log, and the result ends the step. The database, the mailer and every
 * credential stay on the server's side; this thread opens no connection.
 *
 * Not a sandbox: the `vm` realm leaks the host realm to anyone trying. The
 * code is the operator's, as trusted as the configuration it sits in; the
 * thread protects the server's availability, not the host from the code.
 *
 * Listed as a second entrypoint of the compiled binary
 * (`scripts/build/build-binary.ts`): nothing imports this file.
 */

import vm from 'node:vm'
import { workerData } from 'node:worker_threads'
import { renderArgument } from './code-log-collector'
import type {
  ActionTarget,
  CodeStepData,
  CodeStepStart,
  FromWorker,
  ToWorker,
} from './code-step-protocol'

/** The worker's side of the message channel. */
interface WorkerPort {
  readonly postMessage: (message: FromWorker) => void
  readonly addEventListener: (
    type: 'message',
    listener: (event: Readonly<MessageEvent>) => void
  ) => void
}

// eslint-disable-next-line sovrium/no-double-assertion -- a worker's global scope is its message port; Bun types `globalThis` as the main thread's
const port = globalThis as unknown as WorkerPort

/** The `action` calls waiting for their answer, by id. */
const pending = new Map<
  string,
  {
    readonly resolve: (value: unknown) => void
    readonly reject: (error: Readonly<Error>) => void
  }
>()

/** Ask the server to run an action; resolves with its output. */
const callAction = (
  target: ActionTarget,
  props: Readonly<Record<string, unknown>> | undefined
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the table of calls awaiting the server's answer
    pending.set(id, { resolve, reject })
    port.postMessage({ type: 'action', id, target, props })
  })

/** `context.actions`: `ref(name, vars)` for a template, `<type>.<operator>(props)` for the rest. */
const actionsProxy = (): Readonly<Record<string, unknown>> =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        const name = String(prop)
        if (name === 'ref') {
          return (templateName: string, vars?: Readonly<Record<string, unknown>>) =>
            callAction({ kind: 'ref', name: templateName }, vars)
        }
        return new Proxy(
          {},
          {
            get(_sub, operatorProp) {
              if (typeof operatorProp === 'symbol') return undefined
              return (props?: Readonly<Record<string, unknown>>) =>
                callAction({ kind: 'native', type: name, operator: String(operatorProp) }, props)
            },
          }
        )
      },
    }
  )

/** `context.log`: each entry crosses to the server, rendered as text. */
const logFunctions = (): Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>> =>
  Object.fromEntries(
    (['debug', 'info', 'warn', 'error'] as const).map((level) => [
      level,
      (...args: ReadonlyArray<unknown>) => {
        port.postMessage({ type: 'log', level, args: [args.map(renderArgument).join(' ')] })
      },
    ])
  )

/** The server log level a `console` method writes at; any other method writes at `log`. */
const consoleLevel = (method: string): 'log' | 'info' | 'warn' | 'error' | 'debug' =>
  method === 'info' || method === 'warn' || method === 'error' || method === 'debug'
    ? method
    : 'log'

/**
 * `console.*` inside the step: every method (`log`, `table`, `trace`…) is
 * forwarded to the server's own log, not the run log.
 */
const consoleShim = (): Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>> =>
  new Proxy(
    {},
    {
      get: (_target, method) =>
        typeof method === 'symbol'
          ? undefined
          : (...args: ReadonlyArray<unknown>) => {
              port.postMessage({
                type: 'console',
                level: consoleLevel(method),
                text: args.map(renderArgument).join(' '),
              })
            },
    }
  )

/**
 * The step's result as plain data: a JSON round trip drops cross-realm
 * prototypes and anything a run record cannot hold; a list or a primitive is
 * wrapped as `{ value }`, nothing as `{}`.
 */
const plainOutput = (value: unknown): Readonly<Record<string, unknown>> => {
  if (value === undefined || value === null) return {}
  try {
    const json = JSON.stringify(value)
    if (json === undefined) return {}
    const parsed = JSON.parse(json) as unknown
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed }
  } catch {
    return { value: String(value) }
  }
}

/** Run the operator's `execute(context)` in a restricted `vm` context. */
const execute = async (source: string, data: CodeStepData): Promise<unknown> => {
  const wrapper = `${source}\n; if (typeof execute !== 'function') { throw new Error('code action must define a function named "execute"') } execute;`
  const script = new vm.Script(wrapper, { filename: 'code-action.js' })
  const context = { ...data, actions: actionsProxy(), log: logFunctions() }
  // Limited globals, as before the move to a thread: no `require`, no
  // `import`, no `process`, `fs` or network module.
  const sandbox: Readonly<Record<string, unknown>> = {
    console: consoleShim(),
    JSON,
    Math,
    Date,
    Promise,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Error,
    RegExp,
    Map,
    Set,
    Symbol,
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    // WebCrypto (`globalThis.crypto`), not `node:crypto`: the prelude declares
    // the `Crypto` shape. Shorthand, so the sandbox-globals drift check reads it.
    crypto,
    Intl,
    context,
  }
  const fn = script.runInContext(vm.createContext(sandbox)) as (ctx: unknown) => unknown
  // An async function adopts the thenable the `vm` realm returns (its
  // `Promise` is not the host's), so its rejection is caught by the caller.
  return fn(context)
}

/** Settle the call the server answered. */
const settleCall = (message: ToWorker): void => {
  const waiting = pending.get(message.id)
  if (waiting === undefined) return
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the table of calls awaiting the server's answer
  pending.delete(message.id)
  if (message.ok) return waiting.resolve(message.value)
  return waiting.reject(new Error(message.error ?? 'action failed'))
}

/** The start the server created this worker with, or `undefined` when it is not one. */
const startOf = (value: unknown): CodeStepStart | undefined => {
  if (value === null || typeof value !== 'object') return undefined
  const { source, data } = value as Readonly<Record<string, unknown>>
  return typeof source === 'string' && data !== null && typeof data === 'object'
    ? { source, data: data as CodeStepData }
    : undefined
}

/** Run the step this worker was created for, and post how it ended. */
const runStep = (start: CodeStepStart | undefined): void => {
  if (start === undefined) {
    port.postMessage({ type: 'done', ok: false, error: 'code action received no code to run' })
    return
  }
  execute(start.source, start.data).then(
    (value) => {
      port.postMessage({ type: 'done', ok: true, output: plainOutput(value) })
    },
    (error: unknown) => {
      port.postMessage({
        type: 'done',
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  )
}

// The channel only ever answers the step's own `action` calls; anything else is ignored.
port.addEventListener('message', (event) => {
  const message = event.data as ToWorker | undefined
  if (message?.type === 'action-result') settleCall(message)
})

runStep(startOf(workerData))
