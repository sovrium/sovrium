/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Stream, type Context, type Scope } from 'effect'
import type * as LanguageModel from 'effect/ai/LanguageModel'

/**
 * The built language model for one connection, from the services the AI layer
 * owns: built on first use, then the same model for every later call.
 */
export type LanguageModelContexts = (
  key: string,
  make: () => Layer.Layer<LanguageModel.LanguageModel>
) => Effect.Effect<Context.Context<LanguageModel.LanguageModel>>

/**
 * Hold each connection's model layer under its `key` and build it at most once,
 * into `scope`, the scope of the layer that owns the AI service.
 *
 * Providing a model LAYER to a call builds the model and its HTTP client for
 * that call alone. The adapter is chosen per call (the routing follows Ollama's
 * reachability), so the key names the connection the routing chose, and the
 * memo map turns the same layer, asked for again, into the one it built.
 */
export const makeLanguageModelContexts = (
  memoMap: Layer.MemoMap,
  scope: Scope.Scope
): LanguageModelContexts => {
  const layers = new Map<string, Layer.Layer<LanguageModel.LanguageModel>>()
  return (key, make) => {
    const known = layers.get(key)
    const layer = known ?? make()
    if (known === undefined) layers.set(key, layer)
    return Layer.buildWithMemoMap(layer, memoMap, scope)
  }
}

/** A built model, as {@link LanguageModelContexts} answers it. */
type BuiltModel = Effect.Effect<Context.Context<LanguageModel.LanguageModel>>

/** `program` run on the built `model`. */
export const onModel = <A, E, R>(
  model: BuiltModel,
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, Exclude<R, LanguageModel.LanguageModel>> =>
  Effect.flatMap(model, (built) => Effect.provide(program, built))

/** `stream` run on the built `model`. */
export const streamOnModel = <A, E, R>(
  model: BuiltModel,
  stream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, Exclude<R, LanguageModel.LanguageModel>> =>
  Stream.unwrap(Effect.map(model, (built) => Stream.provideContext(stream, built)))
