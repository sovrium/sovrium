/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  chatRequestSchema,
  chatResponseSchema,
  elicitationAnswerSchema,
} from '@/domain/models/api/ai/chat'
import {
  transcriptionRequestFieldsSchema,
  transcriptionResponseSchema,
} from '@/domain/models/api/ai/transcriptions'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type StaticGroupSpec } from '../openapi/route-spec'

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const chatRequestBody = effectJsonBody(chatRequestSchema)

/** AI chat route group. */
export const aiChatGroup: StaticGroupSpec = {
  tag: 'AI',
  tagDescription: 'AI assistant, conversations, and retrieval-augmented generation',
  routes: [
    {
      method: 'post',
      pathTemplate: '/api/ai/chat',
      summary: 'Send an AI chat message',
      description:
        'Sends a message to the AI assistant and returns the assistant reply and any actions.',
      operationIdBase: 'postAiChat',
      request: { body: chatRequestBody },
      responses: {
        200: effectJsonResponse(chatResponseSchema, 'Assistant reply'),
        400: errorResponse('Invalid request body or message too long'),
        401: errorResponse('Not authenticated'),
        403: errorResponse('Forbidden record query or mutation'),
        404: errorResponse('AI is not enabled, or a part names an upload that is not the caller’s'),
        422: errorResponse(
          'A part names a picture, and the model is not declared able to read images'
        ),
        429: errorResponse('Chat rate limit exceeded'),
        500: errorResponse('AI provider error'),
        503: errorResponse('AI provider unavailable'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/stream',
      summary: 'Stream an AI chat response',
      description:
        'Sends a message to the AI assistant and streams the reply as Server-Sent Events.',
      operationIdBase: 'postAiChatStream',
      request: { body: chatRequestBody },
      responses: {
        200: {
          content: { 'text/event-stream': { schema: effectSchema(Schema.String) } },
          description:
            'Server-Sent Events stream of typed events: content, reasoning, tool_call, tool_result, elicit, then done and the [DONE] sentinel',
        },
        400: errorResponse('Invalid request body'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('AI is not enabled, or a part names an upload that is not the caller’s'),
        422: errorResponse(
          'A part names a picture, and the model is not declared able to read images'
        ),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/stop',
      summary: 'Stop a streamed AI chat turn',
      description:
        "Stops the caller's turn in progress on a session. The turn ends at its next step, and its stream with done and stop reason stopped.",
      operationIdBase: 'postAiChatStop',
      request: {
        body: {
          content: {
            'application/json': {
              schema: effectSchema(Schema.Struct({ sessionId: Schema.String })),
            },
          },
        },
      },
      responses: {
        202: {
          content: {
            'application/json': {
              schema: effectSchema(
                Schema.Struct({ status: Schema.Literal('stopping'), sessionId: Schema.String })
              ),
            },
          },
          description: 'The turn is stopping',
        },
        400: errorResponse('Missing sessionId'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('No turn in progress on this session'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/approvals/{approvalId}',
      summary: 'Decide on a tool call held in a chat turn',
      description:
        'Approves or rejects a tool call the agent held for approval in a streamed chat turn. Only the person the turn answered may decide. The answer streams the rest of the turn: the call result, then the reply.',
      operationIdBase: 'postAiChatApprovalDecision',
      parameters: effectParameters(Schema.Struct({ approvalId: Schema.String }), 'path'),
      request: {
        body: {
          content: {
            'application/json': {
              schema: effectSchema(
                Schema.Struct({ decision: Schema.Literals(['approve', 'reject']) })
              ),
            },
          },
        },
      },
      responses: {
        200: {
          content: { 'text/event-stream': { schema: effectSchema(Schema.String) } },
          description:
            'Server-Sent Events stream of the rest of the turn: tool_result, content, then done and the [DONE] sentinel',
        },
        400: errorResponse('Invalid decision'),
        404: errorResponse('No such approval for the caller'),
        409: errorResponse('The approval was already decided or has expired'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/chat/elicitations/{elicitationId}',
      summary: 'Answer a question the agent asked in a chat turn',
      description:
        'Answers a question the agent asked the person in a streamed chat turn (the elicit event): accept with the form values, decline to skip it, or cancel to dismiss it. Only the person the turn answered may answer. An accepted or declined question streams the rest of the turn; a cancelled one closes without resuming it and answers JSON.',
      operationIdBase: 'postAiChatElicitationAnswer',
      parameters: effectParameters(Schema.Struct({ elicitationId: Schema.String }), 'path'),
      request: { body: effectJsonBody(elicitationAnswerSchema) },
      responses: {
        200: {
          content: {
            'text/event-stream': { schema: effectSchema(Schema.String) },
            'application/json': {
              schema: effectSchema(
                Schema.Struct({
                  status: Schema.Literal('cancelled'),
                  elicitationId: Schema.String,
                })
              ),
            },
          },
          description:
            'For accept and decline, a Server-Sent Events stream of the rest of the turn: content, then done and the [DONE] sentinel. For cancel, JSON: the question is closed and the turn does not resume',
        },
        400: errorResponse('The answer does not fit the question; the question stays open'),
        404: errorResponse('No such question for the caller'),
        409: errorResponse('The question was already answered or has expired'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/ai/transcriptions',
      summary: 'Transcribe a recording',
      description:
        'Turns a recording into text for chat dictation, on the speech-to-text endpoint the operator configures. The recording is transcribed and discarded, never stored.',
      operationIdBase: 'postAiTranscription',
      request: {
        body: {
          content: {
            'multipart/form-data': {
              schema: effectSchema(
                Schema.Struct({
                  file: Schema.String.annotate({
                    description: 'The recording, an audio file of at most 25 MB',
                  }),
                  ...transcriptionRequestFieldsSchema.fields,
                })
              ),
            },
          },
        },
      },
      responses: {
        200: effectJsonResponse(transcriptionResponseSchema, 'The transcript'),
        400: errorResponse('Missing, oversized or non-audio recording, or an invalid field'),
        404: errorResponse('Not signed in, on an app that declares auth'),
        429: errorResponse('Rate limit exceeded'),
        503: errorResponse('No speech-to-text provider is configured'),
      },
    },
  ],
}
