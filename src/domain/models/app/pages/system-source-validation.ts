/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * System-source reference cross-validation (CAP-4).
 *
 * A data component may bind to a named system source with the shorthand
 * `dataSource: { systemSource: <name> }`. Every referenced name must resolve to
 * a declared `app.systemSources[]` entry — an undefined reference is a
 * configuration error that `sovrium validate` must catch OFFLINE (the
 * config-as-code validation promise this capability enables).
 *
 * Extracted into a standalone module (mirroring `validateAllPageAccessGroups`)
 * so the `AppSchema` `Schema.filter` chain stays shallow — inlining a recursive
 * component walker pushes TypeScript's inference depth over the limit and
 * collapses the derived `App` type to `never`. The walker is intentionally
 * loose-typed (`unknown`): it scans the decoded page/component tree for any
 * `dataSource.systemSource` reference regardless of where the data component is
 * nested (top-level `components[]` or inside a container's `children[]`).
 */

/** Minimal shape needed to validate system-source references. */
interface AppForSystemSourceValidation {
  readonly systemSources?: ReadonlyArray<{ readonly name: string }>
  readonly pages?: unknown
}

/**
 * Recursively collect every `{ systemSource: <name> }` reference found under a
 * `dataSource` anywhere in the page/component tree. Loose `unknown` walk so it
 * is agnostic to component nesting (containers, children arrays, etc.).
 */
const collectSystemSourceRefs = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) {
    return node.flatMap(collectSystemSourceRefs)
  }
  if (node === null || typeof node !== 'object') return []

  const record = node as Record<string, unknown>
  const { dataSource } = record
  const ref =
    dataSource !== null && typeof dataSource === 'object'
      ? (dataSource as Record<string, unknown>)['systemSource']
      : undefined
  const ownRef = typeof ref === 'string' ? [ref] : []

  return [...ownRef, ...Object.values(record).flatMap(collectSystemSourceRefs)]
}

/**
 * Validate that every `{ systemSource: <name> }` reference in the page tree
 * points to a declared `app.systemSources[]` entry.
 *
 * Returns `true` when all references resolve, or an error message string naming
 * the first offending reference and the available source names.
 */
export const validateAllSystemSourceReferences = (
  app: AppForSystemSourceValidation
): string | true => {
  if (!app.pages) return true

  const refs = collectSystemSourceRefs(app.pages)
  if (refs.length === 0) return true

  const declared = new Set((app.systemSources ?? []).map((s) => s.name))
  const missing = refs.find((name) => !declared.has(name))
  if (missing === undefined) return true

  const available =
    declared.size > 0
      ? `. Available sources: ${[...declared].toSorted().join(', ')}`
      : '. No sources are declared in app.systemSources[]'
  return `Data source references system source '${missing}' which is not declared in app.systemSources[]${available}`
}
