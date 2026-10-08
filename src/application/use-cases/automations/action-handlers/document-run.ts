/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import {
  RENDER_DOCUMENT_ORIGIN,
  type AssetResolver,
} from '@/application/ports/services/document-renderer'
import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import type { ActionOutcome, ActionRunContext } from './shared'

/**
 * What every `document/*` and `pdf/*` handler shares around its own work:
 * reading `data` with its types kept, serving declared assets to a render,
 * and turning the handler's program into the step's outcome.
 */

export { isRecord, type Raw }

/** The action's `props`, or none. */
export const actionPropsOf = (action: Raw): Raw =>
  isRecord(action['props']) ? action['props'] : {}

/** The `output` prop, or none. */
export const outputPropOf = (props: Raw): Raw => (isRecord(props['output']) ? props['output'] : {})

/**
 * A prop resolved with its types kept: `'{{steps.fetchLines.result}}'` stays
 * the array it names. Read from the authored props (the run's generic pass
 * stringifies non-scalar values), or as given when the props are final.
 */
export const typedOwnProp = (
  props: Raw,
  name: string,
  runContext: ActionRunContext | undefined
): unknown => {
  if (runContext === undefined) return props[name]
  const authored = authoredActionProps(runContext)[name]
  return authored === undefined ? props[name] : resolveOwnProp(runContext, authored)
}

/** The action's `data`: the template's whole context. */
export const documentDataOf = (props: Raw, runContext: ActionRunContext | undefined): Raw => {
  const data = typedOwnProp(props, 'data', runContext)
  return isRecord(data) ? data : {}
}

/** A percent-encoded path, decoded; a malformed escape (`%zz`) names no asset. */
const decodedPath = (encoded: string): string | undefined => {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return undefined
  }
}

/**
 * Serves a declared asset to the render when the page asks for it by its
 * path (`<img src="images/logo.png">` resolves against the render origin), so
 * the engine never reaches the network for it.
 */
export const documentAssetResolver: Effect.Effect<AssetResolver> = Effect.gen(function* () {
  const store = yield* AssetStore
  const prefix = `${RENDER_DOCUMENT_ORIGIN}/`
  return (url: string) => {
    if (!url.startsWith(prefix)) return Promise.resolve(undefined)
    const path = decodedPath(url.slice(prefix.length).split(/[?#]/, 1)[0] ?? '')
    const asset = path === undefined ? undefined : store.get(path)
    return Promise.resolve(
      asset === undefined ? undefined : { bytes: asset.bytes, contentType: asset.contentType }
    )
  }
}).pipe(Effect.withSpan('automations.document-asset-resolver'))

/** A typed failure, as the step's error: every failure here carries a readable `message`. */
export const failureOf = (operation: string, error: unknown): ActionOutcome => {
  const message =
    isRecord(error) && typeof error['message'] === 'string' ? error['message'] : String(error)
  return { status: 'failure', error: `${operation}: ${message}`, retryable: false }
}

/**
 * Run a handler's program as the step: its output on success, its typed
 * failure as the step's error (`operation: message`). Every `document/*` and
 * `pdf/*` handler ends here, so the outcome shape cannot drift between them.
 */
export const runDocumentAction = <E, R>(
  operation: string,
  program: Effect.Effect<Raw, E, R>
): Effect.Effect<ActionOutcome, never, R> =>
  Effect.map(Effect.result(program), (outcome): ActionOutcome =>
    outcome._tag === 'Failure'
      ? failureOf(operation, outcome.failure)
      : { status: 'success', output: { ...outcome.success } }
  ).pipe(Effect.withSpan('automations.document-action-outcome', { attributes: { operation } }))
