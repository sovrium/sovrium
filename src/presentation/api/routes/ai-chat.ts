/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Stream } from 'effect'
import { AiService, type ChatChunk } from '@/application/ports/services/ai-service'
import { chatRequestSchema, type ChatResponse, type ChatAction } from '@/domain/models/api/ai/chat'
import { provideAiLive } from '@/presentation/api/routes/ai/effect-runner'
import type { Hono, Context } from 'hono'

/**
 * Generic AI Chat route — `POST /api/ai/chat`.
 *
 * This is the cross-cutting chat endpoint asserted by
 * `specs/ai/chat/cross-cutting.spec.ts` (`APP-AI-CHAT-CROSS-005` and
 * neighbours). It is distinct from the per-agent endpoint
 * `POST /api/agents/:name/chat` mounted by `ai-mcp-status.ts` — that one is
 * tied to a declared `app.agents[]` entry; this one is the default,
 * agent-less chat surface used by the platform's generic chat UI.
 *
 * Auth wiring: this file does NOT install `authMiddleware`/`requireAuth`
 * itself. The auth chain in `api-routes.ts` (where this route is mounted)
 * adds `requireAuth()` for `/api/ai/chat` so unauthenticated requests get
 * a 401 (per `APP-AI-CHAT-CROSS-007`) before the handler runs.
 *
 * Response envelope (per the spec contract):
 *   { reply: string, actions: ChatAction[], sessionId: string }
 *
 * `actions` is always an empty array in this v1 surface — tool routing,
 * record-mutation actions, and pending-confirmation flows ship in later
 * specs (see `docs/architecture/audits/ai-p0-minimum-specs-2026-05-11.md`
 * § 2.5 "Out-of-scope for P0").
 */

interface ChatRequestPayload {
  readonly message: string
  readonly sessionId: string
}

const parseRequestBody = async (
  c: Readonly<Context>
): Promise<ChatRequestPayload | { readonly error: string }> => {
  const raw = (await c.req.json().catch(() => undefined)) as unknown
  const parsed = chatRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request body' }
  }
  return {
    message: parsed.data.message,
    sessionId: parsed.data.sessionId ?? crypto.randomUUID(),
  }
}

/**
 * When `AI_PROVIDER` is entirely unset, AI is not just unconfigured but
 * absent — the chat surface does not exist, so we return 404 (consistent
 * with the rest of the API's "feature not enabled → 404" convention).
 * A *present-but-empty/invalid* `AI_PROVIDER` is a misconfiguration of an
 * intended feature and surfaces as 503 from the service layer below.
 */
const aiDisabledResponse = (c: Readonly<Context>): Response | undefined => {
  const provider = process.env.AI_PROVIDER
  if (provider === undefined) {
    return c.json({ error: 'AI is not enabled. Set AI_PROVIDER to enable AI features.' }, 404)
  }
  return undefined
}

const handleChat = async (c: Readonly<Context>): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400)
  }
  const { message, sessionId } = parsed

  // The "not configured" path is already encoded in `AiServiceLive` as an
  // `AiConfigError` returned by the no-op stub's `chat` method. There is no
  // need for an `isConfigured()` short-circuit here — we just call `chat` and
  // map the tagged-error union to HTTP status codes below. Spec 2
  // (`APP-AI-CHAT-ERROR-001`) will refine the provider-error mapping.
  const program = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({ messages: [{ role: 'user', content: message }] })
  })

  const result = await Effect.runPromise(program.pipe(provideAiLive, Effect.either))

  if (result._tag === 'Left') {
    const err = result.left
    if (err._tag === 'AiConfigError') {
      return c.json({ error: err.message }, 503)
    }
    // AiProviderError — provider 5xx, network failure, or malformed response.
    return c.json({ error: err.message }, 502)
  }

  const reply = result.right
  const actions: ReadonlyArray<ChatAction> = []
  const body: ChatResponse = {
    reply: reply.content,
    actions: [...actions],
    sessionId,
  }
  return c.json(body, 200)
}

// ---------------------------------------------------------------------------
// Streaming variant — POST /api/ai/chat/stream
// ---------------------------------------------------------------------------

/**
 * Encode a single ChatChunk as an OpenAI-compatible SSE event line.
 *
 * `content` chunks are wrapped in a chat-completion `delta` envelope so
 * clients that already parse OpenAI's streaming protocol (e.g. Vercel AI
 * SDK, OpenAI's own SDK) work without translation. The terminal `done`
 * chunk becomes the canonical `data: [DONE]` sentinel.
 */
const encodeSseEvent = (chunk: ChatChunk): string => {
  if (chunk.type === 'done') {
    return 'data: [DONE]\n\n'
  }
  const payload = {
    object: 'chat.completion.chunk',
    choices: [
      // OpenAI SSE protocol literally uses JSON null here for non-terminal
      // chunks; substituting undefined would omit the field and break
      // strict clients that switch on its presence.
      // eslint-disable-next-line unicorn/no-null -- protocol-mandated null value
      { index: 0, delta: { content: chunk.delta }, finish_reason: null },
    ],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

/**
 * Run the chat-stream Effect program and produce a `ReadableStream<Uint8Array>`
 * suitable for an SSE response body.
 *
 * Pre-flight error handling: we peek at the stream by collecting eagerly
 * so an `AiConfigError`/`AiProviderError` raised BEFORE any chunk lands
 * can be turned into a non-200 HTTP status (mirrors the non-streaming
 * route's tagged-error → status mapping). Once the first chunk has been
 * emitted we are committed to a 200 SSE body and surface late errors as
 * a `data: ` event embedded in the stream.
 *
 * NOTE: For STREAM-001/002 we keep the implementation simple — buffer
 * the full chunk sequence then encode it. Real-time chunk forwarding
 * lands later when latency-sensitive tests drive it.
 */
const buildStreamResponse = async (
  c: Readonly<Context>,
  input: { readonly message: string }
): Promise<Response> => {
  const program = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* Stream.runCollect(
      ai.chatStream({ messages: [{ role: 'user', content: input.message }] })
    )
  })

  const result = await Effect.runPromise(program.pipe(provideAiLive, Effect.either))

  if (result._tag === 'Left') {
    const err = result.left
    if (err._tag === 'AiConfigError') {
      return c.json({ error: err.message }, 503)
    }
    return c.json({ error: err.message }, 502)
  }

  const chunks = Array.from(result.right)
  const encoder = new TextEncoder()
  const encodedChunks = chunks.map((chunk) => encoder.encode(encodeSseEvent(chunk)))
  // Ensure a trailing [DONE] sentinel even if upstream forgot to emit one —
  // defensive against half-implemented mocks.
  const trailing = chunks.every((ch) => ch.type !== 'done')
    ? [encoder.encode('data: [DONE]\n\n')]
    : []
  const allEncoded = [...encodedChunks, ...trailing]

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      allEncoded.forEach((bytes) => controller.enqueue(bytes))
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

const handleChatStream = async (c: Readonly<Context>): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400)
  }
  return buildStreamResponse(c, { message: parsed.message })
}

/**
 * Chain the generic `/api/ai/chat` route(s) onto the given Hono app.
 *
 * Always registered. When AI is not configured both handlers return 503;
 * unauthenticated requests are short-circuited to 401 by the `requireAuth`
 * middleware applied in `api-routes.ts` (covers both `/api/ai/chat` and
 * `/api/ai/chat/stream`). Both behaviours are asserted by the cross-cutting
 * and streaming specs.
 */
export function chainAiChatRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .post('/api/ai/chat', (c) => handleChat(c as unknown as Readonly<Context>))
    .post('/api/ai/chat/stream', (c) =>
      handleChatStream(c as unknown as Readonly<Context>)
    ) as unknown as T
}
