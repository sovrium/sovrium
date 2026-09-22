/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import {
  findSharedReferencePath,
  sharedReferenceMessage,
} from '@/domain/kernel/config-parsing/shared-reference-guard'
import { lookupPath } from '../resolve-trigger-data'
import { buildRunContextView, rawActionProps } from './run-context-resolution'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `sovrium/*` handlers — operators dedicated to the engine itself, as opposed
 * to the families that transform a run's data (`data/*`) or reach the outside
 * world (`http/*`, `email/*`, …). Currently only `validateConfig`.
 *
 * Spec: [internal ref] + REGRESSION.
 */

const ok = (output: Readonly<Record<string, unknown>>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

/**
 * A string that is *exactly* one `{{ path.to.value }}` template, with no
 * surrounding text. Deliberately a local copy rather than the one in
 * `run-context-resolution.ts`: that module's public resolver also performs
 * INTERPOLATION, which is precisely what must not happen here (see below).
 */
const WHOLE_PATH_TEMPLATE = /^\{\{\s*([\w.]+)\s*\}\}$/

/**
 * Read a prop with **deref-or-verbatim** semantics.
 *
 * WHY THIS IS NOT `resolveRunContextValue` — DO NOT "SIMPLIFY" IT BACK.
 * The shared resolver has two branches: a whole-string `{{path}}` unwraps to
 * the value at that path (safe and wanted), while ANY other string goes to
 * `resolveTriggerInString`, which rewrites every `{{...}}` occurrence found
 * *inside* it. For every other handler that is correct — their props are short
 * scalars. Here the prop is a whole candidate CONFIG, authored by someone else
 * (a webhook payload, an LLM), and interpolating it is a correctness AND a
 * security bug:
 *
 *   - `{{...}}` appearing inside the candidate — a literal a config may
 *     legitimately contain — is rewritten before decoding. Unknown paths
 *     collapse to the empty string, so the config that gets VALIDATED is not
 *     the config the caller passed, and a caller that then commits its own
 *     original has validated something else entirely.
 *   - `$env.X` inside the candidate would resolve against the HOST app's
 *     environment, leaking its secrets into the decode result and into any
 *     error message built from it.
 *
 * That defect shipped in the removed `data:validate-config`. The replacement
 * therefore reads the RAW, pre-substitution action off the run context —
 * `runContext.rawAction.props`, the only value that has been through neither
 * `resolveTriggerInValue` nor `resolveEnvInValue`, since both the run loop
 * (`step-executor.ts`) and the native-action invoker (`action-invokers.ts`)
 * hand the handler an already-substituted copy of `action.props`.
 *
 * Reading raw ALONE would be wrong in the other direction: the ordinary
 * webhook shape `props: { config: '{{trigger.data.config}}' }` would then
 * never dereference. So exactly one deref is applied, and only when the whole
 * string is a single reference.
 */
const derefOrVerbatim = (value: unknown, context: Readonly<Record<string, unknown>>): unknown => {
  if (typeof value !== 'string') return value
  const whole = WHOLE_PATH_TEMPLATE.exec(value.trim())
  return whole !== null ? lookupPath(context, whole[1] as string) : value
}

/**
 * Result of decoding a candidate config against AppSchema, surfaced so later
 * steps can branch on `.valid` / `.errors`.
 */
interface ValidateConfigResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

type ParseAttempt =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string }

const parseFailure = (format: string | undefined, reasons: readonly string[]): ParseAttempt => ({
  ok: false,
  error: `Failed to parse config (${format ?? 'json'}) — ${reasons.join('; ')}`,
})

/**
 * One structural parse attempt, reporting the failure rather than throwing.
 *
 * The candidate is intentionally untyped: it is decoded against AppSchema by
 * `decodeAppConfigObject` AFTER this parse, so no single Effect Schema applies
 * at this step.
 */
// @effect-diagnostics effect/preferSchemaOverJson:off
const attemptParse = (raw: string, as: 'json' | 'yaml'): ParseAttempt => {
  try {
    return { ok: true, value: as === 'yaml' ? Bun.YAML.parse(raw) : JSON.parse(raw) }
  } catch (error) {
    return { ok: false, error: `${as}: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Refuse a candidate whose object graph is not a tree.
 *
 * THIS IS THE REACHABLE SURFACE the guard exists for: `sovrium/validateConfig`
 * sits behind a webhook trigger, so the YAML parsed here is attacker-supplied
 * and unauthenticated. A ~600-byte alias bomb expands ~9x per level inside
 * AppSchema's decode and freezes Bun's single thread; the per-action `timeout`
 * cannot preempt it, because the decode below runs synchronously inside an
 * eagerly evaluated IIFE. See `shared-reference-guard.ts` for the measurements.
 *
 * Reported as an ordinary `{ valid: false }` verdict rather than thrown: an
 * unacceptable candidate is DATA — a generate-and-check loop must be able to
 * read the reason and try again, and later steps in the run must still execute.
 */
const guardTree = (attempt: { readonly ok: true; readonly value: unknown }): ParseAttempt => {
  const shared = findSharedReferencePath(attempt.value)
  return shared === undefined ? attempt : { ok: false, error: sharedReferenceMessage(shared) }
}

/**
 * Parse the string arm per `format`: `json` (default), `yaml`, or `auto`, which
 * tries JSON then YAML because a generated config's serialization is not always
 * known ahead of time. The fallback runs only if the primary fails, so a
 * well-formed candidate is never parsed twice.
 *
 * The guard applies to THIS arm only. `parseCandidate`'s object arm receives a
 * JS value a `code` action built in memory, where sharing a hoisted binding is
 * ordinary authoring rather than an amplification attack — the same reason the
 * guard sits at the text seam and not at the decoder.
 */
const parseConfigString = (raw: string, format: string | undefined): ParseAttempt => {
  const first = attemptParse(raw, format === 'yaml' ? 'yaml' : 'json')
  if (first.ok) return guardTree(first)
  if (format !== 'auto') return parseFailure(format, [first.error])

  const second = attemptParse(raw, 'yaml')
  return second.ok ? guardTree(second) : parseFailure(format, [first.error, second.error])
}

/**
 * Turn the `config` prop into the object `decodeAppConfigObject` expects.
 *
 * An object arm is used as-is — a `code` action holds a parsed object, and
 * round-tripping it through a string would only add a failure mode.
 *
 * A parse failure is returned as a structured error rather than thrown, so the
 * action still reports `{ valid: false, errors }` — malformed output is exactly
 * what a model emits on a bad attempt, i.e. a normal outcome.
 */
const parseCandidate = (raw: unknown, format: string | undefined): ParseAttempt => {
  if (raw !== null && typeof raw === 'object') return { ok: true, value: raw }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Config must be an object or a string, received ${typeof raw}` }
  }
  return parseConfigString(raw, format)
}

/**
 * Expose the verdict BOTH nested under `result` and flattened at the top
 * level. `buildStepsResultView` wraps a step output under `.result` only when
 * it does not already carry a `result` key, so publishing `{ result }` alone
 * would make `{{steps.<name>.result.valid}}` resolve while silently breaking
 * the bare `{{steps.<name>.valid}}`. Both are load-bearing.
 */
const validateConfigOutput = (result: ValidateConfigResult): Readonly<Record<string, unknown>> => ({
  result,
  valid: result.valid,
  errors: result.errors,
})

/**
 * `sovrium/validateConfig` — decode a candidate app config against AppSchema
 * through the platform's own decode choke point (`decodeAppConfigObject`, the
 * same one `sovrium validate` runs) and expose `{ valid, errors }`.
 * Decode-only: no side effects, no boot.
 *
 * ALWAYS `status: 'success'` — an invalid config is DATA, not a fault.
 * `dispatchActionAsPromise` throws on `status: 'failure'`, so failing here
 * would make `await context.actions.sovrium.validateConfig(...)` reject on the
 * ordinary case of a generate-and-check loop, and would fire any configured
 * `retry` on a deterministic verdict. At top level it would mark the run
 * failed and skip every later step — deleting the caller's own next step.
 * `status: 'failure'` is reserved for a genuine fault: a missing `config`.
 */
export const handleSovriumValidateConfig: ActionHandler = (
  _action,
  _app,
  _automation,
  runContext
) =>
  Effect.succeed(
    ((): ActionOutcome => {
      const props = rawActionProps(runContext as ActionRunContext)
      if (!('config' in props)) {
        return { status: 'failure', error: 'sovrium.validateConfig requires a config prop' }
      }
      const context = buildRunContextView(runContext as ActionRunContext)
      const candidate = derefOrVerbatim(props['config'], context)
      const formatValue = derefOrVerbatim(props['format'], context)
      const format = typeof formatValue === 'string' ? formatValue : undefined

      const parsed = parseCandidate(candidate, format)
      if (!parsed.ok) return ok(validateConfigOutput({ valid: false, errors: [parsed.error] }))

      const decoded = decodeAppConfigObject(parsed.value)
      return ok(
        validateConfigOutput(
          decoded.valid ? { valid: true, errors: [] } : { valid: false, errors: decoded.errors }
        )
      )
    })()
  ).pipe(Effect.withSpan('automations.handle-sovrium-validate-config'))
