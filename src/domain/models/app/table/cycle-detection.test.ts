/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { detectCycles } from './cycle-detection'

describe('detectCycles', () => {
  test('should detect no cycles in empty graph', () => {
    const graph = new Map<string, ReadonlyArray<string>>()
    const result = detectCycles(graph)
    expect(result).toEqual([])
  })

  test('should detect no cycles in acyclic graph', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', []],
    ])
    const result = detectCycles(graph)
    expect(result).toEqual([])
  })

  test('should detect simple cycle (A -> B -> A)', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['A']],
    ])
    const result = detectCycles(graph)
    expect(result.length).toBeGreaterThan(0)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('B')).toBe(true)
  })

  test('should detect three-node cycle (A -> B -> C -> A)', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ])
    const result = detectCycles(graph)
    expect(result.length).toBeGreaterThan(0)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('B')).toBe(true)
    expect(result.includes('C')).toBe(true)
  })

  test('should detect self-referencing cycle (A -> A)', () => {
    const graph = new Map([['A', ['A']]])
    const result = detectCycles(graph)
    expect(result).toEqual(['A'])
  })

  test('should detect cycle in complex graph with branches', () => {
    const graph = new Map([
      ['A', ['B', 'D']],
      ['B', ['C']],
      ['C', ['A']], // Cycle: A -> B -> C -> A
      ['D', ['E']],
      ['E', []], // No cycle in this branch
    ])
    const result = detectCycles(graph)
    expect(result.length).toBeGreaterThan(0)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('B')).toBe(true)
    expect(result.includes('C')).toBe(true)
  })

  test('should detect cycle nodes when traversing from non-cycle node', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['B']], // Cycle: B -> C -> B
      ['D', ['E']],
      ['E', []],
    ])
    const result = detectCycles(graph)
    // When DFS starts from A and traverses to B->C->B, the cycle includes nodes in the path
    expect(result.includes('B')).toBe(true)
    expect(result.includes('C')).toBe(true)
    // A is included because it's part of the path when the cycle is discovered
    expect(result.includes('A')).toBe(true)
    // D and E are in a separate branch with no cycle
    expect(result.includes('D')).toBe(false)
    expect(result.includes('E')).toBe(false)
  })

  test('should detect cycle with missing dependencies (edges to non-existent nodes)', () => {
    const graph = new Map([
      ['A', ['B', 'X']], // X doesn't exist in graph
      ['B', ['C']],
      ['C', ['A']],
    ])
    const result = detectCycles(graph)
    expect(result.length).toBeGreaterThan(0)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('B')).toBe(true)
    expect(result.includes('C')).toBe(true)
  })

  test('should handle multiple independent cycles', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['A']], // Cycle 1: A -> B -> A
      ['C', ['D']],
      ['D', ['C']], // Cycle 2: C -> D -> C
    ])
    const result = detectCycles(graph)
    // Should detect at least one cycle (the algorithm returns the first found)
    expect(result.length).toBeGreaterThan(0)
  })

  test('should handle diamond pattern without cycle', () => {
    const graph = new Map([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['D']],
      ['D', []],
    ])
    const result = detectCycles(graph)
    expect(result).toEqual([])
  })

  test('should handle nodes with no outgoing edges', () => {
    const graph = new Map([
      ['A', []],
      ['B', []],
      ['C', []],
    ])
    const result = detectCycles(graph)
    expect(result).toEqual([])
  })

  test('should detect cycle in larger graph (5 nodes)', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['D']],
      ['D', ['E']],
      ['E', ['A']], // Cycle: A -> B -> C -> D -> E -> A
    ])
    const result = detectCycles(graph)
    expect(result.length).toBe(5)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('B')).toBe(true)
    expect(result.includes('C')).toBe(true)
    expect(result.includes('D')).toBe(true)
    expect(result.includes('E')).toBe(true)
  })

  test('should handle graph with multiple dependencies per node', () => {
    const graph = new Map([
      ['A', ['B', 'C', 'D']],
      ['B', []],
      ['C', []],
      ['D', []],
    ])
    const result = detectCycles(graph)
    expect(result).toEqual([])
  })

  test('should detect cycle in graph with multiple dependencies and cycle', () => {
    const graph = new Map([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['D']],
      ['D', ['A']], // Cycle: A -> B -> D -> A (or A -> C -> D -> A)
    ])
    const result = detectCycles(graph)
    expect(result.length).toBeGreaterThan(0)
    expect(result.includes('A')).toBe(true)
    expect(result.includes('D')).toBe(true)
  })
})
