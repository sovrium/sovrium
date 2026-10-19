/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CSS custom properties and a Tailwind v4 `@theme` block → canonical tokens.
 *
 * A shadcn stylesheet declares its colours as variables under `:root` (light)
 * and `.dark` (dark), and a Tailwind v4 `@theme` block names the rest by
 * namespace: `--color-*`, `--radius-*`, `--spacing-*`, `--breakpoint-*`,
 * `--font-*`. A `var()` resolves to a variable the same file declares; one
 * that names nothing the file declares is reported as an alias that does not
 * resolve, never written as a reference to a variable the app does not have.
 */

import {
  adapterError,
  adapterOk,
  parseColor,
  splitFontStack,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
  type ImportUnmapped,
} from './canonical-tokens-service'

type Variables = ReadonlyMap<string, string>

interface Blocks {
  readonly root: Variables
  readonly dark: Variables | undefined
  readonly theme: Variables
}

/** A selector or at-rule that opens a block this adapter reads. */
const BLOCK = /(:root|\.dark|@theme(?:\s+inline)?)\s*\{([^{}]*)\}/g
const DECLARATION = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);?/g

/** Whether a stylesheet holds a block the import reads. */
export const isTokenStylesheet = (text: string): boolean =>
  /(?::root|\.dark|@theme)[^{]*\{/.test(stripComments(text))

const stripComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '')

const declarationsOf = (body: string): Variables =>
  new Map([...body.matchAll(DECLARATION)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()]))

const readBlocks = (text: string): Blocks => {
  const blocks = [...stripComments(text).matchAll(BLOCK)].map((match) => ({
    selector: match[1] ?? '',
    variables: declarationsOf(match[2] ?? ''),
  }))
  const merge = (predicate: (selector: string) => boolean): Variables =>
    new Map(
      blocks.filter((block) => predicate(block.selector)).flatMap((block) => [...block.variables])
    )
  const hasDark = blocks.some((block) => block.selector === '.dark')
  return {
    root: merge((selector) => selector === ':root'),
    dark: hasDark ? merge((selector) => selector === '.dark') : undefined,
    theme: merge((selector) => selector.startsWith('@theme')),
  }
}

const VAR = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^)]+))?\)$/

/** A value with its `var()` chain followed through `scopes`, or `undefined` when it breaks. */
const resolveVar = (value: string, scopes: readonly Variables[], depth = 0): string | undefined => {
  const match = VAR.exec(value.trim())
  if (match === null) return value
  if (depth > 16) return undefined
  const target = scopes
    .map((scope) => scope.get(match[1] ?? ''))
    .find((found) => found !== undefined)
  const next = target ?? match[2]
  return next === undefined ? undefined : resolveVar(next, scopes, depth + 1)
}

/** `@theme` namespaces → the canonical group and type each becomes. */
const NAMESPACES: readonly (readonly [string, string, string])[] = [
  ['--color-', 'color', 'color'],
  ['--radius-', 'radius', 'dimension'],
  ['--spacing-', 'spacing', 'dimension'],
  ['--breakpoint-', 'breakpoint', 'dimension'],
  ['--font-', 'font', 'fontFamily'],
]

const tokenFor = (group: string, name: string, type: string, value: string): CanonicalToken => ({
  path: [group, name],
  type,
  value: type === 'fontFamily' ? splitFontStack(value) : value,
})

interface Read {
  readonly tokens: readonly CanonicalToken[]
  readonly unmapped: readonly ImportUnmapped[]
}

type Entry = { readonly token: CanonicalToken } | { readonly unmapped: ImportUnmapped }

const left = (token: string, kind: ImportUnmapped['kind'], reason: string): Entry => ({
  unmapped: { token, kind, reason },
})

const toRead = (entries: readonly Entry[]): Read => ({
  tokens: entries.flatMap((entry) => ('token' in entry ? [entry.token] : [])),
  unmapped: entries.flatMap((entry) => ('unmapped' in entry ? [entry.unmapped] : [])),
})

const themeEntry = (blocks: Blocks, variable: string, raw: string): Entry => {
  const namespace = NAMESPACES.find(([prefix]) => variable.startsWith(prefix))
  if (namespace === undefined) {
    return left(variable, 'group', 'Its `@theme` namespace names no `design` key.')
  }
  const value = resolveVar(raw, [blocks.theme, blocks.root])
  if (value === undefined) {
    return left(variable, 'alias', 'Its `var()` names a variable the file does not declare.')
  }
  const [prefix, group, type] = namespace
  return { token: tokenFor(group, variable.slice(prefix.length), type, value) }
}

const themeTokens = (blocks: Blocks): Read =>
  toRead([...blocks.theme].map(([variable, raw]) => themeEntry(blocks, variable, raw)))

/** The colour variables of `:root` or `.dark`, each a colour token under its own name. */
const scopeColors = (scope: Variables, fallbacks: readonly Variables[]): Read =>
  toRead(
    [...scope].map(([variable, raw]): Entry => {
      const value = resolveVar(raw, [scope, ...fallbacks])
      const color = value === undefined ? undefined : parseColor(value)
      return color === undefined
        ? left(
            variable,
            'token-type',
            'Only colour variables map from `:root` and `.dark`; a length belongs in `@theme`.'
          )
        : { token: tokenFor('color', variable.slice(2), 'color', color) }
    })
  )

/** A theme token that only restates a `:root` colour of the same name adds nothing. */
const withoutRestated = (theme: readonly CanonicalToken[], root: readonly CanonicalToken[]) => {
  const declared = new Set(root.map((token) => token.path.join('.')))
  return theme.filter((token) => !declared.has(token.path.join('.')))
}

/** A stylesheet → canonical tokens. */
export const fromCss = (source: ImportSource): AdapterResult => {
  const text = source.files
    .filter((file) => file.path.endsWith('.css') || file.path === source.entry)
    .map((file) => file.text)
    .join('\n')
  if (!isTokenStylesheet(text)) {
    return adapterError('It holds no `:root`, `.dark` or `@theme` block.')
  }
  const blocks = readBlocks(text)
  const root = scopeColors(blocks.root, [blocks.theme])
  const theme = themeTokens(blocks)
  const dark =
    blocks.dark === undefined ? undefined : scopeColors(blocks.dark, [blocks.root, blocks.theme])
  return adapterOk({
    light: [...root.tokens, ...withoutRestated(theme.tokens, root.tokens)],
    dark: dark?.tokens,
    unmapped: [...root.unmapped, ...theme.unmapped, ...(dark?.unmapped ?? [])],
  })
}
