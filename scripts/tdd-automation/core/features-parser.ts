/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface FeatureEntry {
  readonly usId: string
  readonly feature: string
  readonly description: string
  readonly phase: number
  readonly priority: number | undefined
  readonly status: string
  readonly progress: string | undefined
  readonly line: number
  readonly domain: string
}

export interface DependencyDeclaration {
  readonly domain: string
  readonly dependsOn: readonly string[]
  readonly line: number
}

export interface ParsedFeatures {
  readonly entries: readonly FeatureEntry[]
  readonly dependencies: readonly DependencyDeclaration[]
}

const TABLE_ROW_PATTERN =
  /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d)\s*\|\s*(?:(\d+|-)\s*\|\s*)?(Covered|Specified|Planned)\s*\(?(US-[A-Z0-9-]+)?\)?\s*\|\s*([^|]*?)\s*\|?\s*$/

const DEPENDENCY_COMMENT_PATTERN =
  /^<!--\s*priority:depends_on\s+(US-[A-Z0-9-]+(?:\s*,\s*US-[A-Z0-9-]+)*)\s*-->$/

const DOMAIN_HEADING_PATTERN = /^####\s+\d+\.\s+(.+)$/

export function parseFeaturesMd(content: string): ParsedFeatures {
  const lines = content.split('\n')
  const entries: FeatureEntry[] = []
  const dependencies: DependencyDeclaration[] = []
  let currentDomain = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    const domainMatch = line.match(DOMAIN_HEADING_PATTERN)
    if (domainMatch) {
      currentDomain = domainMatch[1]?.trim() ?? ''
      continue
    }

    const depMatch = line.match(DEPENDENCY_COMMENT_PATTERN)
    if (depMatch) {
      const rawIds = depMatch[1] ?? ''
      const dependsOn = rawIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.startsWith('US-'))
      if (dependsOn.length > 0) {
        dependencies.push({
          domain: currentDomain,
          dependsOn,
          line: i + 1,
        })
      }
      continue
    }

    const rowMatch = line.match(TABLE_ROW_PATTERN)
    if (!rowMatch) continue

    const feature = rowMatch[1]?.trim() ?? ''
    const description = rowMatch[2]?.trim() ?? ''
    const phaseStr = rowMatch[3] ?? '0'
    const priorityStr = rowMatch[4]?.trim()
    const status = rowMatch[5]?.trim() ?? ''
    const usId = rowMatch[6]?.trim() ?? ''
    const progressStr = rowMatch[7]?.trim()

    if (!usId) continue

    if (feature.startsWith('---') || feature.startsWith('--')) continue

    entries.push({
      usId,
      feature,
      description,
      phase: parseInt(phaseStr, 10),
      priority: priorityStr && priorityStr !== '-' ? parseInt(priorityStr, 10) : undefined,
      status,
      progress: progressStr || undefined,
      line: i + 1,
      domain: currentDomain,
    })
  }

  return { entries, dependencies }
}

export function updateFeaturesMd(
  content: string,
  updates: ReadonlyMap<string, { readonly priority?: number; readonly progress?: string }>
): string {
  if (updates.size === 0) return content

  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    const rowMatch = line.match(TABLE_ROW_PATTERN)
    if (!rowMatch) {
      result.push(line)
      continue
    }

    const usId = rowMatch[6]?.trim() ?? ''
    if (!usId || !updates.has(usId)) {
      result.push(line)
      continue
    }

    const update = updates.get(usId)!
    const feature = rowMatch[1]?.trim() ?? ''
    const description = rowMatch[2]?.trim() ?? ''
    const phaseStr = rowMatch[3] ?? '0'
    const status = rowMatch[5]?.trim() ?? ''
    const statusWithId = usId ? `${status} (${usId})` : status

    const priorityVal =
      update.priority !== undefined
        ? String(update.priority)
        : rowMatch[4]?.trim() && rowMatch[4].trim() !== '-'
          ? rowMatch[4].trim()
          : '-'
    const progressVal = update.progress ?? rowMatch[7]?.trim() ?? ''

    const newLine = `| ${padEnd(feature, 30)} | ${padEnd(description, 70)} | ${phaseStr}     | ${padEnd(priorityVal, 8)} | ${padEnd(statusWithId, 50)} | ${padEnd(progressVal, 8)} |`
    result.push(newLine)
    continue
  }

  return result.join('\n')
}

export function upgradeTableHeaders(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    const isHeader = /^\|\s*Feature\s*\|\s*Description\s*\|\s*Phase\s*\|\s*Status\s*\|/.test(line)
    const alreadyUpgraded = /Priority/.test(line)

    if (isHeader && !alreadyUpgraded) {
      result.push(
        '| Feature                                  | Description                                                                   | Phase | Priority | Status                                              | Progress |'
      )

      const nextLine = lines[i + 1] ?? ''
      if (/^\|[\s-|]+\|$/.test(nextLine)) {
        result.push(
          '| ---------------------------------------- | ----------------------------------------------------------------------------- | ----- | -------- | --------------------------------------------------- | -------- |'
        )
        i++
      }
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

export function getAllUsIds(parsed: ParsedFeatures): readonly string[] {
  return parsed.entries.map((e) => e.usId)
}

export function getEntriesByDomain(
  parsed: ParsedFeatures
): ReadonlyMap<string, readonly FeatureEntry[]> {
  const map = new Map<string, FeatureEntry[]>()
  for (const entry of parsed.entries) {
    const existing = map.get(entry.domain)
    if (existing) {
      existing.push(entry)
    } else {
      map.set(entry.domain, [entry])
    }
  }
  return map
}

function padEnd(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length)
}
