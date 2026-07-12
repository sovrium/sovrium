/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface AppForSystemSourceValidation {
  readonly systemSources?: ReadonlyArray<{ readonly name: string }>
  readonly pages?: unknown
}

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
