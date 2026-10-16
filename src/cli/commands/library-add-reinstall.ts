/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add` on a fragment that is already on disk: same file,
 * a file to rewrite with new parameters, or an edit never to overwrite.
 *
 * Every fragment opens with its provenance line and, when the entry declares
 * parameters, a second one recording the values it was written with:
 *
 *     # sovrium-library: block/auth-password-reset-new@0.38.0
 *     # sovrium-library-params: iconName=key&successPath=%2Fconnexion
 *
 * The bytes on disk are compared with renders by the running binary. Equal to
 * the render with the parameters asked for now: nothing to do. Equal to the
 * render with the parameters the file records: nobody edited it, so it is
 * rewritten. Neither: it was edited, and it is kept. A fragment written before
 * the parameter line existed counts as unedited only when it equals a render
 * with the default parameters and no parameter line.
 *
 * Pure functions: the caller renders and reads, so every verdict is testable
 * without a filesystem.
 */

import { createHash } from 'node:crypto'
import { provenanceHeader, renderTsFragment, renderYamlFragment } from './library-wire'
import type { RootFormat } from './library-add-config'
import type { LibraryEntry, LibraryParamValue } from '@/library/manifest/define'

/** The parameters one install is written with. */
export type InstallParams = Readonly<Record<string, LibraryParamValue | undefined>>

const PARAMS_LINE = /^(?:#|\/\/) sovrium-library-params: (.*)$/m

/**
 * The second provenance line — every parameter with a value, sorted by name,
 * URL-encoded as a query string — or `undefined` when none has one.
 */
export const paramsHeader = (params: InstallParams): string | undefined => {
  const pairs = Object.keys(params)
    .toSorted()
    .flatMap((name) => {
      const value = params[name]
      return value === undefined
        ? []
        : [`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`]
    })
  return pairs.length === 0 ? undefined : `sovrium-library-params: ${pairs.join('&')}`
}

/**
 * One fragment as `library add` writes it, in the config's format: the
 * provenance line, the parameter line when `recordParams`, then the item. The
 * one renderer behind a component, a connection, a recipe and a block's forms,
 * so the bytes compared on a re-add are the bytes every install writes.
 */
export const renderFragment = (input: {
  readonly format: RootFormat
  readonly id: string
  readonly version: string
  readonly params: InstallParams
  readonly recordParams: boolean
  readonly binding: string
  readonly value: unknown
}): string => {
  const recorded = input.recordParams ? paramsHeader(input.params) : undefined
  const header = [
    provenanceHeader(input.id, input.version),
    ...(recorded === undefined ? [] : [recorded]),
  ]
  return input.format === 'typescript'
    ? renderTsFragment(header, input.binding, input.value)
    : renderYamlFragment(header, input.value)
}

/** The raw values a fragment's parameter line records, or `undefined` when it has none. */
export const recordedParamsOf = (onDisk: string): ReadonlyMap<string, string> | undefined => {
  const line = onDisk.split('\n', 3).find((candidate) => PARAMS_LINE.test(candidate))
  const query = line?.match(PARAMS_LINE)?.[1]
  if (query === undefined) return undefined
  try {
    return new Map(
      query
        .split('&')
        .filter((pair) => pair !== '')
        .map((pair) => {
          const cut = pair.indexOf('=')
          return cut < 0
            ? ([decodeURIComponent(pair), ''] as const)
            : ([
                decodeURIComponent(pair.slice(0, cut)),
                decodeURIComponent(pair.slice(cut + 1)),
              ] as const)
        })
    )
  } catch {
    // A line someone mangled decodes to nothing: the file reads as edited.
    return new Map([['', '']])
  }
}

/**
 * The recorded values typed as the entry declares them, every declared
 * parameter the line omits left unset; `undefined` when the line names a
 * parameter the entry does not declare or a number that is not one.
 */
const typedParams = (
  entry: LibraryEntry,
  recorded: ReadonlyMap<string, string>
): InstallParams | undefined => {
  const declared = new Map(entry.params.map((param) => [param.name, param] as const))
  if ([...recorded.keys()].some((name) => !declared.has(name))) return undefined
  const typed = entry.params.map((param) => {
    const raw = recorded.get(param.name)
    if (raw === undefined || param.type === 'string') return [param.name, raw] as const
    const value = Number(raw)
    return [param.name, Number.isFinite(value) && raw.trim() !== '' ? value : Number.NaN] as const
  })
  return typed.some(([, value]) => typeof value === 'number' && Number.isNaN(value))
    ? undefined
    : Object.fromEntries(typed)
}

/** How an entry renders: with given parameters, and with or without the parameter line. */
export type RenderWith = (params: InstallParams, recordParams: boolean) => string

/** What re-adding a fragment does. */
export type Reinstall =
  | { readonly kind: 'new' }
  | { readonly kind: 'same' }
  | { readonly kind: 'update'; readonly changes: readonly string[] }
  | { readonly kind: 'edited'; readonly against: EditedAgainst }

/** Which render the bytes on disk were compared with: recorded, default or parameterless. */
export type EditedAgainst = 'recorded' | 'default' | 'none'

/** `successPath /sign-in → /` for every parameter whose value differs. */
export const changedParams = (before: InstallParams, after: InstallParams): readonly string[] =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].toSorted().flatMap((name) => {
    const was = before[name]
    const now = after[name]
    return was === now
      ? []
      : [
          `${name} ${was === undefined ? '(unset)' : String(was)} → ${now === undefined ? '(unset)' : String(now)}`,
        ]
  })

const PROVENANCE_LINE = /^((?:#|\/\/) sovrium-library: [^@]+@)(.*)$/

/** The version a fragment's provenance line names, or `undefined` when it has none. */
export const installedVersionOf = (onDisk: string): string | undefined =>
  PROVENANCE_LINE.exec(onDisk.split('\n', 1)[0] ?? '')?.[2]

/**
 * `rendered` with its provenance line carrying the version `onDisk` records.
 *
 * The provenance line names the engine that WROTE the file, so a fragment an
 * earlier version installed never equals a render by this one, block unchanged
 * or not. Every comparison below is about the block and its parameters, so it
 * is made against the version on disk; a block that changed since still differs.
 */
const withRecordedVersion = (rendered: string, onDisk: string): string => {
  const recorded = installedVersionOf(onDisk)
  const [first = '', ...rest] = rendered.split('\n')
  const head = PROVENANCE_LINE.exec(first)?.[1]
  return recorded === undefined || head === undefined
    ? rendered
    : [`${head}${recorded}`, ...rest].join('\n')
}

/** A YAML fragment's comment lines: its provenance header and any the author added. */
const commentsOf = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))
    .join('\n')

/**
 * Whether two fragments are the same install: the same bytes, or — for YAML —
 * the same comment lines and the same value, so a file a formatter re-quoted or
 * re-wrapped (Prettier over a template's `library/`) is not taken for an edit.
 * A TypeScript fragment is compared byte for byte; a YAML one that does not parse differs.
 */
const sameFragment = (onDisk: string, rendered: string): boolean => {
  if (onDisk === rendered) return true
  if (!onDisk.startsWith('#') || commentsOf(onDisk) !== commentsOf(rendered)) return false
  try {
    return Bun.deepEquals(Bun.YAML.parse(onDisk), Bun.YAML.parse(rendered), true)
  } catch {
    return false
  }
}

/** What re-adding a fragment is judged from. */
interface ReinstallInput {
  readonly entry: LibraryEntry
  readonly onDisk: string | undefined
  readonly content: string
  readonly params: InstallParams
  readonly defaults: InstallParams | undefined
  readonly render: RenderWith
}

/**
 * The parameters the bytes on disk were presumably written with — the ones
 * its parameter line records, else the defaults — and the comparison that
 * names them in a refusal.
 */
const priorOf = (
  input: ReinstallInput,
  onDisk: string
): {
  readonly prior: InstallParams | undefined
  readonly recordParams: boolean
  readonly against: EditedAgainst
} => {
  const recorded = recordedParamsOf(onDisk)
  return recorded === undefined
    ? {
        prior: input.defaults,
        recordParams: false,
        against: input.entry.params.length === 0 ? 'none' : 'default',
      }
    : { prior: typedParams(input.entry, recorded), recordParams: true, against: 'recorded' }
}

/**
 * Judge the bytes on disk against the install asked for now. `defaults` are
 * the parameters the entry resolves with no `--set` (`undefined` when one is
 * required), the reference for a fragment that records none.
 */
export const reinstallOf = (input: ReinstallInput): Reinstall => {
  const { onDisk } = input
  if (onDisk === undefined) return { kind: 'new' }
  if (sameFragment(onDisk, input.content)) return { kind: 'same' }
  const { prior, recordParams, against } = priorOf(input, onDisk)
  if (
    prior === undefined ||
    !sameFragment(onDisk, withRecordedVersion(input.render(prior, recordParams), onDisk))
  ) {
    return { kind: 'edited', against }
  }
  const changes = changedParams(prior, input.params)
  // Same block, same parameters, nothing more to record: only an older
  // engine's version on the first line differs. Not rewritten for that.
  const recordsNothingNew = recordParams || paramsHeader(input.params) === undefined
  return changes.length === 0 && recordsNothingNew ? { kind: 'same' } : { kind: 'update', changes }
}

/**
 * What a planned install carries for a verdict other than `edited`: written
 * or not, and for a rewrite the changes and the SHA-256 of the bytes read, so
 * the write is skipped if the file changed on disk in between.
 */
const rewriteOf = (
  verdict: Exclude<Reinstall, { readonly kind: 'edited' }>,
  onDisk: string | undefined
): {
  readonly present: boolean
  readonly updated?: readonly string[]
  readonly expectedDigest?: string
} =>
  verdict.kind === 'update'
    ? {
        present: false,
        updated: verdict.changes,
        expectedDigest: createHash('sha256')
          .update(onDisk ?? '', 'utf-8')
          .digest('hex'),
      }
    : { present: verdict.kind === 'same' }

/** What `--update` replaced: the version on disk, whether it was edited, and the new one. */
export interface Replaced {
  readonly from?: string
  readonly to: string
  readonly edited: boolean
}

/**
 * What a planned install carries, `--update` included. Under `--update`
 * (`replaceWith`, the running version) a fragment on disk is rewritten with
 * exactly what this binary writes, edited or not, unless it already is; the
 * SHA-256 of the bytes read guards the write as for a rewrite. Without it, an
 * `edited` verdict was refused by the caller before this is reached.
 */
export const placementOf = (
  verdict: Reinstall,
  onDisk: string | undefined,
  content: string,
  replaceWith: string | undefined
): ReturnType<typeof rewriteOf> & { readonly replaced?: Replaced } => {
  if (replaceWith !== undefined && onDisk !== undefined) {
    if (sameFragment(onDisk, content)) return { present: true }
    const from = installedVersionOf(onDisk)
    return {
      present: false,
      replaced: {
        ...(from === undefined ? {} : { from }),
        to: replaceWith,
        edited: verdict.kind === 'edited',
      },
      expectedDigest: createHash('sha256').update(onDisk, 'utf-8').digest('hex'),
    }
  }
  return verdict.kind === 'edited' ? { present: false } : rewriteOf(verdict, onDisk)
}

/**
 * The `--set` pairs an `--update` installs with: every parameter the fragment
 * on disk records and the entry still declares, then each `--set` given, which
 * overrides its own. A fragment recording none keeps `sets` as given, so the
 * entry's defaults apply.
 */
export const updateSets = (
  entry: LibraryEntry,
  onDisk: string | undefined,
  sets: readonly string[]
): readonly string[] => {
  const recorded = onDisk === undefined ? undefined : recordedParamsOf(onDisk)
  if (recorded === undefined) return sets
  const given = new Set(sets.map((pair) => pair.slice(0, Math.max(pair.indexOf('='), 0))))
  const declared = new Set(entry.params.map((param) => param.name))
  return [
    ...[...recorded]
      .filter(([name]) => declared.has(name) && !given.has(name))
      .map(([name, value]) => `${name}=${value}`),
    ...sets,
  ]
}

/** The `--as` an install under `name` was given, for the command a refusal prints. */
export const asOf = (entry: LibraryEntry, name: string): string | undefined =>
  name === entry.slug ? undefined : name

/**
 * The refusal for an edited fragment, naming the comparison that failed and
 * the `--update` command that replaces it (with its `--as` when `as` is given).
 */
export const editedMessage = (
  relativePath: string,
  id: string,
  against: EditedAgainst,
  as?: string
): string =>
  `Error: ${relativePath} was edited after it was installed: it differs from what ${id} ` +
  `${{ recorded: 'wrote with the parameters it records', default: 'writes with its default parameters', none: 'writes' }[against]}.\n\n` +
  '  library add never overwrites an edit. Keep it, or replace it with what this\n' +
  '  version writes (the edit is lost; commit your config first):\n' +
  `  sovrium library add ${id}${as === undefined ? '' : ` --as ${as}`} --update`

/** What the line reporting one written fragment reads. */
interface WrittenFragment {
  readonly id: string
  readonly relativePath: string
  readonly requiredBy?: string
  readonly updated?: readonly string[]
  readonly replaced?: Replaced
  readonly paramsNote?: string
}

/** `Replaced <path> — <id>@<old>, edited since it was installed, with <id>@<new>`. */
const replacedLine = (
  { relativePath, id }: WrittenFragment,
  { from, to, edited }: Replaced,
  dryRun: boolean
): string =>
  `${dryRun ? 'Would replace' : 'Replaced'} ${relativePath} — ${from === undefined ? id : `${id}@${from}`}` +
  `, ${edited ? 'edited since it was installed' : 'unedited'}, with ${id}@${to}`

/**
 * The line reporting one fragment written, or to be written under
 * `--dry-run`: `Updated library/block/x.yaml — block/x: successPath /sign-in → /`
 * for a rewrite, and for a requirement the entry that pulled it in and the
 * value of each of its parameters with where it came from.
 */
export const writeLine = (install: WrittenFragment, dryRun = false): string => {
  const { relativePath, id, updated, requiredBy, paramsNote, replaced } = install
  if (replaced !== undefined) return replacedLine(install, replaced, dryRun)
  if (updated !== undefined)
    return `${dryRun ? 'Would update' : 'Updated'} ${relativePath} — ${id}: ${updated.length === 0 ? 'its parameters are now recorded' : updated.join(', ')}`
  const requirement =
    requiredBy === undefined
      ? ''
      : ` — ${id}, required by ${requiredBy}${paramsNote === undefined ? '' : `, with ${paramsNote}`}`
  return `${dryRun ? 'Would write' : 'Wrote'} ${relativePath}${dryRun ? '' : requirement}`
}
