/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { FeatureEntry, ParsedFeatures } from './features-parser'

export class DependencyCycleError extends Error {
  readonly cycle: readonly string[]

  constructor(cycle: readonly string[]) {
    super(`Dependency cycle detected: ${cycle.join(' → ')}`)
    this.name = 'DependencyCycleError'
    this.cycle = cycle
  }
}

type AdjacencyList = Map<string, Set<string>>

export function buildDependencyGraph(parsed: ParsedFeatures): AdjacencyList {
  const graph: AdjacencyList = new Map()
  const allUsIds = new Set(parsed.entries.map((e) => e.usId))

  for (const usId of allUsIds) {
    graph.set(usId, new Set())
  }

  const domainToUsIds = new Map<string, string[]>()
  for (const entry of parsed.entries) {
    const existing = domainToUsIds.get(entry.domain)
    if (existing) {
      existing.push(entry.usId)
    } else {
      domainToUsIds.set(entry.domain, [entry.usId])
    }
  }

  for (const dep of parsed.dependencies) {
    const domainUsIds = domainToUsIds.get(dep.domain) ?? []

    for (const depUsId of dep.dependsOn) {
      if (!allUsIds.has(depUsId)) continue

      for (const usId of domainUsIds) {
        if (usId === depUsId) continue

        const deps = graph.get(usId)
        if (deps) {
          deps.add(depUsId)
        }
      }
    }
  }

  return graph
}

export function topologicalSort(graph: AdjacencyList, _entries: readonly FeatureEntry[]): string[] {
  const inDegree = new Map<string, number>()
  const reverseGraph = new Map<string, Set<string>>()

  for (const [node] of graph) {
    inDegree.set(node, 0)
    reverseGraph.set(node, new Set())
  }

  for (const [dependent, dependencies] of graph) {
    for (const dep of dependencies) {
      inDegree.set(dependent, (inDegree.get(dependent) ?? 0) + 1)
      const rev = reverseGraph.get(dep)
      if (rev) {
        rev.add(dependent)
      }
    }
  }

  const queue: string[] = []
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node)
    }
  }
  queue.sort()

  const sorted: string[] = []

  while (queue.length > 0) {
    queue.sort()

    const node = queue.shift()!
    sorted.push(node)

    const dependents = reverseGraph.get(node) ?? new Set()
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, newDegree)
      if (newDegree === 0) {
        queue.push(dependent)
      }
    }
  }

  if (sorted.length !== graph.size) {
    const remaining = [...graph.keys()].filter((n) => !sorted.includes(n))
    throw new DependencyCycleError(remaining)
  }

  return sorted
}

export function assignPriorities(
  sortedUsIds: readonly string[],
  entries: readonly FeatureEntry[]
): Map<string, number> {
  const entryMap = new Map(entries.map((e) => [e.usId, e]))
  const priorities = new Map<string, number>()

  const phaseGroups = new Map<number, string[]>()
  for (const usId of sortedUsIds) {
    const entry = entryMap.get(usId)
    const phase = entry?.phase ?? 0
    const group = phaseGroups.get(phase)
    if (group) {
      group.push(usId)
    } else {
      phaseGroups.set(phase, [usId])
    }
  }

  const phases = [...phaseGroups.keys()].sort((a, b) => a - b)
  for (const phase of phases) {
    const group = phaseGroups.get(phase) ?? []
    const base = phase * 1000

    for (let i = 0; i < group.length; i++) {
      const usId = group[i]!
      priorities.set(usId, base + i)
    }
  }

  return priorities
}

export function computePriorities(parsed: ParsedFeatures): Map<string, number> {
  const graph = buildDependencyGraph(parsed)
  const sorted = topologicalSort(graph, parsed.entries)
  return assignPriorities(sorted, parsed.entries)
}
