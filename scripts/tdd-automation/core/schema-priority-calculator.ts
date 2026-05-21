/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


let FEATURE_PRIORITIES: Record<string, number> = {}
let FEATURE_PHASES: Record<string, number> = {}
let SPEC_PREFIX_TO_US_ID: Record<string, string> = {}

try {
  const config = await import('./feature-priorities.generated')
  FEATURE_PRIORITIES = config.FEATURE_PRIORITIES ?? {}
  FEATURE_PHASES = config.FEATURE_PHASES ?? {}
  SPEC_PREFIX_TO_US_ID = config.SPEC_PREFIX_TO_US_ID ?? {}
} catch {
}

type SpecDomain = 'app' | 'migrations' | 'static' | 'api' | 'admin'

const DOMAIN_BASE_PRIORITIES: Record<SpecDomain, number> = {
  app: 0,
  migrations: 1_000_000,
  static: 2_000_000,
  api: 3_000_000,
  admin: 4_000_000,
}

const API_FEATURE_PRIORITIES: Record<string, number> = {
  health: 0,
  tables: 60_000,
  activity: 120_000,
  auth: 180_000,
  security: 240_000,
}

const APP_PAGES_FEATURE_PRIORITIES: Record<string, number> = {
  access: 0,
  auth: 1000,
  data: 2000,
  crud: 3000,
  interactive: 4000,
  datatable: 5000,
}

function getSpecDomain(specId: string): SpecDomain {
  const prefix = specId.split('-')[0]?.toUpperCase()
  if (prefix === 'APP') return 'app'
  if (prefix === 'MIG' || prefix === 'MIGRATION') return 'migrations'
  if (prefix === 'STATIC') return 'static'
  if (prefix === 'API') return 'api'
  if (prefix === 'ADMIN') return 'admin'
  return 'app'
}

export function getFeaturePathFromSpecId(specId: string): string {
  const parts = specId.split('-')
  const lastPart = parts[parts.length - 1] || ''

  const isRegressionOnly = lastPart.toUpperCase() === 'REGRESSION'
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(lastPart)

  let pathParts: string[]
  if (isRegressionWithNumber) {
    pathParts = parts.slice(0, -2)
  } else if (isRegressionOnly) {
    pathParts = parts.slice(0, -1)
  } else if (/^\d+$/.test(lastPart)) {
    pathParts = parts.slice(0, -1)
  } else {
    pathParts = parts
  }

  return pathParts.join('/').toLowerCase()
}

export function getSpecPrefix(specId: string): string {
  const parts = specId.split('-')
  const lastPart = parts[parts.length - 1] || ''

  const isRegressionOnly = lastPart.toUpperCase() === 'REGRESSION'
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined
  const isRegressionWithNumber =
    secondToLastPart !== undefined &&
    secondToLastPart.toUpperCase() === 'REGRESSION' &&
    /^\d+$/.test(lastPart)

  if (isRegressionWithNumber) {
    return parts.slice(0, -2).join('-')
  } else if (isRegressionOnly) {
    return parts.slice(0, -1).join('-')
  } else if (/^\d+$/.test(lastPart)) {
    return parts.slice(0, -1).join('-')
  }
  return specId
}

export function mapSpecIdToUsId(specId: string): string | undefined {
  if (Object.keys(SPEC_PREFIX_TO_US_ID).length === 0) return undefined

  const prefix = getSpecPrefix(specId)

  if (prefix in SPEC_PREFIX_TO_US_ID) {
    return SPEC_PREFIX_TO_US_ID[prefix]
  }

  const parts = prefix.split('-')
  for (let len = parts.length - 1; len >= 2; len--) {
    const shorter = parts.slice(0, len).join('-')
    if (shorter in SPEC_PREFIX_TO_US_ID) {
      return SPEC_PREFIX_TO_US_ID[shorter]
    }
  }

  return undefined
}

function getAlphabeticalIndex(name: string): number {
  const normalized = name.toLowerCase()
  const charCode = normalized.charCodeAt(0)
  if (charCode >= 97 && charCode <= 122) {
    return charCode - 97
  }
  return 0
}

function calculateFeaturePriorityFallback(featurePath: string): number {
  const pathParts = featurePath.split('/')
  let priority = 0

  const isApiDomain = pathParts[0] === 'api'
  const apiFeature = pathParts[1]

  if (isApiDomain && apiFeature && apiFeature in API_FEATURE_PRIORITIES) {
    priority = API_FEATURE_PRIORITIES[apiFeature]!
    const multipliers: number[] = [1000, 100, 1100, 40]
    for (let i = 2; i < pathParts.length && i <= 5; i++) {
      const part = pathParts[i] || ''
      priority += getAlphabeticalIndex(part) * (multipliers[i - 2] ?? 1)
    }
    return priority
  }

  const isAppDomain = pathParts[0] === 'app'
  const appFeature = pathParts[1]
  const pageSubFeature = pathParts[2]

  if (
    isAppDomain &&
    appFeature === 'pages' &&
    pageSubFeature &&
    pageSubFeature in APP_PAGES_FEATURE_PRIORITIES
  ) {
    priority = getAlphabeticalIndex(appFeature) * 30_000
    priority += APP_PAGES_FEATURE_PRIORITIES[pageSubFeature]!
    const multipliers: number[] = [100, 1100, 40]
    for (let i = 3; i < pathParts.length && i <= 5; i++) {
      const part = pathParts[i] || ''
      priority += getAlphabeticalIndex(part) * (multipliers[i - 3] ?? 1)
    }
    return priority
  }

  const multipliers = [30_000, 1000, 100, 1100, 40]
  for (let i = 1; i < pathParts.length && i <= 5; i++) {
    const part = pathParts[i] || ''
    priority += getAlphabeticalIndex(part) * (multipliers[i - 1] || 1)
  }

  return priority
}

function isRegressionSpec(specId: string): boolean {
  const parts = specId.split('-')
  const lastPart = parts[parts.length - 1] || ''
  const secondToLastPart = parts.length >= 2 ? parts[parts.length - 2] : undefined

  return (
    lastPart.toUpperCase() === 'REGRESSION' ||
    (secondToLastPart !== undefined &&
      secondToLastPart.toUpperCase() === 'REGRESSION' &&
      /^\d+$/.test(lastPart))
  )
}

function getFileIndex(filePath: string): number {
  let hash = 0
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return ((hash % 9999) + 9999) % 9999
}

export interface SpecFileContext {
  readonly file: string
  readonly line: number
}

const fileBucketCache = new Map<string, number>()

function getFeatureBucketForFile(filePath: string, specIdHint: string): number {
  const cached = fileBucketCache.get(filePath)
  if (cached !== undefined) return cached

  const usId = mapSpecIdToUsId(specIdHint)
  if (usId && usId in FEATURE_PRIORITIES) {
    const bucket = FEATURE_PRIORITIES[usId]!
    fileBucketCache.set(filePath, bucket)
    return bucket
  }

  const domain = getSpecDomain(specIdHint)
  const domainBase = DOMAIN_BASE_PRIORITIES[domain]
  const featurePath = getFeaturePathFromSpecId(specIdHint)
  const featurePriority = calculateFeaturePriorityFallback(featurePath)
  const bucket = domainBase + featurePriority
  fileBucketCache.set(filePath, bucket)
  return bucket
}

export function calculateSpecPriority(specId: string, context: SpecFileContext): number {
  const fileHash = getFileIndex(context.file)
  const regression = isRegressionSpec(specId)
  const withinFileOffset = regression ? 5000 + context.line : context.line

  const featureBucket = getFeatureBucketForFile(context.file, specId)

  return featureBucket * 100_000_000 + fileHash * 10_000 + withinFileOffset
}

export function createSchemaPriorityCalculator(): (
  specId: string,
  context: SpecFileContext
) => number {
  return calculateSpecPriority
}

export function getSpecPhase(specId: string): number {
  const usId = mapSpecIdToUsId(specId)
  if (usId && usId in FEATURE_PHASES) {
    return FEATURE_PHASES[usId]!
  }
  return 0
}

export async function reloadGeneratedConfig(): Promise<void> {
  const { readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const configPath = join(import.meta.dir, 'feature-priorities.generated.ts')
  try {
    const source = await readFile(configPath, 'utf-8')

    const extractObject = (name: string): Record<string, string | number> => {
      const pattern = new RegExp(
        `export const ${name}:\\s*Record<string,\\s*(?:string|number)>\\s*=\\s*\\{([^}]*)\\}`,
        's'
      )
      const match = source.match(pattern)
      if (!match?.[1]) return {}
      const entries: Record<string, string | number> = {}
      for (const line of match[1].split('\n')) {
        const kv = line.match(/^\s*'([^']+)':\s*(?:'([^']*)'|(\d+)),?\s*$/)
        if (kv) {
          entries[kv[1]!] = kv[2] !== undefined ? kv[2] : Number(kv[3])
        }
      }
      return entries
    }

    FEATURE_PRIORITIES = extractObject('FEATURE_PRIORITIES') as Record<string, number>
    FEATURE_PHASES = extractObject('FEATURE_PHASES') as Record<string, number>
    SPEC_PREFIX_TO_US_ID = extractObject('SPEC_PREFIX_TO_US_ID') as Record<string, string>

    fileBucketCache.clear()
  } catch {
  }
}
