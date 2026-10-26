/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The project's own brief — a root `PROMPT.md` and/or `CLAUDE.md` — composed
 * into the text of the `project-brief` MCP prompt.
 *
 * Pure: the caller reads the bytes, this decides what is served. A file over
 * the cap or not valid UTF-8 is left out WHOLE and reported back, never
 * truncated or decoded with replacement characters — half a brief passed off
 * as the person's text would be worse than none. One file is served verbatim;
 * two are each put under a heading naming them, `PROMPT.md` (what to build)
 * before `CLAUDE.md` (how to work on it).
 */

/** Per-file cap: a file of exactly this many bytes is kept, one byte more is not. */
export const PROJECT_BRIEF_FILE_CAP_BYTES = 256 * 1024

/** The files that make up the brief, in the order they are served. */
export const PROJECT_BRIEF_FILES = ['PROMPT.md', 'CLAUDE.md'] as const

export interface ProjectBriefFile {
  readonly name: string
  readonly bytes: Uint8Array
}

export interface ProjectBriefSkip {
  readonly name: string
  readonly reason: 'too-large' | 'not-utf8'
}

export interface ProjectBrief {
  readonly text: string
  readonly description: string
  readonly sources: readonly string[]
}

export interface ProjectBriefComposition {
  readonly brief?: ProjectBrief
  readonly skipped: readonly ProjectBriefSkip[]
}

type Decoded =
  | { readonly kind: 'kept'; readonly name: string; readonly text: string }
  | { readonly kind: 'skipped'; readonly skip: ProjectBriefSkip }
  | { readonly kind: 'empty' }

const decodeStrictUtf8 = (bytes: Uint8Array): string | undefined => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

const decodeFile = (file: ProjectBriefFile): Decoded => {
  if (file.bytes.byteLength > PROJECT_BRIEF_FILE_CAP_BYTES) {
    return { kind: 'skipped', skip: { name: file.name, reason: 'too-large' } }
  }
  const text = decodeStrictUtf8(file.bytes)
  if (text === undefined) {
    return { kind: 'skipped', skip: { name: file.name, reason: 'not-utf8' } }
  }
  // A file holding only whitespace has nothing to hand the assistant.
  return text.trim() === '' ? { kind: 'empty' } : { kind: 'kept', name: file.name, text }
}

const orderOf = (name: string): number => {
  const index = (PROJECT_BRIEF_FILES as readonly string[]).indexOf(name)
  return index === -1 ? PROJECT_BRIEF_FILES.length : index
}

const describeSources = (sources: readonly string[]): string =>
  `This project's own brief, read from ${sources.join(' and ')} at the project root.`

export const composeProjectBrief = (
  files: readonly ProjectBriefFile[]
): ProjectBriefComposition => {
  const decoded = files
    .toSorted((left, right) => orderOf(left.name) - orderOf(right.name))
    .map(decodeFile)
  const skipped = decoded.flatMap((entry) => (entry.kind === 'skipped' ? [entry.skip] : []))
  const kept = decoded.flatMap((entry) => (entry.kind === 'kept' ? [entry] : []))
  if (kept.length === 0) return { brief: undefined, skipped }
  const sources = kept.map((entry) => entry.name)
  const text =
    kept.length === 1
      ? (kept[0]?.text ?? '')
      : kept
          .map((entry) => `# ${entry.name}\n\n${entry.text}`)
          // A blank line between sections, whether or not a file ends in a newline;
          // each file's own bytes, its last one included, are left as written.
          .reduce((joined, section) =>
            joined.endsWith('\n') ? `${joined}\n${section}` : `${joined}\n\n${section}`
          )
  return { brief: { text, description: describeSources(sources), sources }, skipped }
}

/** The one stderr line a skipped file earns. */
export const describeSkippedBriefFile = (skip: ProjectBriefSkip): string =>
  skip.reason === 'too-large'
    ? `[mcp] ${skip.name} left out of the project-brief prompt: larger than 256 KiB.`
    : `[mcp] ${skip.name} left out of the project-brief prompt: not valid UTF-8.`
