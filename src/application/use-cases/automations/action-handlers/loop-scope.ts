/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The loops an action sits in, as its templates read them.
 *
 * Each `loop/each` item pushes one scope — the loop's step name, the item and
 * its position — onto the chain it hands its body, and a loop or a path nested
 * in that body carries the chain on to its own actions. The chain travels with
 * the run context rather than being rebuilt from it: a container fills its own
 * body when it runs, so the scopes around it must reach it intact.
 *
 * Two template roots read the chain:
 *
 *  - `{{loop.item}}`, `{{loop.item.<field>}}`, `{{loop.index}}` — the
 *    innermost loop;
 *  - `{{loops.<loop name>.item}}`, `{{loops.<loop name>.index}}` — any loop
 *    the action sits in, the innermost included, by its step name. Outside
 *    that loop the name reads nothing, like any unknown path.
 *
 * A step may not be named `loop` or `loops` (refused at validation), so no
 * step output shadows either root.
 */

/** One loop an action sits in: the loop step's name, the current item and its position. */
export interface LoopScope {
  readonly name: string
  readonly item: unknown
  readonly index: number
}

/** The chain an item's body runs under: the enclosing scopes, then this loop's own. */
export const pushLoopScope = (
  enclosing: readonly LoopScope[] | undefined,
  scope: LoopScope
): readonly LoopScope[] => [...(enclosing ?? []), scope]

/**
 * The `loop` and `loops` roots of a template context, or nothing outside any
 * loop — so a context with no loop around it is exactly what it was.
 */
export const loopScopeRoots = (
  scopes: readonly LoopScope[] | undefined
): Readonly<Record<string, unknown>> => {
  const innermost = scopes?.at(-1)
  if (scopes === undefined || innermost === undefined) return {}
  return {
    loop: { item: innermost.item, index: innermost.index },
    loops: Object.fromEntries(
      scopes.map((scope) => [scope.name, { item: scope.item, index: scope.index }])
    ),
  }
}
