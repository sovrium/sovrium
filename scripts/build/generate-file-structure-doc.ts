#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Render the `src/` and `scripts/` trees into the two documents that claim to
 * describe them.
 *
 * ## Why this exists
 *
 * `[internal ref]` carried a
 * hand-written tree dated 2026-02-27. By 2026-09-14 it showed three directories
 * that no longer existed (`domain/factories/`, `application/services/`,
 * `domain/models/app/theme/`) and omitted several that did — and nothing
 * reported it, because a stale map is not a type error, not a broken link, and
 * not a lint finding. It is prose that still parses.
 *
 * The same shape sits in `[internal ref]`: a "File shapes" table
 * marked `generated:begin suffix-table` that no generator wrote. A block
 * labelled generated and maintained by hand is worse than an honest hand table,
 * because the label tells the next reader not to check it.
 *
 * So both are rendered here, from the two sources that cannot themselves rot:
 * the directories that hold files, and `DIRECTORY_POLICY` in
 * `[internal ref]` — the same table ESLint and `Layout Drift` read.
 * `[internal ref]` byte-compares the result.
 *
 * ## Marker blocks, not whole files
 *
 * Neither document is generated end to end. `13-file-structure.md` is part 13
 * of a split document: `Docs Link Drift` reads its navigation footer, and its
 * supersession banner points at [internal ref]. The rulebook's table sits inside prose
 * that explains what a suffix row can and cannot adjudicate. Generating the
 * whole file would delete both, so each generated region is fenced by
 * `<!-- generated:begin <name> -->` / `<!-- generated:end <name> -->` and
 * everything outside stays hand-written. {@link spliceBlock} refuses a file
 * whose markers are missing, duplicated or inverted rather than appending —
 * a generator that silently creates its own block writes a second copy of the
 * tree every time it runs.
 *
 * ## Directories come from FILES, not from `find`
 *
 * `find src -type d` was the obvious source and is the wrong one. `git mv`
 * leaves the emptied directory behind on disk, so during a move wave the
 * filesystem carries directories the committed tree does not have — and a
 * byte-equality gate keyed on it would then disagree between the machine that
 * ran the move and a fresh clone of the result. A directory is in the tree when
 * it holds a file, transitively; an emptied one drops out by construction.
 *
 * Reading `git ls-files` instead would be equally correct and costs a child
 * process, which SC2 spends only on a real need.
 *
 * ## Indentation, not box drawing
 *
 * The old hand tree used `├──`/`└──`. Those characters encode a node's position
 * among its siblings, so inserting one directory rewrites every line below it
 * at that level and the diff of a one-directory change is unreadable. Two
 * spaces per level encode depth only: adding a directory adds one line.
 *
 * Invoked by:
 *   - `bun run scripts/build/generate-file-structure-doc.ts`
 *   - `bun run scripts/build/generate-file-structure-doc.ts --check` (no write)
 * - `[internal ref]`, which imports the pure
 *     renderers rather than shelling out
 *
 * Exit codes: 0 written (or already current), 1 a target is unreadable or its
 * markers are malformed.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { printJournal, printStderr } from '@/infrastructure/logging/cli-output'
import { DIRECTORY_POLICY } from '../../eslint/layout-policy'
import { REPO_ROOT, toRepoRelative, walkSync } from '../lib/drift/walk'
import type { DirectoryPolicy } from '../../eslint/layout-policy'

const TAG = 'file-structure-doc'

/** The exact command a human runs when the gate reports drift. */
export const FIX_COMMAND = 'bun run scripts/build/generate-file-structure-doc.ts'

/** The two trees this document describes, in the order they are rendered. */
export const RENDERED_ROOTS: readonly string[] = ['src', 'scripts']

/** Repo-relative path of the architecture document holding the tree. */
export const STRUCTURE_DOC = 'docs/architecture/layer-based-architecture/13-file-structure.md'

/** Repo-relative path of the auto-loading rulebook holding the suffix table. */
export const RULEBOOK = '.claude/rules/layout.md'

/** The block name fenced in {@link STRUCTURE_DOC}. */
export const TREE_BLOCK = 'directory-tree'

/** The block name fenced in {@link RULEBOOK}. */
export const SUFFIX_BLOCK = 'suffix-table'

// =============================================================================
// Corpus
// =============================================================================

/**
 * Every directory under the rendered roots that holds a file, plus its
 * ancestors, sorted.
 *
 * Sorted lexicographically rather than walked depth-first, because a sorted
 * list of full paths IS the tree once each line is indented by its depth, and
 * it has no ordering an implementation could get subtly wrong.
 */
export const collectDirectories = (root: string = REPO_ROOT): readonly string[] => {
  const dirs = new Set<string>()
  for (const tree of RENDERED_ROOTS) {
    for (const absolute of walkSync({ root: join(root, tree) })) {
      const segments = toRepoRelative(absolute).split('/').slice(0, -1)
      for (let depth = 1; depth <= segments.length; depth += 1) {
        dirs.add(segments.slice(0, depth).join('/'))
      }
    }
  }
  return [...dirs].sort()
}

// =============================================================================
// Pure rendering
// =============================================================================

/** The directory part of a policy glob: `src/domain/errors/*.ts` -> `src/domain/errors`. */
export const policyDirectory = (glob: string): string => glob.split('/').slice(0, -1).join('/')

/** Segments carrying no wildcard — how specific a glob is about WHERE it applies. */
const literalSegments = (glob: string): number =>
  glob.split('/').filter((segment) => !segment.includes('*')).length

/** Whether a directory glob (possibly ending `**`) claims a concrete directory. */
const claims = (globDir: string, dir: string): boolean => {
  const globParts = globDir.split('/')
  const dirParts = dir.split('/')
  for (let index = 0; index < globParts.length; index += 1) {
    const segment = globParts[index]
    if (segment === '**') return dirParts.length >= index
    const actual = dirParts[index]
    if (actual === undefined) return false
    if (segment === '*') continue
    if (segment !== actual) return false
  }
  return dirParts.length === globParts.length
}

/**
 * The one-line purpose for a directory, or `undefined`.
 *
 * MOST SPECIFIC WINS, which is not how the audit reads the same table — there,
 * every matching row must permit, because each one forbids something real. Here
 * the question is different: a reader wants the sentence written ABOUT this
 * directory, so `src/presentation/api/runtime` shows its own tier purpose and
 * not the slug row's. Ties break on policy order, so the table stays the tie
 * breaker rather than the sort being one.
 *
 * `target` rows are skipped: they describe a directory the programme has not
 * created, and the tree only ever contains directories that exist.
 */
export const purposeFor = (
  dir: string,
  policy: readonly DirectoryPolicy[] = DIRECTORY_POLICY
): string | undefined => {
  let best: DirectoryPolicy | undefined
  let bestScore = -1
  for (const row of policy) {
    if (row.status !== 'current') continue
    const globDir = policyDirectory(row.glob)
    if (!claims(globDir, dir)) continue
    const score = literalSegments(globDir)
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return best?.purpose
}

/**
 * The tree block: one line per directory, indented by depth, purpose appended.
 *
 * The fence is ```text rather than bare, so the markdown renderers treat it as a
 * code block with no language guessing — and so `Docs Config Fence Drift`,
 * which decodes every `yaml`/`json` fence through the real AppSchema decoder,
 * never tries to read a directory listing as a config.
 */
export const renderTree = (
  dirs: readonly string[],
  policy: readonly DirectoryPolicy[] = DIRECTORY_POLICY
): string => {
  const shown = new Map<string, string | undefined>()
  const lines = dirs.map((dir) => {
    const depth = dir.split('/').length - 1
    const purpose = purposeFor(dir, policy)
    shown.set(dir, purpose)
    // A `**` row claims its own directory AND every descendant, so
    // `[internal ref]**` would stamp the same sentence on `lib/`, `lib/drift/`
    // and `lib/effect/`. Printing it once, at the directory the row is really
    // about, is the difference between a legend and wallpaper — and a repeated
    // sentence reads as three separate decisions rather than one.
    const parent = dir.split('/').slice(0, -1).join('/')
    const inherited = parent.length > 0 && shown.get(parent) === purpose
    const name = `${'  '.repeat(depth)}${dir.split('/').at(-1) ?? dir}/`
    return purpose === undefined || inherited ? name : `${name.padEnd(56)}# ${purpose}`
  })
  return ['```text', ...lines, '```'].join('\n')
}

/** `*.ts` -> `` `*.ts` ``, for a shape list inside a markdown table cell. */
const code = (text: string): string => `\`${text}\``

/**
 * What a directory accepts, as one table cell.
 *
 * `require` is an ALLOW-LIST that wins outright — `suffixes()` in
 * `[internal ref]` consults `forbid` only when `require` is
 * empty — so a row carrying both has a `forbid` that can never fire. The cell
 * therefore prints one or the other, never both: a table listing refusals a
 * reader can see are unreachable is how the policy comes to be read as stricter
 * than it is. (`src/infrastructure/<area>/*.ts` is exactly that shape today:
 * its `require` ends in a `*.ts` catch-all, so its `forbid: ['*-routes.ts']`
 * is dead. Noted here; the policy is where it gets fixed.)
 *
 * `require: []` means "any kebab name", and then the forbid list is what the
 * row can actually decide. A row with neither governs nothing, and a reader
 * should be able to see that without opening the policy.
 */
export const acceptsCell = (row: DirectoryPolicy): string => {
  if (row.require.length > 0) return row.require.map(code).join(', ')
  if (row.forbid.length === 0) return 'any kebab name'
  return `any kebab name, never ${row.forbid.map(code).join(' / ')}`
}

/**
 * The rulebook's "File shapes" table.
 *
 * `[internal ref]*.json` shows no ceiling: `max-lines` is an ESLint rule
 * over source, and a JSON baseline is data whose size is its corpus's. Printing
 * the policy's nominal 820 there would read as a limit somebody chose.
 */
export const renderSuffixTable = (
  policy: readonly DirectoryPolicy[] = DIRECTORY_POLICY
): string => {
  const rows = policy.map((row) => {
    const status = row.status === 'target' ? ' *(target)*' : ''
    const ceiling = row.glob.endsWith('.json') ? '—' : String(row.maxLines)
    return `| ${code(row.glob)}${status} | ${acceptsCell(row)} | ${ceiling} |`
  })
  return [
    'Derived from `DIRECTORY_POLICY` in `eslint/layout-policy.ts`, and rendered by',
    '`scripts/build/generate-file-structure-doc.ts`. Rows marked *(target)* describe a directory',
    'the programme has not created yet, and are not matched against files until it does. A file',
    'whose name matches no `require` shape of a `current` row is `foreign-suffix`.',
    '',
    '| Directory | Accepts | Ceiling |',
    '|---|---|---|',
    ...rows,
  ].join('\n')
}

// =============================================================================
// Block splicing
// =============================================================================

/** Thrown when a target's generated block cannot be located unambiguously. */
export class BlockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockError'
  }
}

const beginMarker = (name: string): string => `<!-- generated:begin ${name} -->`
const endMarker = (name: string): string => `<!-- generated:end ${name} -->`

/**
 * Replace the body between a block's markers. PURE.
 *
 * Refuses rather than repairs. A missing marker is a document somebody edited
 * by hand into a shape this tool no longer recognises, and appending a fresh
 * block would leave the stale one in place — two trees in one document, the
 * second of which is correct and neither of which is labelled.
 *
 * @throws {BlockError}
 */
export const spliceBlock = (text: string, name: string, body: string): string => {
  const begin = beginMarker(name)
  const end = endMarker(name)
  const firstBegin = text.indexOf(begin)
  const firstEnd = text.indexOf(end)
  if (firstBegin === -1 || firstEnd === -1) {
    throw new BlockError(
      `generate-file-structure-doc: no '${name}' block. Add ${begin} and ${end} around the ` +
        'region this tool owns, or delete the call — a generator that creates its own block ' +
        'writes a second copy of the content on every run.'
    )
  }
  if (text.indexOf(begin, firstBegin + 1) !== -1 || text.indexOf(end, firstEnd + 1) !== -1) {
    throw new BlockError(
      `generate-file-structure-doc: the '${name}' block markers appear more than once. ` +
        'Only one region can be the generated one.'
    )
  }
  if (firstEnd < firstBegin) {
    throw new BlockError(
      `generate-file-structure-doc: the '${name}' end marker precedes its begin marker.`
    )
  }
  // A BLANK LINE on each side of the body, and it is not cosmetic: Prettier
  // separates an HTML comment from an adjacent block, so a body butted up
  // against its marker is rewritten by `bun run quality`'s format step — and
  // then `File Structure Doc Drift` fails against the formatter's version on
  // the next run. Two tools writing the same bytes differently is a gate that
  // can never be green and a generator that can never be idempotent.
  return `${text.slice(0, firstBegin + begin.length)}\n\n${body.trim()}\n\n${text.slice(firstEnd)}`
}

// =============================================================================
// Targets
// =============================================================================

/** One document, and what its generated block must contain. */
export interface RenderTarget {
  readonly path: string
  readonly block: string
  readonly body: string
}

/** Both targets, rendered from the live tree and the live policy. */
export const renderTargets = (
  root: string = REPO_ROOT,
  policy: readonly DirectoryPolicy[] = DIRECTORY_POLICY
): readonly RenderTarget[] => [
  {
    path: STRUCTURE_DOC,
    block: TREE_BLOCK,
    body: renderTree(collectDirectories(root), policy),
  },
  { path: RULEBOOK, block: SUFFIX_BLOCK, body: renderSuffixTable(policy) },
]

/** The text each target should hold, keyed by path. Reads; does not write. */
export const expectedTexts = (
  root: string = REPO_ROOT,
  policy: readonly DirectoryPolicy[] = DIRECTORY_POLICY
): ReadonlyMap<string, string> => {
  const expected = new Map<string, string>()
  for (const target of renderTargets(root, policy)) {
    const current = readFileSync(join(root, target.path), 'utf8')
    expected.set(target.path, spliceBlock(current, target.block, target.body))
  }
  return expected
}

// =============================================================================
// CLI
// =============================================================================

const main = (argv: readonly string[]): number => {
  const checkOnly = argv.includes('--check')
  let expected: ReadonlyMap<string, string>
  try {
    expected = expectedTexts()
  } catch (error) {
    printStderr(error instanceof Error ? error.message : String(error))
    return 1
  }

  const stale: string[] = []
  for (const [path, text] of expected) {
    const current = readFileSync(join(REPO_ROOT, path), 'utf8')
    if (current === text) continue
    stale.push(path)
    if (!checkOnly) writeFileSync(join(REPO_ROOT, path), text)
  }

  if (stale.length === 0) {
    printJournal(TAG, `Both generated blocks are current (${expected.size} target(s)).`)
    return 0
  }
  if (checkOnly) {
    printStderr(`Stale generated block(s): ${stale.join(', ')}\n  Run: ${FIX_COMMAND}`)
    return 1
  }
  printJournal(TAG, `Rewrote ${stale.length} generated block(s): ${stale.join(', ')}.`)
  return 0
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)))
}
