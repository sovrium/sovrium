/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Console, Effect } from 'effect'
import {
  COMING_SOON_DISCRIMINATORS,
  COMING_SOON_LEAF_SCHEMA_TAGS,
  COMING_SOON_SCHEMA_NAMES,
  COMING_SOON_TAGS,
} from './registry.generated'

export interface ComingSoonUsage {
  readonly path: string
  readonly schemaName: string
  readonly tag?: string
}

const findParentForTag = (tag: string): string | undefined => {
  return [...COMING_SOON_DISCRIMINATORS.entries()].reduce<string | undefined>(
    (acc, [parentName, tags]) => acc ?? (tags.has(tag) ? parentName : undefined),
    undefined
  )
}

const detectVariantHit = (
  obj: Readonly<Record<string, unknown>>,
  path: string
): readonly ComingSoonUsage[] => {
  const discriminatorValue = obj.type ?? obj.kind
  if (typeof discriminatorValue !== 'string') return []
  if (!COMING_SOON_TAGS.has(discriminatorValue)) return []
  const parent = findParentForTag(discriminatorValue)
  if (parent === undefined) return []
  const propName = typeof obj.type === 'string' ? 'type' : 'kind'
  return [{ path: `${path}.${propName}`, schemaName: parent, tag: discriminatorValue }]
}

const detectLeafHit = (
  obj: Readonly<Record<string, unknown>>,
  path: string
): readonly ComingSoonUsage[] => {
  const typeValue = obj.type
  if (typeof typeValue !== 'string') return []
  const leafSchema = COMING_SOON_LEAF_SCHEMA_TAGS.get(typeValue)
  if (leafSchema === undefined) return []
  if (!COMING_SOON_SCHEMA_NAMES.has(leafSchema)) return []
  return [{ path: `${path}.type`, schemaName: leafSchema }]
}

const usageAtNode = (node: unknown, path: string): readonly ComingSoonUsage[] => {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return []
  const obj = node as Readonly<Record<string, unknown>>
  const variantHit = detectVariantHit(obj, path)
  if (variantHit.length > 0) return variantHit
  return detectLeafHit(obj, path)
}

const collectUsages = (node: unknown, path: string): readonly ComingSoonUsage[] => {
  const here = usageAtNode(node, path)

  if (Array.isArray(node)) {
    const fromItems = node.flatMap((item, index) => collectUsages(item, `${path}[${index}]`))
    return [...here, ...fromItems]
  }

  if (node !== null && typeof node === 'object') {
    const obj = node as Readonly<Record<string, unknown>>
    const fromProps = Object.keys(obj).flatMap((key) => collectUsages(obj[key], `${path}.${key}`))
    return [...here, ...fromProps]
  }

  return here
}

export const detectComingSoonUsages = (config: unknown): readonly ComingSoonUsage[] =>
  collectUsages(config, 'config')

export const formatComingSoonWarning = (usage: ComingSoonUsage): string => {
  if (usage.tag !== undefined) {
    return `[sovrium] ${usage.path} uses '${usage.tag}' (${usage.schemaName}) — COMING SOON. It will be ignored at runtime.`
  }
  return `[sovrium] ${usage.path} uses ${usage.schemaName} — COMING SOON. It will be ignored at runtime.`
}

export const warnForConfig = (config: unknown): Effect.Effect<void> =>
  Effect.gen(function* () {
    const usages = detectComingSoonUsages(config)
    yield* Effect.forEach(usages, (usage) => Console.log(formatComingSoonWarning(usage)), {
      discard: true,
    })
  })

export {
  COMING_SOON_DISCRIMINATORS,
  COMING_SOON_LEAF_SCHEMA_TAGS,
  COMING_SOON_SCHEMA_NAMES,
  COMING_SOON_TAGS,
}
