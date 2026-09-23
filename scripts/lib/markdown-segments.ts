/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Split markdown into the runs a matcher may read and the runs it may not.
 *
 * ## Why this is not optional
 *
 * Link syntax and documentation ABOUT link syntax are byte-identical, and this
 * corpus documents markdown constantly. A matcher that cannot tell a link from
 * a specimen of one is wrong in both directions, and both directions have now
 * been paid for:
 *
 * - The website generator's flattener rewrote two acceptance criteria that
 * quoted the syntax they were documenting — `[internal ref]` documented
 *   the `` `- [title](url): description` `` bullet shape and
 * `[internal ref]` documented `` `![alt](src)` ``. It published
 *   `- title: description` as the documented format. Nothing failed: the
 *   corruption is byte-consistent with itself, so the drift gate compared the
 *   mangled output against the mangled expectation forever.
 * - `check-docs-links.ts` read the same specimen as a LINK and demanded that
 *   `url` resolve to a file. `url` is the specimen's placeholder; there is
 *   nothing to point it at. The row bought an entry in `.docs-links-ignore`
 *   whose drain condition was this module existing.
 *
 * The two consumers want different things from the answer — the generator
 * rebuilds a document it only partly rewrites, the gate wants line numbers to
 * survive — so this module returns SEGMENTS and lets each take what it needs.
 * {@link blankCodeSegments} is the gate's view.
 *
 * ## The two passes
 *
 * Blocks first, because CommonMark resolves them first: a line opening a fence
 * wins over any inline span left hanging above it. Then inline spans within
 * each surviving run.
 *
 * Indented (four-space) code blocks are deliberately NOT recognised. Inside a
 * list item — which is most of this corpus — four spaces is ordinary
 * continuation, so detecting them would hide real prose from the guard, and the
 * failure would be silent in the direction that publishes 404s.
 */

/**
 * One run of the source: either prose the matcher may read, or CODE it must
 * not.
 *
 * `text` is verbatim, and concatenating every segment's `text` in order
 * reproduces the input byte for byte — which is what lets the flattener rebuild
 * a document it only partly rewrites, and what lets {@link blankCodeSegments}
 * preserve every offset.
 */
export interface MarkdownSegment {
  readonly text: string
  readonly kind: 'prose' | 'code'
}

/** A line that OPENS a fence: ≤3 spaces, then ≥3 backticks or tildes. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/

/**
 * Split a non-fenced run into prose and inline code spans.
 *
 * CommonMark's code-span rule, and the whole reason a regex cannot stand in for
 * it: a backtick RUN of length N opens a span, and only a run of EXACTLY N
 * closes it. That is what makes ``` ``a ` b`` ``` one span rather than two, and
 * what makes an unmatched run ordinary text — so a lone backtick in prose must
 * not swallow the rest of the paragraph.
 *
 * Scanned across the whole run rather than line by line, because a code span
 * legally spans newlines inside a paragraph.
 */
const inlineSegments = (text: string): readonly MarkdownSegment[] => {
  const segments: MarkdownSegment[] = []
  let proseStart = 0
  let index = 0

  const runEnd = (from: number): number => {
    let end = from
    while (text[end] === '`') end += 1
    return end
  }

  while (index < text.length) {
    if (text[index] !== '`') {
      index += 1
      continue
    }
    const openEnd = runEnd(index)
    const length = openEnd - index

    let cursor = openEnd
    let closeEnd = -1
    while (cursor < text.length) {
      if (text[cursor] !== '`') {
        cursor += 1
        continue
      }
      const candidateEnd = runEnd(cursor)
      if (candidateEnd - cursor === length) {
        closeEnd = candidateEnd
        break
      }
      cursor = candidateEnd
    }

    if (closeEnd === -1) {
      // No closer: the backticks are literal text, so keep scanning past them.
      index = openEnd
      continue
    }

    if (index > proseStart) segments.push({ text: text.slice(proseStart, index), kind: 'prose' })
    segments.push({ text: text.slice(index, closeEnd), kind: 'code' })
    index = closeEnd
    proseStart = closeEnd
  }

  if (proseStart < text.length) segments.push({ text: text.slice(proseStart), kind: 'prose' })
  return segments
}

/**
 * The BLOCK pass alone: fenced code blocks separated from everything else.
 *
 * Inline spans are left inside the prose runs, which is what a heading scanner
 * wants — a heading's inline code is part of its TEXT and of the anchor slug it
 * generates, so `## \`code\`` must keep its word. Only a `#` line inside a
 * fence is a false heading, and only fences need blanking to suppress it.
 *
 * {@link markdownSegments} is this plus the inline pass, for the consumers that
 * do need spans separated.
 */
export const fencedSegments = (markdown: string): readonly MarkdownSegment[] => {
  const lines = markdown.split('\n')
  const segments: MarkdownSegment[] = []
  let prose: string[] = []
  let fence: { readonly marker: string; readonly length: number } | undefined

  const flushProse = (): void => {
    if (prose.length === 0) return
    // Each entry already carries its own newline, so this is a plain re-join.
    segments.push({ text: prose.join(''), kind: 'prose' })
    prose = []
  }

  for (const [position, line] of lines.entries()) {
    const text = position === lines.length - 1 ? line : `${line}\n`

    if (fence) {
      segments.push({ text, kind: 'code' })
      const closing = FENCE_OPEN.exec(line)
      if (
        closing?.[1]?.startsWith(fence.marker) &&
        closing[1].length >= fence.length &&
        (closing[2] ?? '').trim() === ''
      )
        fence = undefined
      continue
    }

    const opening = FENCE_OPEN.exec(line)
    const marker = opening?.[1]
    // A backtick info string may not itself contain a backtick (CommonMark).
    if (marker && !(marker.startsWith('`') && (opening?.[2] ?? '').includes('`'))) {
      flushProse()
      segments.push({ text, kind: 'code' })
      fence = { marker: marker[0] ?? '`', length: marker.length }
      continue
    }

    prose.push(text)
  }

  flushProse()
  return segments
}

/**
 * Split markdown into prose runs and code runs, per the module docstring.
 *
 * Both passes: fences first, then inline spans within each surviving run.
 * Concatenating every segment's `text` in order reproduces the input exactly.
 */
export const markdownSegments = (markdown: string): readonly MarkdownSegment[] =>
  fencedSegments(markdown).flatMap((segment) =>
    segment.kind === 'code' ? [segment] : inlineSegments(segment.text)
  )

/** Every prose run of a document, with code spans and fenced blocks removed. */
export const proseOf = (markdown: string): readonly string[] =>
  markdownSegments(markdown)
    .filter((segment) => segment.kind === 'prose')
    .map((segment) => segment.text)

/**
 * The document with every CODE run blanked to spaces, newlines kept.
 *
 * The same length and the same line structure as the input, so a scanner may
 * still count lines, slice offsets, or run a line-oriented regex over the
 * result — which is why a consumer that reports positions takes this rather
 * than {@link proseOf}, whose joined output silently shortens every document
 * containing a fence.
 *
 * It replaces the cruder `markdown.replace(/```[\s\S]*?```/g, …)` blanking,
 * which saw fences only, paired them by counting from the top of the file, and
 * was blind to inline code spans entirely.
 */
export const blankCodeSegments = (markdown: string): string =>
  markdownSegments(markdown)
    .map((segment) =>
      segment.kind === 'code' ? segment.text.replaceAll(/[^\n]/g, ' ') : segment.text
    )
    .join('')

/**
 * The document with every FENCED BLOCK blanked to spaces, inline code spans
 * left intact, newlines kept.
 *
 * For a scanner whose false positive is a `#` line inside a shell example but
 * whose subject legitimately contains inline code. A heading is exactly that:
 * `## \`code\`` generates the anchor `#code`, so blanking its span deletes the
 * heading and every link pointing at it fails. Measured: 82 anchor findings
 * across 42 files the first time {@link blankCodeSegments} was used here.
 */
export const blankFencedBlocks = (markdown: string): string =>
  fencedSegments(markdown)
    .map((segment) =>
      segment.kind === 'code' ? segment.text.replaceAll(/[^\n]/g, ' ') : segment.text
    )
    .join('')
