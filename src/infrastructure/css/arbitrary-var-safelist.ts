/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RECIPE_DIRS = [
  join(import.meta.dir, '../../presentation/islands'),
  join(import.meta.dir, '../../presentation/ui/sections/renderers/element-renderers'),
] as const
const CSS_VAR_PATH = join(import.meta.dir, '../../presentation/utils/design/css-var.ts')

const CLASS_USE_PATTERN =
  /((?:[a-z][\w-]*:)*)([a-z][\w-]*)-\[\$\{v\(\s*'sv-([\w-]+)'\s*,\s*T\.(\w+)\s*\)\}\]/g

const TOKEN_ENTRY_PATTERN = /^\s*(\w+):\s*['"]([^'"]+)['"]/gm

function withVarFallback(varName: string, fallback: string): string {
  return `var(--${varName},${fallback.replace(/ /g, '_')})`
}

function readFileOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function loadTokens(): Readonly<Record<string, string>> {
  const src = readFileOrUndefined(CSS_VAR_PATH)
  if (src === undefined) return {}
  const declStart = src.indexOf('export const TOKENS')
  if (declStart === -1) return {}
  const declEnd = src.indexOf('\n} as const', declStart)
  const body = declEnd === -1 ? src.slice(declStart) : src.slice(declStart, declEnd)
  return Array.from(body.matchAll(TOKEN_ENTRY_PATTERN)).reduce<Readonly<Record<string, string>>>(
    (map, [, key, value]) => {
      if (key === undefined || value === undefined) return map
      if (key === 'export' || key === 'const') return map
      return { ...map, [key]: value }
    },
    {}
  )
}

function readRecipeFiles(): readonly string[] {
  return RECIPE_DIRS.flatMap((dir) => walkRecipeDir(dir))
}

function walkRecipeDir(dir: string): readonly string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return walkRecipeDir(path)
      return entry.name.endsWith('-default-classes.ts') ? [path] : []
    })
  } catch {
    return []
  }
}

function classesForSource(
  src: string,
  tokens: Readonly<Record<string, string>>
): readonly string[] {
  return Array.from(src.matchAll(CLASS_USE_PATTERN)).flatMap(
    ([, variant, property, svSuffix, tokenKey]) => {
      if (property === undefined || svSuffix === undefined || tokenKey === undefined) return []
      const fallback = tokens[tokenKey]
      if (fallback === undefined) return []
      const varExpr = withVarFallback(`sv-${svSuffix}`, fallback)
      return [`${variant ?? ''}${property}-[${varExpr}]`]
    }
  )
}

export function generateArbitraryVarSafelist(): readonly string[] {
  const files = readRecipeFiles()
  if (files.length === 0) return []
  const tokens = loadTokens()
  if (Object.keys(tokens).length === 0) return []
  const classes = files.flatMap((path) => classesForSource(readFileSync(path, 'utf8'), tokens))
  return [...new Set(classes)].toSorted()
}
