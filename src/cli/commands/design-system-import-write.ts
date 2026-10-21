/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --write` — writing the resulting `design`.
 *
 * Two roads, and on neither does the import touch anything but `design`:
 *
 *  - **YAML and JSON configs** are patched in place. A YAML file is rewritten
 *    on the lines of its top-level `design:` block only, so a comment, the
 *    quoting or the order of everything else survives; a JSON file keeps every
 *    other key where it was.
 *  - **A TypeScript config is never edited**: a program is its author's. The
 *    whole resulting `design` goes to a sidecar `design.json` beside it, and
 *    the command prints the import line and the property to paste. The runtime
 *    reads a JSON import natively; a `$ref` include would be refused there.
 *
 * Either way the result is judged as `sovrium validate` judges it BEFORE a
 * byte is written, and a write that would change nothing writes nothing. The
 * bytes land through a temp file and a rename beside the target, so a crash
 * mid-write never leaves a half-written config or sidecar.
 *
 * A `design` assembled from another file — a `$ref` on it or anywhere inside
 * it, or a root include that supplies it — is refused rather than patched: a
 * rewrite would silently inline the include and orphan the file it names.
 */

import { rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { refuse } from './app-prelude'
import { indented, judgeConfig, type RootFormat } from './library-add-config'
import { renderYamlFragment } from './library-wire'
import { validateParsedConfig } from './validate'

type JsonObject = Readonly<Record<string, unknown>>

/** The name of the sidecar a TypeScript config's design is written to. */
export const SIDECAR_NAME = 'design.json'

/** What a write did, as the report records it. */
export interface WrittenDesign {
  readonly config?: string
  readonly sidecar?: string
  readonly importLine?: string
  readonly propertyLine?: string
}

const TOP_LEVEL_KEY = /^[^\s#]/
const DESIGN_HEADER = /^design\s*:/

/**
 * Write via a temp file and a rename. The rename is atomic, so the config
 * watcher or the operator's editor never sees a half-written file; the temp
 * file sits beside the target because a rename across filesystems is a copy.
 */
export const writeAtomically = async (path: string, content: string): Promise<void> => {
  const temp = `${path}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`
  await writeFile(temp, content, 'utf-8')
  await rename(temp, path)
}

/** The line ending a text uses, so a patch keeps a CRLF file CRLF. */
const lineEndingOf = (text: string): '\r\n' | '\n' => (text.includes('\r\n') ? '\r\n' : '\n')

/** The line range of a YAML root's top-level `design` block, or `undefined`. */
const designBlock = (lines: readonly string[]): { start: number; end: number } | undefined => {
  const start = lines.findIndex((line) => DESIGN_HEADER.test(line))
  if (start === -1) return undefined
  const next = lines.findIndex((line, index) => index > start && TOP_LEVEL_KEY.test(line))
  const limit = next === -1 ? lines.length : next
  // Trailing blank and comment lines belong to what follows the block, not to it.
  const lastOwned = lines
    .slice(start + 1, limit)
    .findLastIndex((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  return { start, end: lastOwned === -1 ? start + 1 : start + 2 + lastOwned }
}

/** A YAML root with its `design` block replaced (or appended), every other line kept. */
export const patchYamlDesign = (text: string, design: JsonObject): string => {
  const eol = lineEndingOf(text)
  const block = renderYamlFragment([], { design }).trimEnd().split('\n')
  const lines = text.split(eol)
  const range = designBlock(lines)
  if (range === undefined) {
    const body = text.endsWith(eol) || text === '' ? text : `${text}${eol}`
    return `${body}${block.join(eol)}${eol}`
  }
  return [...lines.slice(0, range.start), ...block, ...lines.slice(range.end)].join(eol)
}

/**
 * How many comment lines sit inside a YAML root's top-level `design` block:
 * the ones a patch drops, since it re-renders the block.
 */
export const designCommentLines = (text: string): number => {
  const lines = text.split(lineEndingOf(text))
  const range = designBlock(lines)
  if (range === undefined) return 0
  return lines
    .slice(range.start, range.end)
    .filter((line, index) => line.trimStart().startsWith('#') || (index === 0 && /\s#/.test(line)))
    .length
}

/** A JSON root with `design` replaced in place, laid out as it was. */
export const patchJsonDesign = (text: string, design: JsonObject): string => {
  const root = JSON.parse(text) as JsonObject
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  // Spread then override: an existing `design` keeps its place among the keys.
  const patched = { ...root, design }
  const eol = lineEndingOf(text)
  const trailing = text.endsWith('\n') ? eol : ''
  const body = JSON.stringify(patched, undefined, indent)
  return `${eol === '\n' ? body : body.replaceAll('\n', eol)}${trailing}`
}

/** The first `$ref` at any depth of a value, or `undefined`. */
const firstRef = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.map(firstRef).find((ref) => ref !== undefined)
  if (typeof value !== 'object' || value === null) return undefined
  const own = Object.hasOwn(value, '$ref') ? (value as JsonObject)['$ref'] : undefined
  if (typeof own === 'string') return own
  return Object.values(value)
    .map(firstRef)
    .find((ref) => ref !== undefined)
}

/**
 * Why the raw root's `design` cannot be patched in place, or `undefined` when
 * it can: a `$ref` on it or anywhere inside it names the file it comes from;
 * a raw root with no `design` while the loaded config has one means a root
 * include supplies it. Either way a rewrite would inline the include.
 *
 * @param declared - the `design` of the config as loaded, its includes resolved.
 */
export const designIncludeOf = (
  text: string,
  format: RootFormat,
  declared: unknown
): string | undefined => {
  const root = (() => {
    try {
      return format === 'json' ? (JSON.parse(text) as unknown) : Bun.YAML.parse(text)
    } catch {
      // An unparseable root was already refused by the validation that loaded it.
      return undefined
    }
  })()
  const raw =
    typeof root === 'object' && root !== null && Object.hasOwn(root, 'design')
      ? (root as JsonObject)['design']
      : undefined
  if (raw === undefined) return declared === undefined ? undefined : 'an include of the root'
  return firstRef(raw)
}

const refuseInvalid = (errors: readonly string[]): never =>
  refuse(
    `Error: The imported design does not validate, so nothing was written.\n\n${indented(errors)}`
  )

/** Patch a YAML or JSON config, after judging the patched bytes as the app would. */
export const writeConfigDesign = async (
  configPath: string,
  format: 'yaml' | 'json',
  design: JsonObject
): Promise<WrittenDesign> => {
  const text = await Bun.file(configPath).text()
  const next = format === 'yaml' ? patchYamlDesign(text, design) : patchJsonDesign(text, design)
  const judged = await judgeConfig(configPath, new Map([[configPath, next]]))
  if (judged.errors.length > 0) return refuseInvalid(judged.errors)
  // The patched file must read back as exactly this design: a `design` key the
  // line patch could not find (quoted, or in flow style) would otherwise leave
  // two, and whichever the parser keeps is not a choice the import makes.
  const landed = (judged.parsed as JsonObject | undefined)?.['design']
  if (JSON.stringify(landed) !== JSON.stringify(design)) {
    return refuse(
      `Error: The design key of "${configPath}" could not be patched in place, so nothing was written.\n\n` +
        '  Write `design:` as a plain top-level key, or copy the dry-run changes into the file.'
    )
  }
  if (next !== text) await writeAtomically(configPath, next)
  return { config: configPath }
}

const sameJson = (text: string, value: unknown): boolean => {
  try {
    return JSON.stringify(JSON.parse(text)) === JSON.stringify(value)
  } catch {
    // Not JSON at all: certainly not this config's design.
    return false
  }
}

/**
 * Write a TypeScript config's sidecar, after judging the config with it in place.
 *
 * An existing `design.json` is replaced only when it already holds this
 * config's design — the one it imports, or the one a previous import wrote and
 * the operator has not pasted yet. Any other file of that name is someone's,
 * and is refused rather than overwritten.
 */
export const writeDesignSidecar = async (
  configPath: string,
  parsed: unknown,
  refSources: ReadonlyMap<string, string>,
  design: JsonObject
): Promise<WrittenDesign> => {
  const candidate = { ...(parsed as JsonObject), design }
  const outcome = await validateParsedConfig(candidate, refSources)
  if (outcome.errors.length > 0) return refuseInvalid(outcome.errors)
  const sidecar = join(dirname(configPath), SIDECAR_NAME)
  const next = `${JSON.stringify(design, undefined, 2)}\n`
  const previous = (await Bun.file(sidecar).exists()) ? await Bun.file(sidecar).text() : undefined
  const declared = (parsed as JsonObject | undefined)?.['design'] ?? {}
  if (previous !== undefined && !sameJson(previous, declared) && !sameJson(previous, design)) {
    return refuse(
      `Error: "${sidecar}" already exists and does not hold this config's design, so it was not overwritten.\n\n` +
        `  Move or rename it, then run the import again.`
    )
  }
  if (previous !== next) await writeAtomically(sidecar, next)
  return {
    sidecar,
    importLine: `import design from './${SIDECAR_NAME}'`,
    propertyLine: 'design,',
  }
}
