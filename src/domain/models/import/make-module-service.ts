/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The modules of a Make blueprint `flow[]` as `CanonicalStep`s and edges, read
 * in the shapes the pinned blueprint captures store them:
 *
 * - **A module** `app:action` is an app step: its `parameters` and `mapper`
 *   are its inputs (a connection reference `__IMT…` is left out), tokenised as
 *   IML. An HTTP module with a raw body and no query string or credentials is
 *   an `http` step; a Sleep with a constant number of seconds is a pause.
 * - **A filter** on a module gates it: outer `conditions` OR-ed, inner AND-ed.
 *   A single AND group, or OR-ed single rules, is one condition; any other mix
 *   has no `CanonicalCondition` and becomes an `unknown` step quoting it.
 * - **Routers, if-else, merges and iterators** are read by
 *   `make-control-flow-service.ts`.
 * - **An error handler** (`onerror`, such as Break, which Make retries later
 *   from its incomplete-executions store) has no exact Sovrium equivalent: it
 *   is quoted as an `unknown` step after the module it guards.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { isCredentialName } from './credential-redaction-service'
import { ifElsePiece, loopPiece, mergePiece, routerPiece } from './make-control-flow-service'
import { tokeniseMakeValue } from './make-expression-service'
import {
  EMPTY,
  conditionOf,
  labelOf,
  modulesOf,
  objectOf,
  rawOf,
  single,
  splitModule,
  then,
  unknownStep,
  type MakeModule,
  type MakeScope,
  type Piece,
} from './make-piece-service'
import type { CanonicalStep } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>

/**
 * The Make connection a module runs with, labelled `make:<__IMTCONN__>`: read
 * here, before {@link withoutConnection} drops the reference from its inputs.
 */
const credentialOf = (module: MakeModule): { readonly credential?: string } => {
  const connection = objectOf(module['parameters'])['__IMTCONN__']
  return typeof connection === 'number' || (typeof connection === 'string' && connection !== '')
    ? { credential: `make:${String(connection)}` }
    : {}
}

/** Every key but a connection reference (`__IMTCONN__`), whose id means nothing elsewhere. */
const withoutConnection = (value: Json): Json =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('__IMT')))

const inputsOf = (module: MakeModule, scope: MakeScope): Readonly<Record<string, unknown>> =>
  tokeniseMakeValue(
    { ...withoutConnection(objectOf(module['parameters'])), ...objectOf(module['mapper']) },
    scope.trigger
  ) as Readonly<Record<string, unknown>>

/** A filter that gates a module, as a step before it; a filter testing nothing is no step. */
const filterPiece = (module: MakeModule, scope: MakeScope): Piece => {
  const filter = objectOf(module['filter'])
  const condition = conditionOf(filter['conditions'], scope)
  if (condition === undefined) return EMPTY
  const id = `${String(module.id)}:filter`
  const name =
    typeof filter['name'] === 'string' && filter['name'] !== '' ? filter['name'] : 'Filter'
  return single(
    condition === 'mixed'
      ? unknownStep(id, name, 'filter', filter)
      : { id, name, kind: 'filter', condition }
  )
}

/** Whether an HTTP module is one the `http` step says exactly: no query string, credentials or form body. */
const isPlainHttp = (module: MakeModule, mapper: Json): boolean => {
  const bodyType = mapper['bodyType'] ?? ''
  return (
    module.module === 'http:ActionSendData' &&
    mapper['url'] !== undefined &&
    arrayOf(mapper['qs']).length === 0 &&
    (bodyType === '' || bodyType === 'raw') &&
    (mapper['authUser'] ?? '') === '' &&
    (mapper['authPass'] ?? '') === ''
  )
}

/**
 * The request headers, credentials left out (a header holding one is never
 * copied: the connection names it instead), plus the content type a raw body declares. */
const headersOf = (mapper: Json): Json => {
  const listed = Object.fromEntries(
    arrayOf(mapper['headers'])
      .filter(isRecord)
      .flatMap((header) =>
        typeof header['name'] === 'string' && !isCredentialName(header['name'])
          ? [[header['name'], header['value']] as const]
          : []
      )
  )
  const { contentType } = mapper
  const declared = Object.keys(listed).some((name) => name.toLowerCase() === 'content-type')
  return typeof contentType === 'string' && !declared
    ? { ...listed, 'Content-Type': contentType }
    : listed
}

/** An HTTP module the `http` step says exactly, or `undefined`. */
const httpStep = (module: MakeModule, scope: MakeScope): CanonicalStep | undefined => {
  const mapper = objectOf(module['mapper'])
  if (!isPlainHttp(module, mapper)) return undefined
  const body =
    mapper['bodyType'] === 'raw' && mapper['data'] !== undefined
      ? { body: tokeniseMakeValue(mapper['data'], scope.trigger) }
      : {}
  return {
    id: String(module.id),
    name: labelOf(module),
    kind: 'http',
    method: String(mapper['method'] ?? 'get').toUpperCase(),
    url: tokeniseMakeValue(mapper['url'], scope.trigger),
    headers: tokeniseMakeValue(headersOf(mapper), scope.trigger) as Json,
    ...body,
  }
}

/** A Sleep of a constant number of seconds, as a pause, or `undefined`. */
const sleepStep = (module: MakeModule): CanonicalStep | undefined => {
  const seconds = Number(objectOf(module['mapper'])['duration'])
  if (module.module !== 'util:FunctionSleep' || !Number.isInteger(seconds) || seconds <= 0) {
    return undefined
  }
  return {
    id: String(module.id),
    name: labelOf(module),
    kind: 'delay',
    duration: `PT${String(seconds)}S`,
  }
}

/** One plain module as its step. */
const stepOf = (module: MakeModule, scope: MakeScope): CanonicalStep => {
  const typed = httpStep(module, scope) ?? sleepStep(module)
  if (typed !== undefined) return typed
  const { action } = splitModule(module.module)
  return {
    id: String(module.id),
    name: labelOf(module),
    kind: 'app-action',
    app: module.module,
    operation: action,
    inputs: inputsOf(module, scope),
    ...credentialOf(module),
  }
}

/** The error handlers of a module, each quoted as a step after it. */
const handlersPiece = (module: MakeModule): Piece =>
  modulesOf(module['onerror'])
    .map((handler) =>
      single(
        unknownStep(
          String(handler.id),
          `${labelOf(handler)} (error handler of ${labelOf(module)})`,
          `onerror:${handler.module}`,
          { guards: module.module, handler: rawOf(handler) }
        )
      )
    )
    .reduce(then, EMPTY)

/** One module, its gate before it and its error handlers after it. */
const modulePiece = (module: MakeModule, scope: MakeScope, gated: boolean): Piece => {
  const gate = gated ? filterPiece(module, scope) : EMPTY
  if (module.module === 'builtin:BasicRouter')
    return then(gate, routerPiece(module, scope, chainOf))
  if (module.module === 'builtin:BasicIfElse')
    return then(gate, ifElsePiece(module, scope, chainOf))
  if (module.module === 'builtin:BasicMerge') return then(gate, mergePiece(module))
  return then(then(gate, single(stepOf(module, scope))), handlersPiece(module))
}

/**
 * A `flow[]` as one piece. On a route's first module the filter is the
 * route's condition, so it is not read again as a gate.
 */
export function chainOf(
  flow: readonly MakeModule[],
  scope: MakeScope,
  options: { readonly routeHead?: boolean } = {}
): Piece {
  const [head, ...tail] = flow
  if (head === undefined) return EMPTY
  const gated = options.routeHead !== true
  if (head.module === 'builtin:BasicFeeder') {
    return then(gated ? filterPiece(head, scope) : EMPTY, loopPiece(head, tail, scope, chainOf))
  }
  return then(modulePiece(head, scope, gated), chainOf(tail, scope))
}
