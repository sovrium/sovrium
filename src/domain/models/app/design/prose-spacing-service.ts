/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The prose parts spaced with the `my-*` shorthand, which paints nothing there.
 *
 * A prose part — `paragraph`, `heading2`, `list` and the other block elements
 * a markdown text, a markdown page or a rich-text field draws — sits inside
 * typography rules that set its own vertical margins, and those rules win over
 * `my-*`. `mt-*` and `mb-*` take effect. The config is not wrong, only
 * ineffective, so this is a notice and never a refusal: a refusal would stop a
 * config that works.
 *
 * It reads the document as written, before the decode: every `classes.parts`
 * map and every `design.components.<type>.parts` map, wherever it sits.
 */

/** The block-level prose parts whose vertical margins the typography sets. */
const PROSE_BLOCK_PARTS: ReadonlySet<string> = new Set([
  'heading1',
  'heading2',
  'heading3',
  'lead',
  'paragraph',
  'list',
  'listItem',
  'table',
  'quote',
  'image',
  'codeBlock',
  'codeFrame',
])

/**
 * A `my-*` token, with or without variants (`md:my-4`, `-my-1`). An important
 * token (`!my-3`, `my-3!`) outranks the typography and does paint, so it is
 * left alone.
 */
const MY_SHORTHAND = /^(?:[a-z0-9-[\]=&_]+:)*-?my-[^\s!]+$/

type Json = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One notice per prose part of `parts` carrying a `my-*` token. */
const partNotices = (parts: Json, path: string): readonly string[] =>
  Object.entries(parts).flatMap(([part, classes]) => {
    if (!PROSE_BLOCK_PARTS.has(part) || typeof classes !== 'string') return []
    const shorthands = classes.split(/\s+/).filter((token) => MY_SHORTHAND.test(token))
    return shorthands.map(
      (token) =>
        `Prose spacing: \`${token}\` on the \`${part}\` part (${path}.${part}) paints nothing — ` +
        `the typography sets a prose element's vertical margins and wins over \`my-*\`. ` +
        `Write \`${token.replace('my-', 'mt-')} ${token.replace('my-', 'mb-')}\` (mt-* and mb-*) instead.`
    )
  })

/** Walk the raw document, collecting the notices of every `parts` map under `classes` or a design component. */
const walk = (node: unknown, path: string, parentKey: string): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap((item, index) => walk(item, `${path}[${index}]`, ''))
  if (!isRecord(node)) return []
  const own =
    isRecord(node['parts']) && (parentKey === 'classes' || path.startsWith('design.components.'))
      ? partNotices(node['parts'], `${path}.parts`)
      : []
  const nested = Object.entries(node).flatMap(([key, value]) =>
    key === 'parts' ? [] : walk(value, path === '' ? key : `${path}.${key}`, key)
  )
  return [...own, ...nested]
}

/**
 * The non-fatal notices a config earns for spacing a prose part with `my-*`,
 * or an empty list.
 *
 * @param config - The config as written (before the decode)
 */
export const collectProseSpacingNotices = (config: unknown): readonly string[] =>
  walk(config, '', '')
