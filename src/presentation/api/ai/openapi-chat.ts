/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { chatRequestSchema, chatResponseSchema } from '@/domain/models/api/ai/chat'
import {
  transcriptionRequestFieldsSchema,
  transcriptionResponseSchema,
} from '@/domain/models/api/ai/transcriptions'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
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
        404: errorResponse('AI is not enabled'),
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
          description: 'Server-Sent Events stream of reply chunks',
        },
        400: errorResponse('Invalid request body'),
        401: errorResponse('Not authenticated'),
        404: errorResponse('AI is not enabled'),
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
