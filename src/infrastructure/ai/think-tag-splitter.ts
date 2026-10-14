/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Split a model's text into its answer and the reasoning it wrapped in
 * `<think>…</think>`.
 *
 * Open reasoning models served by Ollama or an OpenAI-compatible server
 * (DeepSeek-R1, Qwen3, Magistral) stream their thinking INSIDE the content,
 * between those tags, rather than in a separate `reasoning_content` field. A
 * chat window that shows it as the answer shows a draft; a conversation that
 * saves it saves the draft. So the adapter splits it out here, below the port,
 * and the port's stream carries `reasoning` events apart from `content`.
 *
 * The splitter is incremental: a tag split across two deltas (`<thi` + `nk>`)
 * is held back until it is known to be a tag, and released as text the moment
 * it is known not to be one. Nothing is ever dropped — a stream that ends
 * inside a reasoning block yields that block as reasoning.
 */

const OPEN_TAG = '<think>'
const CLOSE_TAG = '</think>'

/** One piece of split output. */
export interface SplitPiece {
  readonly kind: 'content' | 'reasoning'
  readonly text: string
}

/** The longest suffix of `text` that is a proper prefix of `tag` — the part to hold back. */
const pendingTagPrefix = (text: string, tag: string): number => {
  const max = Math.min(text.length, tag.length - 1)
  for (let size = max; size > 0; size -= 1) {
    if (tag.startsWith(text.slice(text.length - size))) return size
  }
  return 0
}

/** What one buffer splits into, and the state the next delta starts from. */
interface SplitStep {
  readonly pieces: readonly SplitPiece[]
  readonly inThink: boolean
  readonly held: string
}

/** Split a buffer, flipping mode at each tag, holding back a possible tag at its end. */
const splitBuffer = (buffer: string, inThink: boolean): SplitStep => {
  if (buffer.length === 0) return { pieces: [], inThink, held: '' }
  const tag = inThink ? CLOSE_TAG : OPEN_TAG
  const kind: SplitPiece['kind'] = inThink ? 'reasoning' : 'content'
  const index = buffer.indexOf(tag)
  if (index >= 0) {
    const head: readonly SplitPiece[] = index > 0 ? [{ kind, text: buffer.slice(0, index) }] : []
    const rest = splitBuffer(buffer.slice(index + tag.length), !inThink)
    return { ...rest, pieces: [...head, ...rest.pieces] }
  }
  const keep = pendingTagPrefix(buffer, tag)
  const emit = buffer.slice(0, buffer.length - keep)
  return {
    pieces: emit.length > 0 ? [{ kind, text: emit }] : [],
    inThink,
    held: buffer.slice(buffer.length - keep),
  }
}

/** An incremental splitter: feed it deltas in order, then flush once at the end. */
export interface ThinkTagSplitter {
  readonly feed: (delta: string) => readonly SplitPiece[]
  readonly flush: () => readonly SplitPiece[]
}

/** Create a splitter for one model reply. */
export const createThinkTagSplitter = (): ThinkTagSplitter => {
  let state: Omit<SplitStep, 'pieces'> = { inThink: false, held: '' }

  const feed = (delta: string): readonly SplitPiece[] => {
    const step = splitBuffer(state.held + delta, state.inThink)
    state = { inThink: step.inThink, held: step.held }
    return step.pieces
  }

  const flush = (): readonly SplitPiece[] => {
    const rest = state.held
    state = { ...state, held: '' }
    return rest.length > 0 ? [{ kind: state.inThink ? 'reasoning' : 'content', text: rest }] : []
  }

  return { feed, flush }
}

/** Split a whole (non-streamed) reply in one go. */
export const splitThinkTags = (
  text: string
): { readonly content: string; readonly reasoning: string } => {
  const splitter = createThinkTagSplitter()
  const pieces = [...splitter.feed(text), ...splitter.flush()]
  const join = (kind: SplitPiece['kind']): string =>
    pieces
      .filter((piece) => piece.kind === kind)
      .map((piece) => piece.text)
      .join('')
  return { content: join('content'), reasoning: join('reasoning') }
}
