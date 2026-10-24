/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { logDebug, logError, logInfo, logWarning } from '@/infrastructure/logging/logger'
import { authoredReferenceRoots } from '../authored-references'
import { buildAutomationContext, type TriggerData } from '../resolve-trigger-data'
import { resolveCodeInputData } from './code-input-resolution'
import { createCodeLogCollector } from './code-log-collector'
import {
  actionResult,
  contextCloneRefusal,
  decodeFromWorker,
  timeoutMessage,
  type ActionTarget,
  type CodeStepData,
  type CodeStepStart,
  type FromWorker,
  type ToWorker,
} from './code-step-protocol'
import { authoredActionProps } from './run-context-resolution'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type Typescript from 'typescript'

/**
 * `code/runTypescript` handler — execute a named `execute(context)` function
 * from the action's `props.code` string on a worker thread of its own
 * ([internal ref], `code-step-worker.ts`).
 *
 * The server transpiles the operator's TypeScript, starts one fresh Bun
 * `Worker` for the step, created with the JavaScript and the data half of the
 * `context` (`inputData`, `env`, `run`, copied by structured clone) as its
 * `workerData`. The
 * step's `context.actions.*` calls come back as messages and run here,
 * through the same handler pipeline as any step — the database, the mailer
 * and every credential stay on this thread. `context.log` entries come back
 * the same way; `console.*` goes to the server's log.
 *
 * The step's `timeout` is real: the clock is on this thread, and when it
 * elapses the worker is terminated, whatever the code is doing, and the step
 * fails with `code action exceeded timeout of <n>ms`. The worker is a scoped
 * resource (E3): released — terminated — when the step ends, however it
 * ends, interruption included.
 *
 * Threat model: code is operator-authored (in app config), not user-uploaded.
 * The restricted globals block accidental access to `fs`, `http`,
 * `child_process`; they are NOT a defence against intentionally malicious
 * code (the `vm` realm leaks the host realm), and neither is the thread. The
 * code lives in the same trust boundary as the rest of the app config.
 */

const DEFAULT_TIMEOUT_MS = 30_000

// Code-action `inputData` template resolution (PURE_TEMPLATE detection +
// typed-primitive re-typing) lives in `code-input-resolution.ts` so this
// file stays under the lines-per-file lint budget.

/**
 * The two ways a step's `context.actions` reaches the run loop: a template by
 * name (`context.actions.ref(name, vars)`), or any registered action by type
 * and operator (`context.actions.email.send({...})`). Templates named `ref`
 * are refused at validation, so `ref` is always the template call.
 */
interface ActionsProxyDispatchers {
  readonly invokeTemplate: (
    name: string,
    vars?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>
  readonly invokeNativeAction: (
    type: string,
    operator: string,
    props?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>
}

/**
 * Build the substitution context used for `inputData` template
 * resolution. Includes `trigger.data` (flattened body view), `steps.X`,
 * `env.X` so `inputData: { name: '{{trigger.data.name}}' }` and similar
 * resolve before the sandbox sees them. This object is INTERNAL to the
 * resolution pipeline — it never reaches user code.
 *
 * `context.trigger` and `context.steps` are intentionally NOT exposed in
 * the sandbox context: every value the user code needs must flow through
 * the explicit `inputData` declaration. See `buildSandboxContext` below
 * for the user-facing shape.
 */
const buildResolutionContext = (input: {
  readonly triggerData: Readonly<Record<string, unknown>>
  readonly previousSteps: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly env: Readonly<Record<string, string>>
  readonly templateVars: Readonly<Record<string, unknown>> | undefined
  readonly inputData: Readonly<Record<string, unknown>>
  readonly actions: Readonly<Record<string, unknown>>
  readonly log: Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>>
}): Readonly<Record<string, unknown>> => {
  return {
    // Prior step outputs are spread at the root so `{{stepName.property}}`
    // resolves directly (the cross-cutting action-feature convention).
    // `steps.<name>.<property>` keeps working via the explicit `steps` key
    // below. Reserved keys (`trigger`, `steps`, `env`, …) are written AFTER
    // the spread so a step named `trigger`/`steps`/`env` cannot shadow them.
    ...input.previousSteps,
    // The same `trigger` a step's templates read: `data`, `user` and the
    // lifted keys (`input`, `record`, `caller`, …), so an `inputData`
    // reference resolves here exactly as it does in any other step.
    trigger: buildAutomationContext(input.triggerData as TriggerData)['trigger'],
    steps: input.previousSteps,
    env: input.env,
    inputData: input.inputData,
    actions: input.actions,
    log: input.log,
    // The values an authored `$env.X` / template `$name` reference inserts.
    ...authoredReferenceRoots({ envLookup: input.env, vars: input.templateVars }),
  }
}

/**
 * Transpile the operator's TypeScript to the JavaScript the worker runs.
 * The compiler is required here, on the first run, never at start (~9 MB),
 * and stays on this thread: the worker bundle carries no compiler.
 */
const transpile = (source: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deferred load, literal for the binary
  const ts = require('typescript') as typeof Typescript
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      isolatedModules: true,
    },
  }).outputText
}

/**
 * Where the worker script is. From source it sits beside this file; in the
 * compiled binary this module is bundled into the CLI's chunk, so
 * `import.meta.url` is the binary's root and the worker is embedded under its
 * path from `src/` (`scripts/build/build-binary.ts`, `compileEntryRoot`).
 */
const workerUrl = (): Readonly<URL> =>
  /\/\$bunfs\/|\/~BUN\//.test(import.meta.url)
    ? new URL(
        './application/use-cases/automations/action-handlers/code-step-worker.ts',
        import.meta.url
      )
    : new URL('./code-step-worker.ts', import.meta.url)

/** The `console.*` level a worker forwarded, written to the server's log. */
const SERVER_LOG: Readonly<Record<string, (message: string) => void>> = {
  log: logInfo,
  info: logInfo,
  warn: logWarning,
  error: logError,
  debug: logDebug,
}

const NOOP_INVOKE_TEMPLATE = (): Promise<unknown> =>
  Promise.reject(new Error('context.actions.ref(...) is not available outside the run loop'))

const NOOP_INVOKE_NATIVE = (): Promise<unknown> =>
  Promise.reject(
    new Error('context.actions.<type>.<operator>(...) is not available outside the run loop')
  )

/** Run one `context.actions` call the worker asked for, through the run loop. */
const dispatchAction = (
  dispatchers: ActionsProxyDispatchers,
  target: ActionTarget,
  props: Readonly<Record<string, unknown>> | undefined
): Promise<unknown> =>
  target.kind === 'ref'
    ? dispatchers.invokeTemplate(target.name, props)
    : dispatchers.invokeNativeAction(target.type, target.operator, props)

/** What one worker conversation needs from the step. */
interface WorkerSession {
  readonly source: string
  readonly data: CodeStepData
  readonly dispatchers: ActionsProxyDispatchers
  readonly log: ReturnType<typeof createCodeLogCollector>['log']
  readonly timeoutMs: number
}

/** Post to a worker that may already be gone (a late action answer after a stop). */
const postTo = (worker: Readonly<Worker>, message: ToWorker): void => {
  try {
    worker.postMessage(message)
  } catch {
    // The step already ended and its worker was terminated: the answer is dropped.
  }
}

/** Answer one message from the worker; `done` settles the step. */
const onWorkerMessage = (
  worker: Readonly<Worker>,
  session: WorkerSession,
  message: FromWorker,
  settle: (outcome: ActionOutcome) => void
): void => {
  switch (message.type) {
    case 'action':
      dispatchAction(session.dispatchers, message.target, message.props).then(
        (value) => postTo(worker, actionResult(message.id, { ok: true, value })),
        (error: unknown) => postTo(worker, actionResult(message.id, { ok: false, error }))
      )
      return
    case 'log':
      session.log[message.level](...message.args)
      return
    case 'console': {
      const write = SERVER_LOG[message.level] ?? logInfo
      write(`[code step] ${message.text}`)
      return
    }
    case 'done':
      settle(
        message.ok
          ? { status: 'success', output: message.output ?? {} }
          : { status: 'failure', error: message.error ?? 'code action failed' }
      )
  }
}

/**
 * Talk to one started worker until the step ends: its `done`, its crash, or
 * the step's own clock — which stops the code wherever it is.
 */
const converse = (worker: Readonly<Worker>, session: WorkerSession): Effect.Effect<ActionOutcome> =>
  Effect.callback<ActionOutcome>((resume) => {
    const settle = (outcome: ActionOutcome): void => {
      clearTimeout(clock)
      resume(Effect.succeed(outcome))
    }
    const clock = setTimeout(() => {
      settle({ status: 'failure', error: timeoutMessage(session.timeoutMs) })
    }, session.timeoutMs)
    worker.addEventListener('message', (event: Readonly<MessageEvent>) => {
      const message = decodeFromWorker(event.data)
      if (message !== undefined) onWorkerMessage(worker, session, message, settle)
    })
    worker.addEventListener('error', (event: Readonly<ErrorEvent>) => {
      settle({ status: 'failure', error: event.message || 'code action failed' })
    })
    return Effect.sync(() => clearTimeout(clock))
  })

/**
 * The worker's options: the step's code and data context travel as its
 * `workerData` (structured clone), never as a message — Bun's `Worker` takes
 * the option though its typings do not name it.
 */
const workerOptions = (
  session: WorkerSession
): Readonly<Bun.WorkerOptions & { readonly workerData: CodeStepStart }> => ({
  smol: true,
  ref: false,
  workerData: { source: session.source, data: session.data },
})

/**
 * Run the step on a worker of its own. The worker is acquired and released
 * as a scoped resource (E3): terminated when the step ends, however it ends.
 * It never holds the process open (`unref`).
 */
const runOnWorker = (session: WorkerSession): Effect.Effect<ActionOutcome> =>
  Effect.scoped(
    Effect.gen(function* () {
      const worker = yield* Effect.acquireRelease(
        Effect.sync(() => new Worker(workerUrl(), workerOptions(session))),
        (started) => Effect.sync(() => started.terminate())
      )
      return yield* converse(worker, session)
    })
  )

/** Transpile the step's code, or the failure that ends it. */
const transpileOrFailure = (
  code: string
): { readonly source: string } | { readonly failure: ActionOutcome } => {
  try {
    return { source: transpile(code) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown compile error'
    return { failure: { status: 'failure', error: `code action failed to compile: ${detail}` } }
  }
}

/** Everything a step's run needs once its props are read. */
interface RunCodeActionInput {
  readonly code: string
  readonly rawInputData: Readonly<Record<string, unknown>>
  readonly runContext: NonNullable<Parameters<ActionHandler>[3]>
  readonly timeoutMs: number
}

/**
 * Resolve `inputData`, transpile, check the data context can be copied, then
 * run on a worker. The step's log leaves on the outcome whether the code
 * succeeded, threw or was stopped — a failing step's log is the one an
 * operator most needs to read.
 */
const runCodeAction = (input: RunCodeActionInput): Effect.Effect<ActionOutcome> =>
  Effect.gen(function* () {
    const { runContext } = input
    // INTERNAL substitution context for `inputData`; it never reaches user code.
    const resolutionContext = buildResolutionContext({
      triggerData: runContext.triggerData,
      previousSteps: runContext.previousSteps,
      env: runContext.envLookup,
      templateVars: runContext.templateVars,
      inputData: {},
      actions: {},
      log: {},
    })
    // Final props (a code action another step dispatched with values) arrive as given.
    const inputData =
      runContext.propsFinal === true
        ? input.rawInputData
        : resolveCodeInputData(input.rawInputData, resolutionContext, runContext.templates)
    const data: CodeStepData = {
      inputData,
      env: runContext.envLookup,
      run: { attempt: runContext.attempt ?? 1 },
    }
    const refusal = contextCloneRefusal(data)
    if (refusal !== undefined) return { status: 'failure', error: refusal } as const
    const compiled = transpileOrFailure(input.code)
    if ('failure' in compiled) return compiled.failure
    const collector = createCodeLogCollector()
    const outcome = yield* runOnWorker({
      source: compiled.source,
      data,
      dispatchers: {
        invokeTemplate: runContext.invokeTemplate ?? NOOP_INVOKE_TEMPLATE,
        invokeNativeAction: runContext.invokeNativeAction ?? NOOP_INVOKE_NATIVE,
      },
      log: collector.log,
      timeoutMs: input.timeoutMs,
    })
    const logs = collector.entries()
    return logs.length > 0 ? { ...outcome, logs } : outcome
  })

export const handleCodeRun: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined) {
      // Should never happen — the runtime always provides one.
      return { status: 'failure', error: 'code action requires run context' } as const
    }
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const code = typeof props['code'] === 'string' ? props['code'] : ''
    if (code === '') {
      return {
        status: 'failure',
        error: 'code.runTypescript requires a non-empty code string',
      } as const
    }
    const timeoutMs =
      typeof props['timeout'] === 'number' && Number.isFinite(props['timeout'])
        ? (props['timeout'] as number)
        : DEFAULT_TIMEOUT_MS

    // Resolve `inputData` against the code-specific context. We use the
    // pre-template inputData (the authored props, `$env.X` already resolved in
    // the text as written) because the global engine cannot see `steps.<name>`
    // and uses a different `trigger.data` shape. A value the templates then
    // bring in is never read for `$env.`.
    const rawProps = authoredActionProps(runContext)
    const rawInputData = (rawProps['inputData'] as Record<string, unknown> | undefined) ?? {}
    return yield* runCodeAction({ code, rawInputData, runContext, timeoutMs })
  }).pipe(Effect.withSpan('automations.handle-code-run', { attributes: actionAttributes(action) }))
