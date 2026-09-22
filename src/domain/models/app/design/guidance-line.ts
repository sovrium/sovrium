/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Splitting one declared writing rule into the INSTRUCTION and its REASON.
 *
 * ─── WHY THIS IS A SPLIT AND NOT A SCHEMA FIELD ────────────────────────────
 *
 * `GuidanceLineSchema` is a bare string. Every entry in `apps/website`'s own
 * `design.voice.prefer` is nonetheless written as an instruction followed by the
 * reason for it, because that is how a writing rule is usefully stated — and a
 * reader obeying the rule needs the sentence they must obey, not the opening
 * clause of a paragraph about why.
 *
 * A structured `prefer: (string | {rule, rationale})[]` would render this
 * faithfully and is NOT authorised: it is an `AppSchema` change touching every
 * app's config and the published docs, so it is a founder decision rather than a
 * console one. Until then the two registers can only come from splitting the
 * declared line, and the split has to be safe.
 *
 * ─── THREE INVARIANTS, AND EACH HAS A REAL FAILURE BEHIND IT ───────────────
 *
 *  1. **Rejoining reproduces the declaration exactly.** A split that drops or
 *     invents a word rewrites the operator's rule on the one page whose entire
 *     claim is that it shows their own words.
 *  2. **Neither half carries an unbalanced quote.** `apps/website` ships
 *     `State a mechanism the reader can check: "Sovrium runs the application. On
 *     your own infrastructure." A mechanism reads as a fact…`, whose first
 *     sentence-ending period sits INSIDE the quotation. A naive
 *     split-on-first-period cuts mid-quote and produces two halves that each
 *     look plausible in isolation.
 *  3. **A line with nothing to split stays whole.** A single-sentence
 *     declaration is a complete rule. Fabricating a rationale, or splitting on
 *     something that is not a sentence end just to produce two halves, would be
 *     a worse lie than no second register at all.
 *
 * `[internal ref]` asserts the first two directly, by rejoining what
 * the page rendered and by counting quote characters in the instruction.
 */

/** A declared rule, and the reason the same line gave for it. */
export interface GuidanceSplit {
  /** The sentence a writer must obey. Never empty. */
  readonly instruction: string
  /** Why, when the line said. `undefined` when the line is one sentence. */
  readonly rationale?: string
}

/** The characters that end a sentence. */
const TERMINATORS = new Set(['.', '!', '?'])

/** The characters that can close a quotation immediately after a terminator. */
const CLOSERS = new Set(['"', '”', '’', "'"])

/**
 * For each character index, whether it sits INSIDE a quotation.
 *
 * A straight `"` toggles, because the same character opens and closes; the curly
 * pair counts up and down. A CLOSING quote is itself reported as outside, which
 * is what lets a boundary be found immediately after `…infrastructure."` while
 * the period before it is correctly reported as inside.
 */
const insideQuoteFlags = (text: string): readonly boolean[] =>
  [...text].reduce<{
    readonly straight: number
    readonly curly: number
    readonly flags: readonly boolean[]
  }>(
    (state, character) => {
      const straight = character === '"' ? state.straight + 1 : state.straight
      const curly =
        character === '“' ? state.curly + 1 : character === '”' ? state.curly - 1 : state.curly
      return {
        straight,
        curly,
        flags: [...state.flags, straight % 2 === 1 || curly > 0],
      }
    },
    { straight: 0, curly: 0, flags: [] }
  ).flags

/**
 * Whether the text may be cut just before index `at`.
 *
 * The character before the cut must end a sentence — allowing one closing quote
 * after the terminator, which is the shape the shipped quoted rule takes — the
 * cut itself must fall outside any quotation, and what follows must open a new
 * sentence rather than continue this one.
 */
const isSentenceBoundary = (text: string, inside: readonly boolean[], at: number): boolean => {
  const previous = text[at - 1] ?? ''
  const terminator = CLOSERS.has(previous) ? (text[at - 2] ?? '') : previous
  if (!TERMINATORS.has(terminator)) return false
  if (inside[at] === true) return false
  return /^\s+[A-Z]/.test(text.slice(at))
}

/**
 * Split a declared guidance line into its instruction and its reason.
 *
 * @param line - the line exactly as the operator declared it.
 * @returns the instruction, plus the rationale when the line carried one.
 */
export const splitGuidanceLine = (line: string): GuidanceSplit => {
  const text = line.trim()
  const inside = insideQuoteFlags(text)
  const at = inside.findIndex((_, index) => index > 0 && isSentenceBoundary(text, inside, index))

  if (at === -1) return { instruction: text }

  const instruction = text.slice(0, at).trimEnd()
  const rationale = text.slice(at).trimStart()
  // A split that produced an empty half is not a split. Falling back to the
  // whole line keeps invariant 1 rather than emitting a blank register.
  return instruction.length === 0 || rationale.length === 0
    ? { instruction: text }
    : { instruction, rationale }
}
