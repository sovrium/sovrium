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


const DEFAULT_TIMEOUT_MS = 30_000

const stripVersionPin = (spec: string): string => {
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

const proxyMissingPackage = (name: string): never => {
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
        return Object.keys(loaded)
      },
    }
  )

const buildCodeTriggerView = (
  triggerData: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const { body } = triggerData
  const fromBody: Record<string, unknown> =
    body !== undefined && body !== null && typeof body === 'object'
      ? { ...(body as Record<string, unknown>) }
      : {}
  const envelopeAdditions = Object.fromEntries(
    Object.keys(triggerData)
      .filter((key) => triggerData[key] !== undefined && !(key in fromBody))
      .map((key) => [key, triggerData[key]] as const)
  )
  return { ...fromBody, ...envelopeAdditions }
}


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

const buildSandboxContext = (input: {
  readonly env: Readonly<Record<string, string>>
  readonly inputData: Readonly<Record<string, unknown>>
  readonly input?: Readonly<Record<string, unknown>>
  readonly packages: Readonly<Record<string, unknown>>
  readonly actions: Readonly<Record<string, unknown>>
  readonly log: Readonly<Record<string, (...args: ReadonlyArray<unknown>) => void>>
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

const compileExecuteFn = (
  source: string
): ((context: Readonly<Record<string, unknown>>) => unknown) => {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      isolatedModules: true,
    },
  }).outputText
  const wrapper = `${transpiled}\n; if (typeof execute !== 'function') { throw new Error('code action must define a function named "execute"') } execute;`
  const script = new vm.Script(wrapper, { filename: 'code-action.js' })
  return (context) => {
    const sandbox: Record<string, unknown> = {
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
      context,
    }
    const vmContext = vm.createContext(sandbox)
    const fn = script.runInContext(vmContext) as (ctx: Readonly<Record<string, unknown>>) => unknown
    return fn(context)
  }
}

interface TimerBox {
  readonly handle: ReturnType<typeof setTimeout>
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  const timerBox: { current?: TimerBox } = {}
  const timeout = new Promise<never>((_resolve, reject) => {
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

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { then?: unknown }).then === 'function'

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

interface RunCodeActionInput {
  readonly code: string
  readonly declaredPackages: ReadonlyArray<string>
  readonly rawInputData: Readonly<Record<string, unknown>>
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
  const lookupResult = lookupDeclaredPackages(input.declaredPackages, input.packageLookup)
  if (lookupResult._tag === 'error') {
    return { status: 'failure', error: lookupResult.message }
  }
  const packagesProxy = buildPackagesProxy(lookupResult.packages)
  const actionsProxy = buildActionsProxy({
    invokeTemplate: input.runContext.invokeTemplate ?? NOOP_INVOKE_TEMPLATE,
    invokeNativeAction: input.runContext.invokeNativeAction ?? NOOP_INVOKE_NATIVE,
  })

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

  const sandboxContext = buildSandboxContext({
    env: input.runContext.envLookup,
    inputData: resolvedInputData,
    ...(resolvedInput !== undefined ? { input: resolvedInput } : {}),
    packages: packagesProxy,
    actions: actionsProxy,
    log: NOOP_LOG,
    attempt: input.runContext.attempt ?? 1,
  })

  const compiled = compileExecuteFnSafe(input.code)
  if (compiled._tag === 'error') return { status: 'failure', error: compiled.message }
  return await runUserCode(compiled.fn, sandboxContext, input.timeoutMs)
}

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

    const rawProps = (runContext.rawAction['props'] as Record<string, unknown> | undefined) ?? {}
    const rawInputData = (rawProps['inputData'] as Record<string, unknown> | undefined) ?? {}
    const rawInput = rawProps['input'] as Record<string, unknown> | undefined

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
