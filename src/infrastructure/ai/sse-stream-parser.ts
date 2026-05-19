/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { ChatChunk } from '@/application/ports/services/ai-service'


interface ChatCompletionChunkPayload {
  readonly choices?: ReadonlyArray<{
    readonly delta?: { readonly content?: string | null }
  }>
  readonly model?: string
}

interface ParsedDataLine {
  readonly chunk?: ChatChunk
  readonly model?: string
  readonly done?: boolean
}

const SSE_DONE_SENTINEL = '[DONE]'
const SSE_DATA_PREFIX = 'data:'

const extractDataLines = (rawEvent: string): ReadonlyArray<string> =>
  rawEvent
    .split('\n')
    .filter((line) => line.startsWith(SSE_DATA_PREFIX))
    .map((line) => line.slice(SSE_DATA_PREFIX.length).trimStart())
    .filter((data) => data.length > 0)

const tryParseJson = <T>(input: string): T | undefined => {
  try {
    return JSON.parse(input) as T
  } catch {
    return undefined
  }
}

const parseDataLine = (data: string): ParsedDataLine => {
  if (data === SSE_DONE_SENTINEL) return { done: true }
  const payload = tryParseJson<ChatCompletionChunkPayload>(data)
  if (payload === undefined) return {}
  const delta = payload.choices?.[0]?.delta?.content
  return {
    ...(typeof payload.model === 'string' && { model: payload.model }),
    ...(typeof delta === 'string' && delta.length > 0 && { chunk: { type: 'content', delta } }),
  }
}

interface EventScan {
  readonly events: ReadonlyArray<string>
  readonly remaining: string
}

const scanEvents = (buffer: string): EventScan => {
  const segments = buffer.split('\n\n')
  const events = segments.slice(0, -1)
  const remaining = segments.at(-1) ?? ''
  return { events, remaining }
}

interface BatchOutcome {
  readonly chunks: ReadonlyArray<ChatChunk>
  readonly model: string
  readonly done: boolean
}

const applyEvents = (events: ReadonlyArray<string>, startModel: string): BatchOutcome =>
  events
    .flatMap((rawEvent) => extractDataLines(rawEvent).map(parseDataLine))
    .reduce<BatchOutcome>(
      (acc, parsed) => {
        if (acc.done) return acc
        if (parsed.done === true) {
          return {
            chunks: [...acc.chunks, { type: 'done', model: acc.model }],
            model: acc.model,
            done: true,
          }
        }
        const nextModel = parsed.model ?? acc.model
        const nextChunks = parsed.chunk !== undefined ? [...acc.chunks, parsed.chunk] : acc.chunks
        return { chunks: nextChunks, model: nextModel, done: false }
      },
      { chunks: [], model: startModel, done: false }
    )

const releaseReader = (reader: ReadableStreamDefaultReader<Uint8Array>): void => {
  try {
    reader.releaseLock()
  } catch {
  }
}

interface ReaderState {
  readonly buffer: string
  readonly model: string
}

const pullAndApply = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  state: ReaderState
): Promise<
  | {
      readonly state: ReaderState
      readonly chunks: ReadonlyArray<ChatChunk>
      readonly done: boolean
    }
  | undefined
> => {
  const { value, done } = await reader.read()
  if (done) return undefined
  const buffer = state.buffer + decoder.decode(value, { stream: true })
  const { events, remaining } = scanEvents(buffer)
  const outcome = applyEvents(events, state.model)
  return {
    state: { buffer: remaining, model: outcome.model },
    chunks: outcome.chunks,
    done: outcome.done,
  }
}

export async function* parseSseChunks(
  body: ReadableStream<Uint8Array>,
  defaultModel: string
): AsyncIterable<ChatChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let state: ReaderState = { buffer: '', model: defaultModel }
  let sawDone = false

  try {
    while (true) {
      const step = await pullAndApply(reader, decoder, state)
      if (step === undefined) break
      ;({ state } = step)
      for (const chunk of step.chunks) yield chunk
      if (step.done) {
        sawDone = true
        return
      }
    }
  } finally {
    releaseReader(reader)
  }

  if (!sawDone) {
    yield { type: 'done', model: state.model }
  }
}
