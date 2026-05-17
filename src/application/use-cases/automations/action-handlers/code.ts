/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import vm from 'node:vm'
import { Effect } from 'effect'
import ts from 'typescript'
import { PackageResolver } from '@/infrastructure/automations/package-resolver'
import { resolveCodeInputData } from './code-input-resolution'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `code/runTypescript` handler — execute a named `execute(context)` function from
 * the action's `props.code` string in a restricted VM sandbox.
 *
 * Threat model: code is operator-authored (in app config), not
 * user-uploaded. The sandbox exists to:
 *   1. Block accidental access to `fs`, `http`, `child_process` etc.
 *   2. Bound execution time so a typo (`while(true) {}`) cannot stall the
 *      automation engine.
 *   3. Provide a stable, typed `context` shape so `String(function execute(
 *      context: CodeContext) { ... })` (TS) and YAML multiline strings
 *      both work.
 *
 * What the sandbox is NOT:
 *   - A defence against intentionally malicious code. `vm.createContext`
 *     leaks the host realm via prototype-chain walks; an operator who
 *     wants to escape can always do so. We accept this — code lives in
 *     the same trust boundary as the rest of the app config.
 */

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Strip a version pin from a package specifier. `lodash@4.17.21` ->
 * `lodash`; `@scope/pkg@1.2.3` -> `@scope/pkg`. Used to translate the
 * `packages: ['lodash@4.17.21']` declaration into the plain module name
 * `import()` accepts.
 */
const stripVersionPin = (spec: string): string => {
  // Scoped packages: `@scope/name[@version]` — split after the `/`.
  if (spec.startsWith('@')) {
    const slash = spec.indexOf('/')
    if (slash === -1) return spec
    const tail = spec.slice(slash + 1)
    const at = tail.indexOf('@')
    return at === -1 ? spec : `${spec.slice(0, slash + 1)}${tail.slice(0, at)}`
  }
  const at = spec.indexOf('@')
  return at === -1 ? spec : spec.slice(0, at)
}

/**
 * Lookup a single declared package against the startup-time
 * `PackageResolver` cache. Lookups against the resolver are O(1) — every
 * package the user declared was already resolved when `startServer`
 * walked the config (see `infrastructure/automations/package-resolver`).
 */
type LoadPackagesResult =
  | { readonly _tag: 'ok'; readonly packages: Readonly<Record<string, unknown>> }
  | { readonly _tag: 'error'; readonly message: string }

const lookupDeclaredPackages = (
  declared: ReadonlyArray<string>,
  lookup: (name: string) => unknown | undefined
): LoadPackagesResult => {
  const entries = declared.map((spec) => {
    const name = stripVersionPin(spec)
    const value = lookup(name)
    if (value === undefined) {
      return { _tag: 'missing' as const, spec }
    }
    return { _tag: 'ok' as const, name, value }
  })
  const missing = entries.find((e) => e._tag === 'missing')
  if (missing !== undefined) {
    return {
      _tag: 'error',
      message: `Package "${missing.spec}" was not pre-resolved at server startup — re-start the server after editing the action`,
    }
  }
  const okEntries = entries as ReadonlyArray<{ readonly name: string; readonly value: unknown }>
  return {
    _tag: 'ok',
    packages: Object.fromEntries(okEntries.map((e) => [e.name, e.value] as const)),
  }
}

/**
 * Build the proxy used as `context.packages` inside the sandbox. Reading
 * a key that is not in the declared list throws synchronously with a
 * descriptive error (spec 006). The throw is unavoidable here — Proxy
 * `get` traps must signal "not found" via an exception so user code
 * sees `context.packages.X` fail at the access site (the Proxy contract
 * doesn't support an Either-style return). The throw is captured by
 * the surrounding sandbox executor and folded into an `ActionOutcome.failure`.
 */
const proxyMissingPackage = (name: string): never => {
  // Proxy `get` traps must signal "not found" via an exception — that is
  // the documented JS protocol; there is no Either-style alternative.
  // The throw is caught downstream in `runUserCode` via the cross-realm
  // Promise adoption path.
  // eslint-disable-next-line functional/no-throw-statements
  throw new Error(`Package "${name}" is not declared in this code action's packages array.`)
}

const buildPackagesProxy = (
  loaded: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  new Proxy(
    { ...loaded },
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (Object.prototype.hasOwnProperty.call(loaded, prop)) {
          return loaded[prop as string]
        }
        return proxyMissingPackage(String(prop))
      },
      ownKeys() {
        // Expose declared package names so user code can introspect via
        // `Object.keys(context.packages)`. Without this, the proxy target
        // (which we make a clone of `loaded` so its descriptors stay
        // honest) drives enumeration; `for…in` and `Object.keys` work
        // naturally and `'lodash' in context.packages` returns true.
        return Object.keys(loaded)
      },
    }
  )

/**
 * Build the `trigger.data` view exposed to the code's `context.trigger.data`
 * AND used as the substitution context for `inputData` template resolution.
 *
 * For webhook triggers (`triggerData.body` is the parsed JSON body), we
 * surface `body` as the canonical `data`. This lets code authors write
 * `context.trigger.data.userId` instead of `context.trigger.data.body.userId`
 * — matching spec convention.
 *
 * All other keys on `triggerData` are passed through verbatim so authors
 * can still reach the raw HTTP envelope (`headers`/`query`/`method`/…) and
 * trigger-kind-specific payloads (`record` / `previousRecord` for
 * record-event, `firedAt` for cron, etc.). The pass-through is dynamic
 * rather than a hardcoded allowlist — see the matching reasoning in
 * `resolve-trigger-data.ts#buildAutomationContext`.
 */
const buildCodeTriggerView = (
  triggerData: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const { body } = triggerData
  const fromBody: Record<string, unknown> =
    body !== undefined && body !== null && typeof body === 'object'
      ? { ...(body as Record<string, unknown>) }
      : {}
  // Pass through every non-body key on triggerData (only those NOT already
  // present in the flattened body — body wins on collision so
  // `context.trigger.data.X` refers to the request-body field).
  const envelopeAdditions = Object.fromEntries(
    Object.keys(triggerData)
      .filter((key) => triggerData[key] !== undefined && !(key in fromBody))
      .map((key) => [key, triggerData[key]] as const)
  )
  return { ...fromBody, ...envelopeAdditions }
}

// Code-action `inputData` / `input` template resolution (PURE_TEMPLATE
// detection + typed-primitive re-typing) lives in `code-input-resolution.ts`
// so this file stays under the lines-per-file lint budget.

/**
 * Build the callable `actions` Proxy exposed as `context.actions` to
 * sandboxed user code. Two complementary call shapes:
 *
 * 1. **Templates** — `context.actions.ref('<templateName>', vars)`
 *    looks up a template declared at `app.actions[]`, substitutes its
 *    `$vars` with caller-supplied `vars` (over declared defaults),
 *    dispatches through the same handler pipeline as top-level steps,
 *    and returns `ActionOutcome.output`.
 *
 * 2. **Native action types** — `context.actions.<actionType>.<operator>
 *    (props)` invokes any handler-registry action directly without a
 *    template declaration. E.g. `context.actions.email.send({...})` or
 *    `context.actions.http.post({...})`.
 *
 * The reserved `ref` method disambiguates templates from native action
 * types; templates named `'ref'` are rejected at schema validation
 * (see `ActionTemplatesSchema` reserved-name filter) so the proxy's
 * `ref` is always the template invocation method.
 *
 * Cross-realm Promise note: both invokers resolve in the host realm;
 * the sandboxed `await` operator is the sandbox-realm `Promise.then`.
 * Wrapping the result in a host-realm `Promise.resolve` is safe — the
 * sandbox's `await` adopts the thenable correctly.
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

const buildActionsProxy = (
  dispatchers: ActionsProxyDispatchers
): Readonly<Record<string, unknown>> =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        const name = String(prop)
        if (name === 'ref') {
          return (
            templateName: string,
            vars?: Readonly<Record<string, unknown>>
          ): Promise<unknown> => Promise.resolve(dispatchers.invokeTemplate(templateName, vars))
        }
        // Native action type: return a sub-proxy keyed on the operator.
        return new Proxy(
          {},
          {
            get(_subTarget, operatorProp) {
              if (typeof operatorProp === 'symbol') return undefined
              const operator = String(operatorProp)
              return (props?: Readonly<Record<string, unknown>>): Promise<unknown> =>
                Promise.resolve(dispatchers.invokeNativeAction(name, operator, props))
            },
          }
        )
      },
    }
  )

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
  readonly inputData: Readonly<Record<string, unknown>>
  readonly packages: Readonly<Record<string, unknown>>
  readonly actions: Readonly<Record<string, unknown>>
  readonly log: Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>>
}): Readonly<Record<string, unknown>> => {
  const triggerView = buildCodeTriggerView(input.triggerData)
  return {
    // Prior step outputs are spread at the root so `{{stepName.property}}`
    // resolves directly (the cross-cutting action-feature convention).
    // `steps.<name>.<property>` keeps working via the explicit `steps` key
    // below. Reserved keys (`trigger`, `steps`, `env`, …) are written AFTER
    // the spread so a step named `trigger`/`steps`/`env` cannot shadow them.
    ...input.previousSteps,
    trigger: { data: triggerView },
    steps: input.previousSteps,
    env: input.env,
    inputData: input.inputData,
    packages: input.packages,
    actions: input.actions,
    log: input.log,
  }
}

/**
 * Build the user-facing sandbox context — the object passed as
 * `execute(context: CodeContext)` argument. Five properties:
 * `inputData`, `actions`, `env`, `log`, `packages`. No `trigger`, no
 * `steps`: the schema author must declare every value the code needs
 * via `inputData` template references — this makes code actions pure
 * functions of their declared inputs, with no implicit coupling to
 * outer scope.
 */
const buildSandboxContext = (input: {
  readonly env: Readonly<Record<string, string>>
  readonly inputData: Readonly<Record<string, unknown>>
  /**
   * Resolved `props.input` — present only when the action declared an
   * `input` field. Surfaced to the sandbox as `context.input`. When absent
   * the key is omitted so the documented 5-property context shape
   * (`actions, env, inputData, log, packages`) stays exact for actions that
   * only use `inputData` (APP-AUTOMATION-ACTION-CODE-RUN-002).
   */
  readonly input?: Readonly<Record<string, unknown>>
  readonly packages: Readonly<Record<string, unknown>>
  readonly actions: Readonly<Record<string, unknown>>
  readonly log: Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>>
  /**
   * 1-indexed retry attempt number threaded through by `dispatchWithRetry`.
   * Surfaced as `context.run.attempt` so authors can short-circuit on retry
   * (APP-AUTOMATION-RETRY-015). Defaults to 1 when the action is invoked
   * outside the retry loop.
   */
  readonly attempt: number
}): Readonly<Record<string, unknown>> => ({
  inputData: input.inputData,
  ...(input.input !== undefined ? { input: input.input } : {}),
  actions: input.actions,
  env: input.env,
  log: input.log,
  packages: input.packages,
  run: { attempt: input.attempt },
})

/**
 * Compile the user's code string into an async function we can invoke.
 *
 * The pattern accepted by all specs:
 *
 *   async function execute(context) { ... }
 *   function execute(context) { ... }
 *
 * We wrap the source in an IIFE so the declaration is hoisted into the
 * sandbox and immediately returns the `execute` reference. This avoids
 * `eval`-shape strings the spec authors didn't write.
 */
const compileExecuteFn = (
  source: string
): ((context: Readonly<Record<string, unknown>>) => unknown) => {
  // The user authors TypeScript (`async function execute(context: CodeContext)`).
  // V8's vm module only accepts plain JS, so we strip type annotations first.
  // `ts.transpileModule` is already a runtime dependency (used by the
  // startup TypeScriptValidator); reusing it here avoids pulling in a
  // second transpiler. Type errors were already caught at server startup;
  // this transpile pass is a pure syntactic stripping.
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      isolatedModules: true,
    },
  }).outputText
  // The wrapper hoists the user's function declaration into the script
  // scope, then returns the bound reference. We evaluate the wrapper in a
  // VM context so `require`/`fs`/etc. are not visible (sandbox property).
  const wrapper = `${transpiled}\n; if (typeof execute !== 'function') { throw new Error('code action must define a function named "execute"') } execute;`
  const script = new vm.Script(wrapper, { filename: 'code-action.js' })
  return (context) => {
    const sandbox: Record<string, unknown> = {
      // Limited globals: only what user code legitimately needs. fs, http,
      // child_process, process etc. are deliberately absent. require is
      // not surfaced; users declare deps via the `packages` field.
      console,
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
      // The user's context.
      context,
    }
    const vmContext = vm.createContext(sandbox)
    const fn = script.runInContext(vmContext) as (ctx: Readonly<Record<string, unknown>>) => unknown
    return fn(context)
  }
}

/**
 * Race the user's promise against a timeout. We track-and-clear the
 * timer so we don't leave a dangling handle even if execution returns
 * faster than the timeout.
 *
 * The timer handle is captured into a closure-local box (not a `let`)
 * so the cleanup path can read it back without mutating local state.
 * Without the cleanup, a fast-completing user promise would leak the
 * scheduled timer until the deadline fires — fine in tests, but a
 * resource leak under real load.
 */
interface TimerBox {
  readonly handle: ReturnType<typeof setTimeout>
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  // The timer handle is created INSIDE the executor and surfaced via
  // the closure variable `box`. Wrapping it in an object lets us
  // satisfy `functional/no-let` while still being able to read the
  // handle in the `finally` for cleanup.
  // eslint-disable-next-line functional/prefer-immutable-types -- intentional mutable holder; see closure rationale above
  const timerBox: { current?: TimerBox } = {}
  const timeout = new Promise<never>((_resolve, reject) => {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- single-shot assignment to capture timer for cleanup
    timerBox.current = {
      handle: setTimeout(() => {
        reject(new Error(`code action exceeded timeout of ${String(timeoutMs)}ms`))
      }, timeoutMs),
    }
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timerBox.current !== undefined) clearTimeout(timerBox.current.handle)
  }
}

/**
 * Duck-type a value as a thenable. `result instanceof Promise` is unsafe
 * across vm realms — the sandbox's `Promise` constructor is a different
 * function from the host's, so a Promise created inside the sandbox by an
 * `async function` body is NOT `instanceof` the host's `Promise`. Skipping
 * the await in that case leaves the rejection unhandled, which Bun
 * promotes to a process-fatal error and crashes the server.
 *
 * `Promise.resolve(thenable)` adopts the value safely regardless of which
 * realm produced it.
 */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { then?: unknown }).then === 'function'

/**
 * Strip cross-realm prototype noise from the value the user returned. When
 * the function ran inside a fresh `vm` context, its `Object.prototype` is
 * a different object than the host's; `Object.keys` on a value built
 * inside the sandbox can surface inherited prototype methods that
 * JSON.stringify normally hides. Round-tripping through JSON gives us a
 * clean, host-realm-only structural copy that is safe to ship to the
 * response body and persist to run-history.
 *
 * Falls back to the original value on serialization failure (functions,
 * BigInts, circular references) so the action still surfaces *something*
 * rather than dropping the result.
 */
const sanitizeOutput = (value: unknown): Record<string, unknown> => {
  try {
    const json = JSON.stringify(value)
    if (json === undefined) return {}
    const parsed = JSON.parse(json) as unknown
    if (parsed === null || typeof parsed !== 'object') {
      return { value: parsed } as Record<string, unknown>
    }
    if (Array.isArray(parsed)) {
      return { value: parsed } as Record<string, unknown>
    }
    return parsed as Record<string, unknown>
  } catch {
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : ({ value } as Record<string, unknown>)
  }
}

/**
 * Execute the compiled function inside an Effect that captures both
 * synchronous throws (compile errors, undeclared packages, sandbox
 * violations) and async rejections (timeouts, uncaught exceptions in the
 * user's code) as `ActionOutcome.failure`.
 *
 * We ALWAYS funnel the result through `Promise.resolve` + `withTimeout`,
 * even when the function ran synchronously, because:
 *   1. `async function execute() { ... }` inside the sandbox returns a
 *      cross-realm Promise that fails `instanceof Promise` against the
 *      host's constructor — branching on `instanceof` would skip the
 *      await and leave any rejection unhandled, which Bun escalates to
 *      a process-fatal error.
 *   2. A synchronous throw inside `async` (e.g. `require("fs")` ->
 *      ReferenceError) becomes a rejected Promise, NOT a thrown error.
 *      Adopting via `Promise.resolve` and awaiting routes that rejection
 *      into our catch block instead of leaking it.
 *   3. The timeout race must wrap *every* execution path so a malformed
 *      sync result still respects the deadline contract.
 */
const runUserCode = async (
  fn: (context: Readonly<Record<string, unknown>>) => unknown,
  context: Readonly<Record<string, unknown>>,
  timeoutMs: number
): Promise<ActionOutcome> => {
  try {
    const result = fn(context)
    const adoptedPromise = isThenable(result)
      ? Promise.resolve(result as PromiseLike<unknown>)
      : Promise.resolve(result)
    const awaited = await withTimeout(adoptedPromise, timeoutMs)
    if (awaited === undefined || awaited === null) {
      return { status: 'success', output: {} }
    }
    if (typeof awaited !== 'object') {
      return { status: 'success', output: { value: awaited } as Record<string, unknown> }
    }
    return { status: 'success', output: sanitizeOutput(awaited) }
  } catch (error) {
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Compose the per-action async pipeline: load packages → resolve
 * inputData → compile user code → run with timeout. Returns the final
 * `ActionOutcome` directly so the Effect-side caller stays a thin
 * `Effect.promise` wrapper. Splitting this out keeps `handleCodeRun`'s
 * generator under the per-function line budget and makes each failure
 * branch easy to reason about in isolation.
 */
interface RunCodeActionInput {
  readonly code: string
  readonly declaredPackages: ReadonlyArray<string>
  readonly rawInputData: Readonly<Record<string, unknown>>
  /**
   * Raw (pre-substitution) `props.input` declaration, or undefined if the
   * action did not declare one. Resolved against the same context as
   * {@link rawInputData} and surfaced to the sandbox as `context.input`.
   */
  readonly rawInput: Readonly<Record<string, unknown>> | undefined
  readonly runContext: NonNullable<Parameters<ActionHandler>[3]>
  readonly timeoutMs: number
  readonly packageLookup: (name: string) => unknown | undefined
}

const NOOP_LOG: Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>> = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
}

const NOOP_INVOKE_TEMPLATE = (
  _name: string,
  _vars?: Readonly<Record<string, unknown>>
): Promise<unknown> =>
  Promise.reject(new Error('context.actions.ref(...) is not available outside the run loop'))

const NOOP_INVOKE_NATIVE = (
  _type: string,
  _operator: string,
  _props?: Readonly<Record<string, unknown>>
): Promise<unknown> =>
  Promise.reject(
    new Error('context.actions.<type>.<operator>(...) is not available outside the run loop')
  )

const runCodeActionAsync = async (input: RunCodeActionInput): Promise<ActionOutcome> => {
  // Look up declared packages against the startup-time PackageResolver
  // cache. Missing entries surface as a failure rather than a sandbox
  // throw so the handler stays in the documented Either shape.
  const lookupResult = lookupDeclaredPackages(input.declaredPackages, input.packageLookup)
  if (lookupResult._tag === 'error') {
    return { status: 'failure', error: lookupResult.message }
  }
  const packagesProxy = buildPackagesProxy(lookupResult.packages)
  const actionsProxy = buildActionsProxy({
    invokeTemplate: input.runContext.invokeTemplate ?? NOOP_INVOKE_TEMPLATE,
    invokeNativeAction: input.runContext.invokeNativeAction ?? NOOP_INVOKE_NATIVE,
  })

  // INTERNAL substitution context — used to resolve `{{steps.X.Y}}`,
  // `{{trigger.data.num}}`, etc. inside the action's `inputData` prop.
  // This object never reaches user code; it exists only to drive
  // template resolution before the sandbox sees any data.
  const resolutionContext = buildResolutionContext({
    triggerData: input.runContext.triggerData,
    previousSteps: input.runContext.previousSteps,
    env: input.runContext.envLookup,
    inputData: {},
    packages: packagesProxy,
    actions: actionsProxy,
    log: NOOP_LOG,
  })
  const resolvedInputData = resolveCodeInputData(input.rawInputData, resolutionContext)
  const resolvedInput =
    input.rawInput !== undefined
      ? resolveCodeInputData(input.rawInput, resolutionContext)
      : undefined

  // The user-facing context: `inputData`, `actions`, `env`, `log`,
  // `packages` (+ optional `input` when the action declared one). Every
  // value the user code reaches flows through `inputData` / `input`
  // (resolved above) or via `context.actions.<template>(...)` invocation.
  const sandboxContext = buildSandboxContext({
    env: input.runContext.envLookup,
    inputData: resolvedInputData,
    ...(resolvedInput !== undefined ? { input: resolvedInput } : {}),
    packages: packagesProxy,
    actions: actionsProxy,
    log: NOOP_LOG,
    // Threaded through by `dispatchWithRetry` (run-automation.ts); defaults
    // to 1 when invoked outside the retry loop. Surfaced as
    // `context.run.attempt` — APP-AUTOMATION-RETRY-015.
    attempt: input.runContext.attempt ?? 1,
  })

  const compiled = compileExecuteFnSafe(input.code)
  if (compiled._tag === 'error') return { status: 'failure', error: compiled.message }
  return await runUserCode(compiled.fn, sandboxContext, input.timeoutMs)
}

/**
 * Wrap `compileExecuteFn` in a tagged-result helper so the call site
 * doesn't need a try/catch. The compile path can throw (malformed user
 * code, syntax errors); we capture those as `error` so the failure
 * matches the rest of the pipeline's Either-style flow.
 */
type CompileResult =
  | {
      readonly _tag: 'ok'
      readonly fn: (context: Readonly<Record<string, unknown>>) => unknown
    }
  | { readonly _tag: 'error'; readonly message: string }

const compileExecuteFnSafe = (source: string): CompileResult => {
  try {
    return { _tag: 'ok', fn: compileExecuteFn(source) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown compile error'
    return { _tag: 'error', message: `code action failed to compile: ${detail}` }
  }
}

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
    const declaredPackages = Array.isArray(props['packages'])
      ? (props['packages'] as ReadonlyArray<string>)
      : []
    const timeoutMs =
      typeof props['timeout'] === 'number' && Number.isFinite(props['timeout'])
        ? (props['timeout'] as number)
        : DEFAULT_TIMEOUT_MS

    // Resolve `inputData` against the code-specific context. We use the raw
    // (pre-substitution) inputData from `runContext.rawAction` because the
    // global engine cannot see `steps.<name>` and uses a different
    // `trigger.data` shape.
    const rawProps = (runContext.rawAction['props'] as Record<string, unknown> | undefined) ?? {}
    const rawInputData = (rawProps['inputData'] as Record<string, unknown> | undefined) ?? {}
    const rawInput = rawProps['input'] as Record<string, unknown> | undefined

    // Yield the startup-resolved package map so user code reads from
    // the cached imports rather than triggering a per-call dynamic
    // import (which would defeat the fail-fast guarantee).
    const resolver = yield* PackageResolver
    return yield* Effect.promise(() =>
      runCodeActionAsync({
        code,
        declaredPackages,
        rawInputData,
        rawInput,
        runContext,
        timeoutMs,
        packageLookup: (name: string) => resolver.lookup(name),
      })
    )
  })
