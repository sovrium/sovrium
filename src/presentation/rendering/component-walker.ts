/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export function collectFromComponentTree<T>(
  node: unknown,
  options: {
    readonly visit: (node: unknown) => readonly T[]
    readonly shouldSkip?: (node: unknown) => boolean
  }
): readonly T[] {
  const { visit, shouldSkip } = options
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectFromComponentTree(child, options))
  }
  if (shouldSkip?.(node)) return []
  const selfValues = visit(node)
  if (typeof node !== 'object' || node === null) return selfValues
  const { children, component: wrapped } = node as {
    readonly children?: ReadonlyArray<unknown>
    readonly component?: unknown
  }
  const childValues = children === undefined ? [] : collectFromComponentTree(children, options)
  const wrappedValues = wrapped === undefined ? [] : collectFromComponentTree(wrapped, options)
  return [...selfValues, ...childValues, ...wrappedValues]
}
