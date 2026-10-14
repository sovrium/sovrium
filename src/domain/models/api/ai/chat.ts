/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { transformed } from '@/domain/models/api/combinators/transform'

// ---------------------------------------------------------------------------
// Message parts
// ---------------------------------------------------------------------------

/**
 * The most parts one chat message may carry. A part is a text block or one
 * uploaded file, so this is in practice the number of files a single message
 * can hand the model.
 */
export const MAX_CHAT_MESSAGE_PARTS = 20

/** A block of the user's own words. */
const chatTextPartSchema = Schema.Struct({
  type: Schema.Literal('text').annotate({ description: 'A block of text written by the user' }),
  text: Schema.String.annotate({ description: 'The text of the part' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({ description: 'A text part' })

/**
 * A part naming a file the same user uploaded through
 * `POST /api/ai/chat/attachments`. Only the id travels: the client never sends
 * the bytes, a bucket or a storage key, and the server resolves the id against
 * the caller's own uploads before anything reaches the model.
 */
const chatAttachmentPartSchema = <K extends 'image' | 'file'>(kind: K, description: string) =>
  Schema.Struct({
    type: Schema.Literal(kind).annotate({ description }),
    attachmentId: Schema.String.annotate({
      description: 'The `attachmentId` the attachment upload answered with',
    }).pipe(Schema.check(Schema.isMinLength(1))),
  }).annotate({ description })

/**
 * One typed part of a chat message: `text`, `image` or `file`.
 *
 * An `image` reaches the model as a picture only on an instance that declares
 * its model vision-capable; a `file` reaches it as the text extracted from the
 * upload, quoted as a document. Both are references to an upload, never inline
 * content.
 */
export const chatMessagePartSchema = Schema.Union([
  chatTextPartSchema,
  chatAttachmentPartSchema('image', 'A picture the user uploaded, sent to the model as an image'),
  chatAttachmentPartSchema('file', 'A document the user uploaded, sent to the model as its text'),
]).annotate({ description: 'One part of a chat message' })

/** @public */
export type ChatMessagePart = typeof chatMessagePartSchema.Type

// ---------------------------------------------------------------------------
// Chat request schema
// ---------------------------------------------------------------------------

/** The request body as a client sends it: `message`, `parts`, or both. */
const chatRequestInputSchema = Schema.Struct({
  message: optionalField(
    Schema.String.annotate({
      description:
        'User message to send to the AI. Shorthand for one text part; optional when `parts` is sent',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  parts: optionalField(
    Schema.Array(chatMessagePartSchema)
      .annotate({
        description:
          'The message as typed parts: text, and references to files and images the user uploaded. When present, the text parts are the message and `message` is used only if the parts carry no text',
      })
      .pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(MAX_CHAT_MESSAGE_PARTS)))
  ),
  sessionId: optionalField(
    Schema.String.annotate({
      description: 'Session identifier for conversation continuity (auto-generated if omitted)',
    })
  ),
  context: optionalField(
    Schema.Struct({
      table: optionalField(
        Schema.String.annotate({ description: 'Current table context for scoped queries' })
      ),
      recordId: optionalField(
        Schema.Union([Schema.String, Schema.Finite]).annotate({
          description: 'Current record context for targeted operations',
        })
      ),
    }).annotate({ description: 'Optional context about the current page or view' })
  ),
  confirmationToken: optionalField(
    Schema.String.annotate({
      description: 'Token to confirm a previously pending destructive action',
    })
  ),
  agent: optionalField(
    Schema.String.annotate({
      description: 'Name of a declared app.agents[] entry to bind this chat turn to',
    })
  ),
  parentId: optionalField(
    Schema.String.annotate({
      description:
        "Id of the conversation message this turn follows: the last message of the branch the user is reading. The turn is saved below it, whichever branch is current when the answer ends. A message outside the caller's conversation, or one that is not an answer, is ignored, and the turn follows the current branch",
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      value.message !== undefined || value.parts !== undefined
        ? undefined
        : 'Either message or parts is required'
    )
  )
)

/** The request body as the routes receive it: `message` is always the turn's text. */
const chatRequestDecodedSchema = Schema.Struct({
  message: Schema.String,
  parts: optionalField(Schema.Array(chatMessagePartSchema)),
  sessionId: optionalField(Schema.String),
  context: optionalField(
    Schema.Struct({
      table: optionalField(Schema.String),
      recordId: optionalField(Schema.Union([Schema.String, Schema.Finite])),
    })
  ),
  confirmationToken: optionalField(Schema.String),
  agent: optionalField(Schema.String),
  parentId: optionalField(Schema.String),
})

type ChatRequestInput = typeof chatRequestInputSchema.Type

/**
 * Bring `message` and `parts` to one shape.
 *
 * - `message` alone: unchanged, and no `parts` (one text part, as before).
 * - `parts`: they are the message. When they carry no text and a `message` was
 *   sent, that message becomes the leading text part, so a client sending a
 *   question beside its files loses neither. When they carry text, a `message`
 *   sent beside them is a copy for older servers and is not used.
 * - Either way, the decoded `message` is the parts' text joined by a blank
 *   line, so the length cap, the conversation title and the history read the
 *   same text the model reads. A message made of files alone has an empty
 *   `message`.
 */
const normaliseChatRequest = (input: ChatRequestInput): typeof chatRequestDecodedSchema.Type => {
  const { parts, message, ...rest } = input
  if (parts === undefined) return { ...rest, message: message ?? '' }
  const carriesText = parts.some((part) => part.type === 'text')
  const merged: readonly ChatMessagePart[] =
    carriesText || message === undefined ? parts : [{ type: 'text', text: message }, ...parts]
  const text = merged.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n\n')
  return { ...rest, message: text, parts: merged }
}

/**
 * Chat request schema for `POST /api/ai/chat` and `POST /api/ai/chat/stream`.
 *
 * A client sends `message` (a string), `parts` (typed parts), or both — the
 * chat window sends both on a turn that carries uploads. At least one is
 * required. The decoded value always has `message` set to the turn's text, and
 * `parts` when the client sent parts (see {@link normaliseChatRequest}).
 *
 * The OpenAPI document describes the INPUT shape.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via `effectValidator`
 * - Hono RPC client type inference
 */
export const chatRequestSchema = transformed(
  chatRequestInputSchema,
  chatRequestDecodedSchema,
  normaliseChatRequest
)

// ---------------------------------------------------------------------------
// Chat action schema
// ---------------------------------------------------------------------------

/**
 * Describes an action taken by the AI during chat processing.
 */
export const chatActionSchema = Schema.Struct({
  type: Schema.Literals(['query', 'create', 'update', 'delete', 'automation']).annotate({
    description: 'Type of action performed',
  }),
  table: optionalField(Schema.String.annotate({ description: 'Table affected by the action' })),
  recordId: optionalField(
    Schema.String.annotate({
      description: 'Record affected by the action, as the records API names it',
    })
  ),
  description: Schema.String.annotate({
    description: 'Human-readable description of the action taken',
  }),
  /**
   * Automation name — present only on `type: 'automation'` actions produced
   * when a chat turn triggers a manual automation.
   */
  name: optionalField(
    Schema.String.annotate({ description: 'Automation name (automation actions only)' })
  ),
  /**
   * Automation run status — `'completed' | 'failed' | 'running'`. Present only
   * on `type: 'automation'` actions.
   */
  status: optionalField(
    Schema.Literals(['completed', 'failed', 'running']).annotate({
      description: 'Automation run status (automation actions only)',
    })
  ),
  /**
   * Automation run identifier — correlates with `GET /api/automations/runs/:id`.
   * Present only on `type: 'automation'` actions.
   */
  runId: optionalField(
    Schema.String.annotate({ description: 'Automation run id (automation actions only)' })
  ),
  /**
   * Automation run duration in seconds. Present only on `type: 'automation'`
   * actions when the duration is known.
   */
  duration: optionalField(
    Schema.Finite.annotate({ description: 'Automation run duration in seconds' })
  ),
})

// ---------------------------------------------------------------------------
// Pending confirmation schema
// ---------------------------------------------------------------------------

/**
 * Describes a destructive action awaiting user confirmation.
 */
export const pendingConfirmationSchema = Schema.Struct({
  action: Schema.String.annotate({
    description: 'Action type requiring confirmation (e.g. delete, bulk update)',
  }),
  table: Schema.String.annotate({ description: 'Table affected by the pending action' }),
  affectedCount: Schema.Int.annotate({
    description: 'Number of records that will be affected',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  description: Schema.String.annotate({
    description: 'Human-readable description of the pending action',
  }),
  confirmationToken: Schema.String.annotate({
    description: 'Token to include in next request to confirm the action',
  }),
})

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

/**
 * One knowledge passage an answer cites.
 *
 * When an agent's knowledge search retrieves passages for a turn, each is
 * handed to the model under a number (`[1]`, `[2]`…). The reply's `citations`
 * hold one entry per number the answer actually carries, in order of first
 * use; a retrieved passage the answer does not mark is not cited, and a marker
 * matching no retrieved passage is dropped.
 *
 * Carried on the buffered chat reply (`POST /api/ai/chat`,
 * `POST /api/agents/{name}/chat`) and, in a stream, on its `done` event.
 */
export const chatCitationSchema = Schema.Struct({
  index: Schema.Int.annotate({
    description: 'The number the passage was given to the model under, as the answer marks it',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  source: Schema.String.annotate({
    description:
      'Where the passage comes from: the declared document path, or `table:<name>:<recordId>`',
  }),
  label: Schema.String.annotate({
    description: "The source's human-readable label: the document's label, else its path",
  }),
  excerpt: Schema.String.annotate({ description: 'The text of the passage the model was given' }),
})

/** The citations of one answer, in order of first use. */
export const chatCitationsSchema = Schema.Array(chatCitationSchema).annotate({
  description: 'The knowledge passages the answer marks, in order of first use',
})

// ---------------------------------------------------------------------------
// Chat response schema
// ---------------------------------------------------------------------------

/**
 * Chat response schema for the AI chat endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API response validation
 * - Hono RPC client type inference
 */
export const chatResponseSchema = Schema.Struct({
  reply: Schema.String.annotate({ description: 'AI-generated text response to the user' }),
  actions: Schema.Array(chatActionSchema).annotate({
    description: 'Actions taken by the AI during this turn',
  }),
  sessionId: Schema.String.annotate({
    description: 'Session identifier for conversation continuity',
  }),
  pendingConfirmation: optionalField(
    pendingConfirmationSchema.annotate({
      description: 'Destructive action awaiting user confirmation before execution',
    })
  ),
  citations: optionalField(chatCitationsSchema),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ChatRequest = typeof chatRequestSchema.Type
export type ChatAction = typeof chatActionSchema.Type
export type PendingConfirmation = typeof pendingConfirmationSchema.Type
export type ChatResponse = typeof chatResponseSchema.Type
export type ChatCitation = typeof chatCitationSchema.Type

// ---------------------------------------------------------------------------
// Chat attachments
// ---------------------------------------------------------------------------

/**
 * API contract for `POST /api/ai/chat/attachments?chat=<component id>` — a file
 * attached to a chat, stored in the bucket the chat's `attachments` block names.
 *
 * **Request shape.** `multipart/form-data` with one binary `file` part. Effect
 * Schema does not describe a binary part, so the route reads it with Hono's
 * `c.req.parseBody()`; only the `chat` query parameter is modelled here
 * ({@link chatAttachmentUploadQuerySchema}).
 *
 * **Response shape.** {@link chatAttachmentUploadResponseSchema} (HTTP 201). The
 * file is addressed from then on by `attachmentId` alone: its storage key never
 * leaves the server.
 *
 * **Refusals** use the ordinary error envelope: 404 for an anonymous caller, an
 * unknown chat or a chat without an `attachments` block; 413 for a file over
 * the chat's `maxSizeMb`; 415 for a file whose CONTENT is not one of the chat's
 * accepted types, whatever its name and declared type say.
 *
 * Consumed by `src/presentation/api/ai/attachment-routes.ts`.
 */

/** The query parameter naming the chat an upload is for. */
export const chatAttachmentUploadQuerySchema = Schema.Struct({
  chat: Schema.String.annotate({
    description: 'The `id` of the ai-chat component the file is attached to',
  }).pipe(Schema.check(Schema.isMinLength(1))),
})

/** Response schema for a stored chat attachment (HTTP 201). */
export const chatAttachmentUploadResponseSchema = Schema.Struct({
  attachmentId: Schema.String.annotate({
    description: 'Identifier of the stored file, sent back as a `file` or `image` message part',
  }),
  name: Schema.String.annotate({ description: 'The file name as uploaded' }),
  size: Schema.Int.annotate({ description: 'Size of the file in bytes' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  mimeType: Schema.String.annotate({
    description: 'The media type read from the file content, not from its name',
  }),
  bucket: Schema.String.annotate({ description: 'The bucket the file is stored in' }),
})

/** @public */
export type ChatAttachmentUploadResponse = typeof chatAttachmentUploadResponseSchema.Type

/**
 * Request body of `POST /api/ai/chat/elicitations/{elicitationId}` — the
 * person's answer to a question an agent asked in a streamed chat (`ask_user`).
 *
 * **Request shape.** {@link elicitationAnswerSchema}: how she answered, and with
 * `accept` the values of the form. The values are then checked against the
 * question itself — its required fields, its choices, its formats — which this
 * wire shape cannot know.
 *
 * **Response.** The rest of the turn, as Server-Sent Events, like
 * `POST /api/ai/chat/stream`. Refusals use the ordinary error envelope: 400 for
 * an answer that does not fit the question (the question stays open), 404 for
 * anyone but the person the turn answered, 409 for a question already answered
 * or expired.
 *
 * Consumed by `src/presentation/api/agents/chat-elicitation-routes.ts`.
 */
export const elicitationAnswerSchema = Schema.Struct({
  action: Schema.Literals(['accept', 'decline', 'cancel']).annotate({
    description:
      '"accept" answers with the form, "decline" skips the question, "cancel" dismisses it',
  }),
  content: optionalField(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description:
        'With "accept": the value of each field, by its name. A skipped optional field is left out.',
    })
  ),
})

/** @public */
export type ElicitationAnswerBody = typeof elicitationAnswerSchema.Type
