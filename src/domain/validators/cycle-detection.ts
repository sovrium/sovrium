/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared cycle detection utilities using depth-first search (DFS)
 * Used for detecting circular dependencies in both formula fields and table relationships
 */

/**
 * State tracked during DFS traversal
 */
type DFSState = {
  readonly visited: ReadonlySet<string>
  readonly recursionStack: ReadonlySet<string>
  readonly cycleNodes: ReadonlyArray<string>
}

/**
 * Result of cycle detection
 */
type CycleResult = {
  readonly found: boolean
  readonly state: DFSState
}

/** DFS traversal for a single node — checks if it participates in a cycle */
const hasCycle = (
  node: string,
  state: DFSState,
  dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>>
): CycleResult => {
  if (state.recursionStack.has(node)) {
    return { found: true, state: { ...state, cycleNodes: [...state.cycleNodes, node] } }
  }

  if (state.visited.has(node)) {
    return { found: false, state }
  }

  const newState: DFSState = {
    visited: new Set([...state.visited, node]),
    recursionStack: new Set([...state.recursionStack, node]),
    cycleNodes: state.cycleNodes,
  }

  const dependencies = dependencyGraph.get(node) || []
  const result = dependencies.reduce<CycleResult>(
    (acc, dep) => {
      if (acc.found || !dependencyGraph.has(dep)) {
        return acc
      }
      const depResult = hasCycle(dep, acc.state, dependencyGraph)
      if (depResult.found) {
        const cycleNodes = depResult.state.cycleNodes.includes(node)
          ? depResult.state.cycleNodes
          : [...depResult.state.cycleNodes, node]
        return { found: true, state: { ...depResult.state, cycleNodes } }
      }
      return depResult
    },
    { found: false, state: newState }
  )

  const finalState: DFSState = {
    ...result.state,
    recursionStack: new Set([...result.state.recursionStack].filter((n) => n !== node)),
  }

  return { found: result.found, state: finalState }
}

/**
 * Detect cycles in a dependency graph using depth-first search (DFS)
 *
 * @param dependencyGraph - Map of node name to array of nodes it depends on
 * @returns Array of node names involved in circular dependencies, or empty array if none found
 *
 * @example
 * ```typescript
 * const graph = new Map([
 *   ['A', ['B']],
 *   ['B', ['C']],
 *   ['C', ['A']], // Circular: A -> B -> C -> A
 * ])
 * detectCycles(graph) // ['A', 'B', 'C']
 * ```
 */
export const detectCycles = (
  dependencyGraph: ReadonlyMap<string, ReadonlyArray<string>>
): ReadonlyArray<string> => {
  const initialState: DFSState = {
    visited: new Set(),
    recursionStack: new Set(),
    cycleNodes: [],
  }

  const result = [...dependencyGraph.keys()].reduce<CycleResult>(
    (acc, nodeName) => {
      if (acc.found || acc.state.visited.has(nodeName)) {
        return acc
      }
      return hasCycle(nodeName, acc.state, dependencyGraph)
    },
    { found: false, state: initialState }
  )

  return result.state.cycleNodes
}
