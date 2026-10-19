/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Figma → canonical tokens.
 *
 * Figma exports a Variables collection as DTCG, one file per mode, in px and
 * seconds, with `com.figma.*` extensions on its variables. One file is the
 * light mode; in a folder, the file whose name says `dark` is the dark mode,
 * the first other file is light, and any further file is reported.
 */

import {
  adapterError,
  adapterOk,
  baseName,
  flattenTree,
  isObject,
  namesDark,
  parseJson,
  resolveAliases,
  treeHasKey,
  unresolvedAlias,
  type AdapterResult,
  type CanonicalToken,
  type ImportSource,
  type SourceFile,
} from './canonical-tokens-service'

/** Whether a parsed document carries Figma's variable extensions. */
export const hasFigmaExtensions = (document: unknown): boolean =>
  treeHasKey(document, (key) => key.startsWith('com.figma.'))

interface ModeFile {
  readonly file: SourceFile
  readonly tokens: readonly CanonicalToken[]
}

const readModeFile = (file: SourceFile): ModeFile | undefined => {
  const document = parseJson(file.text)
  return isObject(document) ? { file, tokens: flattenTree(document, 'dtcg') } : undefined
}

/** Figma files → canonical tokens. */
export const fromFigma = (source: ImportSource): AdapterResult => {
  const parsed = source.files
    .filter((file) => file.path.endsWith('.json'))
    .map(readModeFile)
    .filter((mode): mode is ModeFile => mode !== undefined && mode.tokens.length > 0)
  if (parsed.length === 0) return adapterError('It holds no Figma variables file.')
  const dark = parsed.find((mode) => namesDark(baseName(mode.file.path)))
  const [light, ...others] = parsed.filter((mode) => mode !== dark)
  const lightMode = light ?? dark
  if (lightMode === undefined) return adapterError('It holds no Figma variables file.')
  const lightTokens = resolveAliases(lightMode.tokens)
  const darkTokens =
    dark === undefined || dark === lightMode ? undefined : resolveAliases(dark.tokens)
  return adapterOk({
    light: lightTokens.tokens,
    dark: darkTokens?.tokens,
    unmapped: [
      ...others.map((mode) => ({
        token: baseName(mode.file.path),
        kind: 'mode' as const,
        reason: 'Only one light and one dark mode file map to `design`.',
      })),
      ...[...lightTokens.unresolved, ...(darkTokens?.unresolved ?? [])].map(unresolvedAlias),
    ],
  })
}
