#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dependency Analysis for TDD Queue Specs
 *
 * Analyzes test file dependencies to build a dependency graph.
 * This helps the queue manager prioritize specs with no dependencies,
 * reducing implementation failures caused by missing dependencies.
 *
 * Algorithm:
 * 1. Read all spec files from tdd-queue-scan.json
 * 2. For each spec, analyze test file imports
 * 3. Identify dependencies on Domain/Application/Infrastructure layers
 * 4. Build dependency graph: which specs depend on which files
 * 5. Calculate which specs are "ready" (no missing dependencies)
 * 6. Store graph in .github/tdd-queue-dependencies.json
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  CommandServiceLive,
  LoggerServicePretty,
  logInfo,
  logError,
  logWarn,
  success,
} from '../lib/effect'

interface SpecScanResult {
  specId: string
  file: string
  feature: string
  line: number
}

interface QueueScanData {
  totalSpecs: number
  specs: SpecScanResult[]
  scannedAt: string
}

interface FileDependency {
  file: string
  exists: boolean
  layer: 'domain' | 'application' | 'infrastructure' | 'presentation' | 'unknown'
}

interface SpecDependencyInfo {
  specId: string
  file: string
  dependencies: FileDependency[]
  missingDependencies: string[]
  canImplement: boolean
  blockedBy: string[]
}

interface DependencyGraph {
  [specId: string]: SpecDependencyInfo
}

/**
 * Extract import statements from a TypeScript file
 */
const extractImports = (filePath: string): string[] => {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const importRegex = /import\s+(?:{[^}]*}|[^'"]*)\s+from\s+['"]([^'"]+)['"]/g
  const imports: string[] = []

  let match
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1]
    if (importPath) {
      imports.push(importPath)
    }
  }

  return imports
}

/**
 * Resolve import path to actual file path
 */
const resolveImportPath = (importPath: string, fromFile: string): string | null => {
  // Skip external packages
  if (
    !importPath.startsWith('./') &&
    !importPath.startsWith('../') &&
    !importPath.startsWith('@/')
  ) {
    return null
  }

  // Convert @/ alias based on tsconfig paths
  let resolvedPath = importPath
  if (resolvedPath.startsWith('@/specs/')) {
    // @/specs/* maps to specs/* (not src/specs/*)
    resolvedPath = resolvedPath.replace('@/specs/', 'specs/')
  } else if (resolvedPath.startsWith('@/')) {
    // @/* maps to src/*
    resolvedPath = resolvedPath.replace('@/', 'src/')
  } else {
    // Relative import - resolve relative to fromFile
    const dir = path.dirname(fromFile)
    resolvedPath = path.join(dir, importPath)
  }

  // Try common extensions
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  // If file doesn't exist yet, return the path anyway (it's a missing dependency)
  return resolvedPath + '.ts'
}

/**
 * Determine layer from file path
 */
const getLayerFromPath = (
  filePath: string
): 'domain' | 'application' | 'infrastructure' | 'presentation' | 'unknown' => {
  if (filePath.includes('/domain/')) return 'domain'
  if (filePath.includes('/application/')) return 'application'
  if (filePath.includes('/infrastructure/')) return 'infrastructure'
  if (filePath.includes('/presentation/')) return 'presentation'
  return 'unknown'
}

/**
 * Analyze dependencies for a single spec
 */
const analyzeSpecDependenciesForSpec = (spec: SpecScanResult): SpecDependencyInfo => {
  const imports = extractImports(spec.file)
  const dependencies: FileDependency[] = []
  const missingDependencies: string[] = []

  for (const importPath of imports) {
    const resolvedPath = resolveImportPath(importPath, spec.file)
    if (!resolvedPath) continue // Skip external packages

    const exists = fs.existsSync(resolvedPath)
    const layer = getLayerFromPath(resolvedPath)

    dependencies.push({
      file: resolvedPath,
      exists,
      layer,
    })

    if (!exists) {
      missingDependencies.push(resolvedPath)
    }
  }

  const canImplement = missingDependencies.length === 0

  return {
    specId: spec.specId,
    file: spec.file,
    dependencies,
    missingDependencies,
    canImplement,
    blockedBy: [], // Will be populated later
  }
}

/**
 * Build dependency graph from scan results
 */
const buildDependencyGraph = (scanData: QueueScanData): DependencyGraph => {
  const graph: DependencyGraph = {}

  // Analyze each spec
  for (const spec of scanData.specs) {
    graph[spec.specId] = analyzeSpecDependenciesForSpec(spec)
  }

  return graph
}

/**
 * Save dependency graph to file
 */
const saveDependencyGraph = (graph: DependencyGraph, outputPath: string): void => {
  const json = JSON.stringify(graph, null, 2)
  fs.writeFileSync(outputPath, json, 'utf-8')
}

/**
 * Main dependency analysis
 */
const analyzeSpecDependencies = Effect.gen(function* () {
  yield* logInfo('Analyzing spec dependencies...', '🔍')

  // Read scan results
  const scanFilePath = '.github/tdd-queue-scan.json'
  if (!fs.existsSync(scanFilePath)) {
    yield* logError(`Scan file not found: ${scanFilePath}`)
    yield* logInfo('  Run queue-manager.ts scan first')
    return yield* Effect.fail(new Error('No scan results found'))
  }

  const scanData: QueueScanData = JSON.parse(fs.readFileSync(scanFilePath, 'utf-8'))
  yield* logInfo(`  Found ${scanData.totalSpecs} specs to analyze`, '📊')
  yield* logInfo('')

  if (scanData.totalSpecs === 0) {
    yield* success('No specs to analyze')
    return
  }

  // Build dependency graph
  yield* logInfo('Building dependency graph...', '🔗')
  const graph = buildDependencyGraph(scanData)

  // Count statistics
  const totalSpecs = Object.keys(graph).length
  const readySpecs = Object.values(graph).filter((info) => info.canImplement).length
  const blockedSpecs = totalSpecs - readySpecs

  yield* logInfo('')
  yield* logInfo('─'.repeat(80))
  yield* logInfo('')

  // Show ready specs
  if (readySpecs > 0) {
    yield* success(`✅ Ready to implement: ${readySpecs} specs`)
    const ready = Object.values(graph).filter((info) => info.canImplement)
    for (const info of ready.slice(0, 5)) {
      // Show first 5
      yield* logInfo(`   ${info.specId}`)
    }
    if (ready.length > 5) {
      yield* logInfo(`   ... and ${ready.length - 5} more`)
    }
  }

  yield* logInfo('')

  // Show blocked specs
  if (blockedSpecs > 0) {
    yield* logWarn(`⚠️  Blocked by missing dependencies: ${blockedSpecs} specs`)
    const blocked = Object.values(graph).filter((info) => !info.canImplement)
    for (const info of blocked.slice(0, 5)) {
      // Show first 5
      yield* logWarn(`   ${info.specId}: ${info.missingDependencies.length} missing files`)
      for (const missing of info.missingDependencies.slice(0, 2)) {
        yield* logInfo(`      - ${missing}`)
      }
      if (info.missingDependencies.length > 2) {
        yield* logInfo(`      ... and ${info.missingDependencies.length - 2} more`)
      }
    }
    if (blocked.length > 5) {
      yield* logInfo(`   ... and ${blocked.length - 5} more blocked specs`)
    }
  }

  yield* logInfo('')
  yield* logInfo('─'.repeat(80))
  yield* logInfo('')

  // Save dependency graph
  const outputPath = '.github/tdd-queue-dependencies.json'
  saveDependencyGraph(graph, outputPath)
  yield* success(`Dependency graph saved to ${outputPath}`)

  yield* logInfo('')
  yield* logInfo('📊 Dependency Analysis Summary:')
  yield* logInfo(`   Total specs: ${totalSpecs}`)
  yield* logInfo(`   ✅ Ready: ${readySpecs} (${Math.round((readySpecs / totalSpecs) * 100)}%)`)
  yield* logInfo(
    `   ⚠️  Blocked: ${blockedSpecs} (${Math.round((blockedSpecs / totalSpecs) * 100)}%)`
  )
  yield* logInfo('')
})

// Run analysis
const program = analyzeSpecDependencies

const runnable = program.pipe(
  Effect.provide(Layer.merge(CommandServiceLive, LoggerServicePretty()))
)

Effect.runPromise(runnable)
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Dependency analysis failed:', error)
    process.exit(1)
  })
